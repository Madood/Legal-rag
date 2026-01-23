"""
Source Classifier - Classifies questions for authority determination.
Pure question analysis with no content selection.
"""

import re
from typing import Dict, Any

def classify_question_type(question: str) -> Dict[str, Any]:
    """Classify question type for authority determination."""
    lower_question = question.lower()
    
    # Question type patterns
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
            r'§\s*\d', r'artikel\s*\d', r'article\s*\d',
            r'paragraph\s*\d', r'section\s*\d',
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

def assess_complexity(question: str, question_type: str, statute: str = None) -> str:
    """Assess question complexity for authority determination."""
    lower_question = question.lower()
    complexity = 'medium'  # Default
    
    # Complexity indicators
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

def detect_language(question: str) -> str:
    """Detect question language."""
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

def determine_retrieval_requirement(question_type: str, has_reference: bool) -> bool:
    """Determine if retrieval is required."""
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