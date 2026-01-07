# StGB offense → paragraph mapping
CRIMINAL_PARAGRAPH_MAP = {
    'theft': {'paragraph': '242', 'offenses': ['theft', 'stealing', 'steal', 'diebstahl']},
    'fraud': {'paragraph': '263', 'offenses': ['fraud', 'scam', 'deception', 'betrug']},
    'robbery': {'paragraph': '249', 'offenses': ['robbery', 'mugging', 'raub']},
    'murder': {'paragraph': '211', 'offenses': ['murder', 'homicide', 'mord']},
    'manslaughter': {'paragraph': '212', 'offenses': ['manslaughter', 'killing', 'totschlag']},
    'assault': {'paragraph': '223', 'offenses': ['assault', 'battery', 'körperverletzung']},
    'coercion': {'paragraph': '240', 'offenses': ['coercion', 'nötigung']},
    'blackmail': {'paragraph': '253', 'offenses': ['blackmail', 'erpressung']},
    'burglary': {'paragraph': '244', 'offenses': ['burglary', 'einbruch']},
    'drugs': {'paragraph': '29', 'offenses': ['drugs', 'narcotics', 'drogen']},
    'drunk driving': {'paragraph': '316', 'offenses': ['drunk driving', 'dui', 'trunkenheit']}
}

def infer_criminal_paragraph(question: str) -> str:
    """Infer StGB paragraph from offense keywords."""
    lower_question = question.lower()
    
    for offense, data in CRIMINAL_PARAGRAPH_MAP.items():
        for keyword in data['offenses']:
            if keyword in lower_question:
                return data['paragraph']
    
    return None