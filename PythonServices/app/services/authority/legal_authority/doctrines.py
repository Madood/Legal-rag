# Legal doctrines/principles
DOCTRINES = {
    'schuldprinzip': {
        'type': 'PRINCIPLE',
        'domain': 'criminal',
        'explanation': {
            'german': """**Das Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Rechtsnatur:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB).""",
            'english': """**The Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Legal Nature:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB)."""
        },
        'sources': ['GG Art. 1', 'GG Art. 20', 'StGB implied']
    },
    'verhältnismäßigkeitsprinzip': {
        'type': 'PRINCIPLE',
        'domain': 'constitutional',
        'explanation': {
            'german': 'Das Verhältnismäßigkeitsprinzip verlangt, dass staatliche Maßnahmen geeignet, erforderlich und angemessen sein müssen.',
            'english': 'The proportionality principle requires that state measures must be suitable, necessary, and appropriate.'
        },
        'sources': ['GG Art. 20']
    }
}

def get_doctrine_explanation(doctrine_name: str, language: str = 'german'):
    """Get doctrine/principle explanation."""
    doctrine = DOCTRINES.get(doctrine_name.lower())
    
    if not doctrine:
        return None
    
    return {
        'type': doctrine['type'],
        'domain': doctrine['domain'],
        'explanation': doctrine['explanation'].get(language, doctrine['explanation']['german']),
        'sources': doctrine['sources']
    }