"""
Authority Filters - Validates source consistency.
Pure cross-source validation with no statute internals.
"""

from typing import Dict, Any

def validate_statute_consistency(statute: str, question: str) -> Dict[str, Any]:
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

def score_question_domain(question: str) -> Dict[str, float]:
    """
    Score the question across different legal domains.
    Returns confidence scores for each statute.
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