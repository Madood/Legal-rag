from .statute_Profile import STATUTE_PATTERNS
from .reference_extractor import extract_explicit_reference

def validate_answer(question: str, answer: str, statute: str) -> dict:
    """Validate an answer against the question's legal context."""
    lower_question = question.lower()
    lower_answer = answer.lower()
    
    validations = []
    
    # Check statute consistency
    config = STATUTE_PATTERNS.get(statute)
    if config:
        missing_keywords = []
        for keyword in config['keywords']:
            if keyword in lower_question and keyword not in lower_answer:
                missing_keywords.append(keyword)
        
        if missing_keywords:
            validations.append({
                'isValid': False,
                'severity': 'warning',
                'reason': f'Answer missing relevant legal terminology: {", ".join(missing_keywords[:3])}',
                'recommendation': 'Include domain-specific legal terms'
            })
    
    # Check for statute mention
    if statute and statute.lower() not in lower_answer:
        validations.append({
            'isValid': False,
            'severity': 'error',
            'reason': f'Answer does not cite the governing statute ({statute})',
            'recommendation': f'Include {statute} reference in answer'
        })
    
    # Check for paragraph/article reference if present in question
    question_ref = extract_explicit_reference(question)
    if question_ref and question_ref['number'] not in lower_answer:
        validations.append({
            'isValid': False,
            'severity': 'warning',
            'reason': f'Answer does not reference {question_ref["type"].lower()} from question ({question_ref["number"]})',
            'recommendation': f'Include reference to {question_ref["number"]}'
        })
    
    if not validations:
        return {
            'isValid': True,
            'message': 'Answer validated against legal authority'
        }
    
    has_error = any(v['severity'] == 'error' for v in validations)
    
    return {
        'isValid': not has_error,
        'validations': validations,
        'message': 'Answer failed legal authority validation' if has_error else 'Answer validated with warnings'
    }