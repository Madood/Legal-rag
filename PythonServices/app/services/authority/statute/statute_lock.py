"""statute_lock.py - Statute locking logic for legal authority resolution."""

import re
from typing import Dict, Any, Optional
from .statute_Profile import STATUTE_PATTERNS

def _validate_statute_consistency(statute: str, question: str) -> Dict[str, Any]:
    """Validate statute consistency with question content."""
    lower_question = question.lower()
    
    # GDPR must not contain criminal law terms
    if statute == 'EU-GDPR':
        criminal_terms = [
            'theft', 'fraud', 'murder', 'robbery', 'assault', 'prison',
            'sentence', 'punishment', 'criminal', 'straf', 'stgb'
        ]
        
        for term in criminal_terms:
            if term in lower_question:
                return {
                    'isValid': False,
                    'recommendedStatute': 'StGB',
                    'reason': 'GDPR questions should not contain criminal law terminology'
                }
    
    # StGB must not contain GDPR/data protection terms
    if statute == 'StGB':
        gdpr_terms = [
            'data protection', 'privacy', 'right of access', 'right to erasure',
            'data subject', 'gdpr', 'dsgvo', 'article'
        ]
        
        for term in gdpr_terms:
            if term in lower_question:
                return {
                    'isValid': False,
                    'recommendedStatute': 'EU-GDPR',
                    'reason': 'Criminal law questions should not contain GDPR terminology'
                }
    
    return {'isValid': True}

def _infer_statute_from_paragraph(question: str) -> Optional[Dict[str, Any]]:
    """
    Infer statute from paragraph number and context.
    
    IMPORTANT: Paragraph-range inference is the LAST fallback.
    It must only apply when NO competing statute signals exist.
    """
    paragraph_match = re.search(r'§\s*(\d+[a-z]?)', question, re.I)
    if not paragraph_match:
        return None
    
    paragraph = paragraph_match.group(1)
    try:
        num = int(re.sub(r'[a-z]', '', paragraph))
    except ValueError:
        return None
    
    lower_question = question.lower()
    
    # Check context for statute hints (this is reliable)
    if 'stgb' in lower_question or 'criminal' in lower_question:
        return {
            'status': 'LOCKED',
            'statute': 'StGB',
            'domain': 'criminal',
            'source': 'paragraph_context',
            'confidence': 0.85
        }
    
    if 'bgb' in lower_question or 'civil' in lower_question:
        return {
            'status': 'LOCKED',
            'statute': 'BGB',
            'domain': 'civil',
            'source': 'paragraph_context',
            'confidence': 0.85
        }
    
    if 'gdpr' in lower_question or 'data protection' in lower_question:
        return {
            'status': 'LOCKED',
            'statute': 'EU-GDPR',
            'domain': 'data_protection',
            'source': 'paragraph_context',
            'confidence': 0.85
        }
    
    # Paragraph-range inference is DEMOTED - only as last resort
    # Check if we have ANY competing signals first
    # (This check happens in the caller - see lock_statute logic below)
    
    # IMPORTANT: Only apply range inference if explicitly called as last fallback
    if 1 <= num <= 358:  # StGB range
        return {
            'status': 'LOCKED',
            'statute': 'StGB',
            'domain': 'criminal',
            'source': 'paragraph_range_last_resort',
            'confidence': 0.45,  # Lower confidence for pure range inference
            'note': 'Range inference only - no competing signals detected'
        }
    
    if 1 <= num <= 2385:  # BGB range
        return {
            'status': 'LOCKED',
            'statute': 'BGB',
            'domain': 'civil',
            'source': 'paragraph_range_last_resort',
            'confidence': 0.45,
            'note': 'Range inference only - no competing signals detected'
        }
    
    return None

def _infer_statute_doctrinally(question: str) -> Optional[Dict[str, Any]]:
    """
    Doctrinal statute inference for questions about legal governance.
    
    This handles cases like:
    - "What German law governs treason?" → StGB
    - "Which statute covers contracts?" → BGB
    - "What law regulates data protection?" → EU-GDPR
    
    IMPORTANT: Only invoked when governance language exists.
    """
    lower_question = question.lower()
    
    # Check for governance/regulation language
    governance_terms = [
        'governs', 'govern', 'governing', 'covers', 'covers the law',
        'regulates', 'regulate', 'regulating', 'law for', 'law that governs',
        'which law', 'what law', 'statute for', 'statute that covers',
        'legal framework for', 'applicable law for'
    ]
    
    has_governance_language = any(term in lower_question for term in governance_terms)
    
    if not has_governance_language:
        return None
    
    # Criminal law domain inference
    criminal_offenses = [
        'treason', 'murder', 'theft', 'robbery', 'fraud', 'assault',
        'burglary', 'rape', 'kidnapping', 'manslaughter', 'homicide',
        'criminal damage', 'forgery', 'blackmail', 'extortion',
        'hochverrat', 'landesverrat', 'mord', 'diebstahl', 'betrug',
        'raub', 'körperverletzung', 'vergewaltigung'
    ]
    
    for offense in criminal_offenses:
        if offense in lower_question:
            return {
                'status': 'LOCKED',
                'statute': 'StGB',
                'domain': 'criminal',
                'source': 'doctrinal_inference_criminal',
                'confidence': 0.75,
                'inference_reason': f'Question about governance of criminal offense: {offense}'
            }
    
    # Civil law domain inference
    civil_matters = [
        'contract', 'contracts', 'agreement', 'obligation', 'property',
        'inheritance', 'tort', 'damages', 'liability', 'compensation',
        'marriage', 'divorce', 'family law', 'child custody',
        'vertrag', 'verträge', 'eigentum', 'erbrecht', 'haftung',
        'schadensersatz', 'familienrecht'
    ]
    
    for matter in civil_matters:
        if matter in lower_question:
            return {
                'status': 'LOCKED',
                'statute': 'BGB',
                'domain': 'civil',
                'source': 'doctrinal_inference_civil',
                'confidence': 0.70,
                'inference_reason': f'Question about governance of civil matter: {matter}'
            }
    
    # Commercial law domain inference
    commercial_matters = [
        'merchant', 'company', 'corporation', 'partnership', 'commerce',
        'trade', 'commercial transaction', 'banking', 'insurance',
        'bankruptcy', 'insolvency', 'commercial register',
        'kaufmann', 'handelsregister', 'handelsgeschäft', 'gesellschaft',
        'firma', 'insolvenz'
    ]
    
    for matter in commercial_matters:
        if matter in lower_question:
            return {
                'status': 'LOCKED',
                'statute': 'HGB',
                'domain': 'commercial',
                'source': 'doctrinal_inference_commercial',
                'confidence': 0.70,
                'inference_reason': f'Question about governance of commercial matter: {matter}'
            }
    
    # Constitutional law domain inference
    constitutional_matters = [
        'constitution', 'constitutional', 'fundamental right', 'human right',
        'human dignity', 'freedom', 'democracy', 'rule of law',
        'separation of powers', 'federalism', 'state organization',
        'grundgesetz', 'verfassung', 'grundrecht', 'menschenwürde',
        'freiheit', 'demokratie', 'rechtsstaat'
    ]
    
    for matter in constitutional_matters:
        if matter in lower_question:
            return {
                'status': 'LOCKED',
                'statute': 'GG',
                'domain': 'constitutional',
                'source': 'doctrinal_inference_constitutional',
                'confidence': 0.75,
                'inference_reason': f'Question about governance of constitutional matter: {matter}'
            }
    
    # Data protection domain inference
    data_protection_terms = [
        'data protection', 'privacy', 'personal data', 'data subject',
        'consent', 'data processing', 'data breach', 'data transfer',
        'datenschutz', 'privatsphäre', 'personenbezogene daten',
        'betroffene person', 'einwilligung'
    ]
    
    for term in data_protection_terms:
        if term in lower_question:
            return {
                'status': 'LOCKED',
                'statute': 'EU-GDPR',
                'domain': 'data_protection',
                'source': 'doctrinal_inference_gdpr',
                'confidence': 0.80,
                'inference_reason': f'Question about governance of data protection: {term}'
            }
    
    return None

def _score_question_domain(question: str) -> Dict[str, float]:
    """
    Score the question across different legal domains.
    Returns confidence scores for each statute.
    
    IMPORTANT: Domain scoring is PROBABILISTIC only.
    It must NEVER hard-lock statutes at low confidence.
    """
    lower_question = question.lower()
    domain_scores = {
        'StGB': 0.0,
        'BGB': 0.0,
        'HGB': 0.0,
        'GG': 0.0,
        'EU-GDPR': 0.0
    }
    
    # Criminal law indicators
    criminal_indicators = {
        'treason': 0.9, 'murder': 0.9, 'theft': 0.8, 'robbery': 0.8,
        'fraud': 0.7, 'assault': 0.7, 'criminal': 0.6, 'crime': 0.6,
        'offense': 0.6, 'punishment': 0.6, 'sentence': 0.5, 'prison': 0.5,
        'hochverrat': 0.9, 'landesverrat': 0.9, 'mord': 0.9, 'diebstahl': 0.8,
        'betrug': 0.7, 'straf': 0.6
    }
    
    for indicator, weight in criminal_indicators.items():
        if indicator in lower_question:
            domain_scores['StGB'] += weight
    
    # Civil law indicators
    civil_indicators = {
        'contract': 0.8, 'agreement': 0.7, 'property': 0.7, 'inheritance': 0.7,
        'damages': 0.6, 'liability': 0.6, 'compensation': 0.6, 'tort': 0.7,
        'family': 0.6, 'marriage': 0.6, 'divorce': 0.6, 'child': 0.5,
        'vertrag': 0.8, 'eigentum': 0.7, 'erbrecht': 0.7, 'haftung': 0.6,
        'schaden': 0.6
    }
    
    for indicator, weight in civil_indicators.items():
        if indicator in lower_question:
            domain_scores['BGB'] += weight
    
    # Commercial law indicators
    commercial_indicators = {
        'merchant': 0.8, 'company': 0.7, 'commerce': 0.7, 'trade': 0.7,
        'business': 0.6, 'commercial': 0.7, 'partnership': 0.7, 'corporation': 0.7,
        'kaufmann': 0.8, 'handel': 0.7, 'geschäft': 0.6, 'gesellschaft': 0.7,
        'firma': 0.7
    }
    
    for indicator, weight in commercial_indicators.items():
        if indicator in lower_question:
            domain_scores['HGB'] += weight
    
    # Constitutional law indicators
    constitutional_indicators = {
        'constitution': 0.8, 'constitutional': 0.8, 'fundamental right': 0.9,
        'human right': 0.8, 'human dignity': 0.9, 'freedom': 0.7,
        'democracy': 0.7, 'rule of law': 0.8, 'state': 0.6, 'government': 0.6,
        'grundgesetz': 0.9, 'verfassung': 0.8, 'grundrecht': 0.9,
        'menschenwürde': 0.9, 'freiheit': 0.7, 'demokratie': 0.7
    }
    
    for indicator, weight in constitutional_indicators.items():
        if indicator in lower_question:
            domain_scores['GG'] += weight
    
    # Data protection indicators
    gdpr_indicators = {
        'data protection': 0.9, 'privacy': 0.8, 'personal data': 0.8,
        'data subject': 0.7, 'consent': 0.6, 'data processing': 0.7,
        'gdpr': 0.9, 'dsgvo': 0.9, 'datenschutz': 0.9, 'privatsphäre': 0.8,
        'personenbezogen': 0.8, 'einwilligung': 0.6
    }
    
    for indicator, weight in gdpr_indicators.items():
        if indicator in lower_question:
            domain_scores['EU-GDPR'] += weight
    
    # Normalize scores to 0-1 range
    max_score = max(domain_scores.values())
    if max_score > 0:
        for statute in domain_scores:
            domain_scores[statute] = min(1.0, domain_scores[statute] / max_score)
    
    return domain_scores

def lock_statute(question: str) -> Dict[str, Any]:
    """
    Determine applicable statute for a legal question.
    
    ARCHITECTURAL INVARIANTS:
    1. Paragraph-range inference is the LAST fallback, not an equal fallback
    2. Domain scoring must never hard-LOCK at low confidence (0.4 threshold removed)
    3. Doctrinal inference is conditional on governance language
    4. Cross-domain contamination is actively prevented
    """
    lower_question = question.lower()
    statute_scores = {}
    
    # ==============================================
    # LAYER 1: Explicit patterns (highest priority)
    # ==============================================
    for statute, config in STATUTE_PATTERNS.items():
        score = 0
        
        # Pattern matches (highest weight)
        for pattern in config['patterns']:
            if pattern.search(question):
                score += 10
        
        # Keyword matches
        for keyword in config['keywords']:
            if keyword.lower() in lower_question:
                score += 3
        
        # GDPR-specific boosts and penalties
        if statute == 'EU-GDPR':
            # Boost for rights language
            rights_terms = [
                'right of access', 'right to erasure', 'right to rectification',
                'right to portability', 'data subject', 'supervisory authority'
            ]
            
            for term in rights_terms:
                if term in lower_question:
                    score += 15
            
            # Penalty for criminal contamination
            criminal_terms = ['theft', 'fraud', 'murder', 'robbery', 'prison', 'punishment']
            for term in criminal_terms:
                if term in lower_question:
                    score -= 10
        
        if score > 0:
            statute_scores[statute] = {
                'score': score,
                'domain': config['domain'],
                'displayName': config['displayName']
            }
    
    # Find highest scoring statute
    best_statute = None
    best_score = 0
    best_data = None
    
    for statute, data in statute_scores.items():
        if data['score'] > best_score:
            best_score = data['score']
            best_statute = statute
            best_data = data
    
    # Validate field consistency
    if best_statute:
        validation = _validate_statute_consistency(best_statute, question)
        if not validation['isValid']:
            recommended_config = STATUTE_PATTERNS.get(validation['recommendedStatute'])
            if recommended_config:
                return {
                    'status': 'LOCKED',
                    'statute': validation['recommendedStatute'],
                    'domain': recommended_config['domain'],
                    'source': 'field_correction',
                    'confidence': 0.8,
                    'correctionNote': validation['reason']
                }
    
    # Determine result based on score
    if best_statute and best_score >= 10:
        # High confidence (pattern matched)
        return {
            'status': 'LOCKED',
            'statute': best_statute,
            'domain': best_data['domain'],
            'source': 'explicit',
            'confidence': min(1.0, best_score / 20)
        }
    elif best_statute and best_score >= 3:
        # Medium confidence (keywords only)
        return {
            'status': 'LOCKED',
            'statute': best_statute,
            'domain': best_data['domain'],
            'source': 'implicit',
            'confidence': min(0.7, best_score / 10)
        }
    
    # ==============================================
    # LAYER 2: Paragraph-based inference
    # Only apply if NO explicit/pattern signals above
    # ==============================================
    paragraph_statute = _infer_statute_from_paragraph(question)
    if paragraph_statute:
        # IMPORTANT: Check if paragraph-range is our source
        if paragraph_statute.get('source') == 'paragraph_range_last_resort':
            # This is pure range inference - we need to be careful
            
            # Check if we have ANY competing signals from doctrinal inference
            doctrinal_statute = _infer_statute_doctrinally(question)
            if doctrinal_statute:
                # Doctrinal inference OVERRIDES pure paragraph-range
                return doctrinal_statute
            
            # Also check domain scoring as weak signal
            domain_scores = _score_question_domain(question)
            best_domain = max(domain_scores.items(), key=lambda x: x[1])
            
            if best_domain[1] > 0.6:  # Strong domain signal
                statute = best_domain[0]
                config = STATUTE_PATTERNS.get(statute)
                if config:
                    return {
                        'status': 'LOCKED',
                        'statute': statute,
                        'domain': config['domain'],
                        'source': 'domain_override_range',
                        'confidence': best_domain[1] * 0.8,  # Penalize for range conflict
                        'inference_reason': f'Domain scoring overrides paragraph-range inference'
                    }
        
        # Otherwise, return the paragraph inference (including contextual)
        return paragraph_statute
    
    # ==============================================
    # LAYER 3: Doctrinal inference (governance questions)
    # ==============================================
    doctrinal_statute = _infer_statute_doctrinally(question)
    if doctrinal_statute:
        return doctrinal_statute
    
    # ==============================================
    # LAYER 4: Domain scoring as WEAK signal only
    # ==============================================
    domain_scores = _score_question_domain(question)
    best_domain = max(domain_scores.items(), key=lambda x: x[1])
    
    # CRITICAL CHANGE: Domain scoring NEVER hard-locks at low confidence
    # Instead, it suggests possible statute with intermediate authority
    if best_domain[1] >= 0.6:  # Higher threshold, still not hard-lock
        statute = best_domain[0]
        config = STATUTE_PATTERNS.get(statute)
        if config:
            return {
                'status': 'LOCKED',
                'statute': statute,
                'domain': config['domain'],
                'source': 'domain_scoring_suggestive',
                'confidence': best_domain[1] * 0.7,  # Penalized confidence
                'inference_reason': f'Domain scoring suggests {statute}, but not definitive'
            }
    
    # ==============================================
    # LAYER 5: Cannot determine statute
    # ==============================================
    from ..legal_authority.clarifications import missing_statute_clarification
    return {
        'status': 'MISSING',
        'clarification': missing_statute_clarification(question)
    }

def get_statute_lock_state(statute: str, has_reference: bool) -> Dict[str, bool]:
    """
    Determine lock states for statute and paragraph.
    Supports the new intermediate state.
    """
    if not statute:
        return {'statuteLocked': False, 'paragraphLocked': False}
    
    if has_reference:
        return {'statuteLocked': True, 'paragraphLocked': True}
    
    # BGB-specific: statute locked, paragraph open for anchor norm questions
    if statute == 'BGB':
        return {'statuteLocked': True, 'paragraphLocked': False}
    
    # Other statutes require both to be locked or clarification
    return {'statuteLocked': True, 'paragraphLocked': False}