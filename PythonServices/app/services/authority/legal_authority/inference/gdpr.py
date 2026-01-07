import re

# GDPR rights → article mapping
GDPR_ARTICLE_MAP = {
    'right of access': {'article': '15', 'keywords': ['access', 'auskunft', 'access right', 'recht auf auskunft', 'right of access']},
    'right to rectification': {'article': '16', 'keywords': ['rectification', 'berichtigung', 'correct', 'accurate', 'right to rectification']},
    'right to erasure': {'article': '17', 'keywords': ['erasure', 'löschung', 'delete', 'remove', 'forget', 'right to be forgotten', 'right to erasure']},
    'right to restriction': {'article': '18', 'keywords': ['restriction', 'einschränkung', 'limit processing', 'right to restriction']},
    'right to portability': {'article': '20', 'keywords': ['portability', 'übertragbarkeit', 'data portability', 'transfer', 'right to portability']},
    'right to object': {'article': '21', 'keywords': ['object', 'widerspruch', 'objection', 'opt-out', 'right to object']},
    'principles': {'article': '5', 'keywords': ['principles', 'grundsätze', 'lawfulness', 'fairness', 'transparency', 'data processing principles']},
    'lawful basis': {'article': '6', 'keywords': ['lawful basis', 'legal basis', 'rechtmäßigkeit', 'consent', 'contract', 'legitimate interest']},
    'consent': {'article': '7', 'keywords': ['consent', 'einwilligung', 'agreement', 'permission', 'informed consent']},
    'data breach': {'article': '33', 'keywords': ['data breach', 'datenschutzverletzung', 'breach notification', 'security incident', 'personal data breach']}
}

def infer_gdpr_article(question: str) -> str:
    """Infer GDPR article from rights and topic keywords."""
    lower_question = question.lower()
    
    for right, data in GDPR_ARTICLE_MAP.items():
        for keyword in data['keywords']:
            if keyword.lower() in lower_question:
                return data['article']
    
    # Check for explicit article reference
    article_match = re.search(r'(?:article|artikel)\s+(\d+)', lower_question)
    if article_match:
        return article_match.group(1)
    
    return None