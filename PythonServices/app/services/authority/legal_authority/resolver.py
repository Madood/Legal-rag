"""
Main resolver - Pure legal analysis with no execution dependencies.
Determines: statute, article/paragraph, legal field, and whether
clarification is needed before proceeding to retrieval.
"""
from typing import Dict, Any
import re

from .statute_lock import lock_statute
from .reference_extractor import extract_explicit_reference
from .inference.gdpr import infer_gdpr_article
from .inference.criminal import infer_criminal_paragraph
from .inference.civil import infer_civil_paragraph
from .clarifications import gdpr_clarification

def _classify_question_type(question: str) -> Dict[str, Any]:
    """Classify question type (moved from Node's questionClassifier.js)."""
    lower_question = question.lower()
    
    # Question type patterns (from Node's questionClassifier.js)
    patterns = {
        'DOCTRINE': [
            'schuldprinzip', 'guilt principle', 'nulla poena sine culpa',
            'verhältnismäßigkeitsprinzip', 'proportionality principle',
            'rechtsstaatsprinzip', 'rule of law principle',
            'was ist das prinzip', 'explain the doctrine',
            'legal doctrine', 'rechtspri', 'grundsatz',
            'legal principle', 'rechtsgrundsatz'
        ],
        
        'SYSTEM': [
            'common law system', 'civil law system', 'legal system',
            'german legal system', 'type of legal system',
            'is germany a common law', 'classification of legal system',
            'rechtskreis', 'rechtsfamilie'
        ],
        
        'NORMATIVE': [
            '§\\s*\\d', 'artikel\\s*\\d', 'article\\s*\\d',
            'paragraph\\s*\\d', 'section\\s*\\d',
            'was regelt §', 'what does article',
            'erklären sie §', 'explain section'
        ],
        
        'OFFENSE': [
            'espionage', 'fraud', 'theft', 'murder', 'robbery', 'assault',
            'spionage', 'betrug', 'diebstahl', 'mord', 'raub', 'körperverletzung',
            'sexual offence', 'sexualstraftat', 'terrorism', 'terrorismus',
            'which crime', 'welche straftat'
        ],
        
        'DEFINITION': [
            'what is', 'was ist', 'define', 'definition von',
            'meaning of', 'bedeutung von', 'erklären sie',
            'explain the term', 'begriffserklärung'
        ],
        
        'COMPARISON': [
            'difference between', 'unterschied zwischen',
            'compare', 'vergleichen', 'similar to', 'ähnlich wie',
            'versus', 'vs', 'im vergleich zu'
        ],
        
        'PROCEDURAL': [
            'how to', 'wie wird', 'procedure for', 'verfahren für',
            'steps to', 'schritte zur', 'process for', 'ablauf bei',
            'what are the requirements', 'voraussetzungen für'
        ]
    }
    
    # Check each type
    for qtype, type_patterns in patterns.items():
        for pattern in type_patterns:
            if qtype == 'NORMATIVE':
                # Use regex for normative patterns
                if re.search(pattern, lower_question, re.IGNORECASE):
                    return {'type': qtype, 'method': 'pattern_match'}
            else:
                # Simple substring match for others
                if pattern in lower_question:
                    return {'type': qtype, 'method': 'pattern_match'}
    
    # Default to GENERAL
    return {'type': 'GENERAL', 'method': 'default'}

def _assess_complexity(question: str, question_type: str, statute: str = None) -> str:
    """Assess question complexity (moved from Node's questionClassifier.js)."""
    lower_question = question.lower()
    complexity = 'medium'  # Default
    
    # Complexity indicators (simplified from Node)
    high_complexity = ['constitutional', 'fundamental', 'supreme court', 'verfassungsgericht',
                      'european court', 'europäischer gerichtshof', 'human rights', 'menschenrechte']
    
    low_complexity = ['definition', 'meaning', 'simple', 'basic', 'grundlegend']
    
    # Check for high complexity indicators
    for indicator in high_complexity:
        if indicator in lower_question:
            complexity = 'high'
            break
    
    # Doctrine and system questions are high complexity
    if question_type in ['DOCTRINE', 'SYSTEM']:
        complexity = 'high'
    
    # Constitutional law questions are high complexity
    if statute == 'GG':
        complexity = 'high'
    
    # Check for low complexity indicators
    if complexity != 'high':
        for indicator in low_complexity:
            if indicator in lower_question:
                complexity = 'low'
                break
    
    return complexity

def _detect_language(question: str) -> str:
    """Detect question language (moved from Node's questionClassifier.js)."""
    lower_question = question.lower()
    
    german_indicators = ['der', 'die', 'das', 'und', 'für', 'mit', 'ist', 'sind', '§', 'artikel']
    english_indicators = ['the', 'a', 'an', 'and', 'for', 'with', 'is', 'are', 'section', 'article']
    
    german_score = sum(1 for word in german_indicators if f' {word} ' in lower_question or 
                      lower_question.startswith(f'{word} ') or lower_question.endswith(f' {word}'))
    
    english_score = sum(1 for word in english_indicators if f' {word} ' in lower_question or 
                       lower_question.startswith(f'{word} ') or lower_question.endswith(f' {word}'))
    
    # Check for German specific characters
    if any(char in lower_question for char in ['ä', 'ö', 'ü', 'ß']):
        german_score += 3
    
    # Check for German legal terms
    if '§' in lower_question or 'artikel' in lower_question:
        german_score += 2
    
    return 'german' if german_score >= english_score else 'english'

def _determine_retrieval_requirement(question_type: str, has_reference: bool) -> bool:
    """Determine if retrieval is required (moved from Node's questionClassifier.js)."""
    # Doctrine and system questions bypass retrieval
    if question_type in ['DOCTRINE', 'SYSTEM']:
        return False
    
    # Offense questions may use predefined mappings
    if question_type == 'OFFENSE':
        return False  # Will use offense mapping
    
    # Normative questions require retrieval
    if question_type == 'NORMATIVE':
        return True
    
    # Questions with legal references require retrieval
    if has_reference:
        return True
    
    # General legal questions require retrieval
    return True

def resolve_authority(question: str) -> Dict[str, Any]:
    """
    Analyze a legal question and determine the applicable statute,
    article/paragraph, question type, complexity, language, and whether
    clarification is needed.
    """
    print(f'🔍 [Authority] Analyzing: "{question[:60]}..."')
    
    result = {
        'statute': None,
        'reference': None,
        'domain': None,
        'referenceType': None,
        'referenceSource': 'none',
        'confidence': 0,
        'requiresClarification': False,
        'clarification': None,
        'correctionNote': None,
        'doctrinal_match': False,
        # NEW FIELDS (moved from Node):
        'question_type': 'GENERAL',
        'complexity': 'medium',
        'language': 'english',
        'requiresRetrieval': True,
        'requiresExactReference': False,
        'requiresCitation': True,
        'requiresStatuteLock': False
    }
    
    # Step 1: Basic question classification (NEW)
    classification = _classify_question_type(question)
    result['question_type'] = classification['type']
    result['language'] = _detect_language(question)
    
    # Step 2: Determine applicable statute
    statute_result = lock_statute(question)
    
    if statute_result['status'] != 'LOCKED':
        result['requiresClarification'] = True
        result['clarification'] = statute_result.get('clarification')
        # Still set basic classification even if clarification needed
        result['complexity'] = _assess_complexity(question, result['question_type'])
        return result
    
    # Step 3: Set statute information
    result['statute'] = statute_result['statute']
    result['domain'] = statute_result['domain']
    result['confidence'] = statute_result['confidence']
    if 'correctionNote' in statute_result:
        result['correctionNote'] = statute_result['correctionNote']
    
    # Step 4: Assess complexity now that we know statute
    result['complexity'] = _assess_complexity(question, result['question_type'], result['statute'])
    
    # Step 5: Extract explicit reference
    explicit_reference = extract_explicit_reference(question)
    has_reference = False
    
    if explicit_reference:
        result['reference'] = explicit_reference['number']
        result['referenceType'] = explicit_reference['type']
        result['referenceSource'] = 'explicit'
        result['confidence'] = max(result['confidence'], 0.95)
        has_reference = True
        print(f'📖 [Authority] Explicit reference: {result["statute"]} §{result["reference"]}')
    
    # Step 6: Determine retrieval requirements
    result['requiresRetrieval'] = _determine_retrieval_requirement(result['question_type'], has_reference)
    
    # Step 7: Determine if exact reference is required
    result['requiresExactReference'] = (result['question_type'] == 'NORMATIVE') or has_reference
    
    # Step 8: Determine if citation is required
    result['requiresCitation'] = not (result['question_type'] in ['DOCTRINE', 'SYSTEM'])
    
    # Step 9: Determine if statute lock is required
    result['requiresStatuteLock'] = (
        result['question_type'] in ['NORMATIVE', 'OFFENSE', 'GENERAL', 'DEFINITION', 'COMPARISON', 'PROCEDURAL']
        and not result['statute']
    )
    
    # Step 10: GDPR-specific article inference
    if not has_reference and result['statute'] == 'EU-GDPR':
        inferred_article = infer_gdpr_article(question)
        if inferred_article:
            result['reference'] = inferred_article
            result['referenceType'] = 'ARTICLE'
            result['referenceSource'] = 'gdpr_rights_inferred'
            result['confidence'] = max(result['confidence'], 0.75)
            has_reference = True
            print(f'📖 [Authority] GDPR inference: Article {result["reference"]}')
    
    # Step 11: GDPR clarification path
    if not has_reference and result['statute'] == 'EU-GDPR':
        result['requiresClarification'] = True
        result['clarification'] = gdpr_clarification()
        print('📖 [Authority] GDPR clarification required')
        return result
    
    # Step 12: Criminal law paragraph inference
    if not has_reference and result['statute'] == 'StGB':
        inferred_paragraph = infer_criminal_paragraph(question)
        if inferred_paragraph:
            result['reference'] = inferred_paragraph
            result['referenceType'] = 'PARAGRAPH'
            result['referenceSource'] = 'inferred'
            
            # Calculate confidence for criminal inference
            base_confidence = result['confidence']
            
            # Check if this is a strong doctrinal match
            question_lower = question.lower()
            strong_criminal_keywords = [
                'theft', 'murder', 'fraud', 'robbery', 'assault',
                'manslaughter', 'burglary', 'drugs', 'drunk driving'
            ]
            
            is_strong_match = any(keyword in question_lower for keyword in strong_criminal_keywords)
            
            if is_strong_match:
                # Strong doctrinal matches get higher confidence
                result['confidence'] = min(base_confidence * 1.1, 0.88)
                result['doctrinal_match'] = True
                print(f'📖 [Authority] Criminal doctrinal inference: StGB §{result["reference"]} (strong match)')
            else:
                # Weaker matches get standard confidence
                result['confidence'] = min(base_confidence * 0.85, 0.85)
                print(f'📖 [Authority] Criminal inference: StGB §{result["reference"]}')
    
    # Step 13: Civil law paragraph inference
    if not has_reference and result['statute'] == 'BGB':
        inferred_paragraph = infer_civil_paragraph(question)
        if inferred_paragraph:
            result['reference'] = inferred_paragraph
            result['referenceType'] = 'PARAGRAPH'
            result['referenceSource'] = 'inferred'
            
            # Calculate confidence for civil inference
            base_confidence = result['confidence']
            
            # Check if this is a strong doctrinal match
            question_lower = question.lower()
            
            # Strong civil doctrinal keywords
            strong_civil_keywords = [
                'duty to compensate', 'liability for damage', 'delictual liability',
                'tort liability', 'unlawfully injures', 'breach of contract',
                'contract damages', 'sale of goods', 'good faith', 'obligations',
                'property rights'
            ]
            
            # Check for multi-word phrases first
            is_strong_match = False
            for phrase in strong_civil_keywords:
                if phrase in question_lower:
                    is_strong_match = True
                    break
            
            # Also check for single keywords that indicate strong doctrinal matches
            if not is_strong_match:
                strong_single_keywords = [
                    'compensate', 'damages', 'liability', 'tort', 'delict',
                    'contract', 'sale', 'property', 'obligation'
                ]
                is_strong_match = any(keyword in question_lower for keyword in strong_single_keywords)
            
            if is_strong_match:
                # Strong doctrinal civil matches get higher confidence
                result['confidence'] = min(base_confidence * 1.15, 0.92)
                result['doctrinal_match'] = True
                print(f'📖 [Authority] Civil doctrinal inference: BGB §{result["reference"]} (strong doctrinal match)')
            else:
                # Weaker civil matches get standard confidence
                result['confidence'] = min(base_confidence * 0.9, 0.85)
                print(f'📖 [Authority] Civil inference: BGB §{result["reference"]}')
    
    # Step 14: Set default if no reference found
    if not result['reference']:
        result['referenceSource'] = 'none'
        # GDPR requires article, others can proceed without paragraph
        if result['statute'] != 'EU-GDPR':
            result['referenceType'] = 'PARAGRAPH'  # Default for German codes
            print(f'📖 [Authority] No specific reference inferred for {result["statute"]}')
    
    print(f'🔍 [Authority] Complete: {result["statute"]} '
          f'{"§" + result["reference"] if result["reference"] else ""} '
          f'({result["question_type"]}, {result["complexity"]}, {result["language"]}) '
          f'(confidence: {result["confidence"]:.2f})')
    
    return result

def get_metrics() -> Dict[str, Any]:
    """Get service metrics for monitoring."""
    from .statute_patterns import STATUTE_PATTERNS
    from .inference.criminal import CRIMINAL_PARAGRAPH_MAP
    from .inference.civil import CIVIL_PARAGRAPH_MAP
    from .inference.gdpr import GDPR_ARTICLE_MAP
    from .doctrines import DOCTRINES
    
    return {
        'statutes': len(STATUTE_PATTERNS),
        'domains': 5,  # criminal, civil, commercial, constitutional, data_protection
        'criminalParagraphs': len(CRIMINAL_PARAGRAPH_MAP),
        'civilParagraphs': len(CIVIL_PARAGRAPH_MAP),
        'gdprArticles': len(GDPR_ARTICLE_MAP),
        'doctrines': len(DOCTRINES),
        'version': '1.1.0',  # Updated version
        'features': ['statute_detection', 'reference_inference', 'question_classification']
    }