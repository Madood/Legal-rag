import re

STATUTE_PATTERNS = {
    'StGB': {
        'patterns': [
            re.compile(r'\bStGB\b', re.I),
            re.compile(r'\bStGB\s+§', re.I),
            re.compile(r'\bstrafgesetzbuch\b', re.I),
            re.compile(r'\bcriminal\s+code\b', re.I),
            re.compile(r'\bpenal\s+code\b', re.I),
            re.compile(r'\bstrafrecht\b', re.I),
            re.compile(r'\bcriminal\s+law\b', re.I),
            re.compile(r'§\s*\d+\s*(?:StGB|stgb)', re.I),
            re.compile(r'§\s*\d+\s*.*criminal', re.I),
            re.compile(r'§\s*\d+\s*.*penal', re.I)
        ],
        'domain': 'criminal',
        'displayName': 'Strafgesetzbuch (German Criminal Code)',
        'keywords': ['straf', 'criminal', 'penal', 'theft', 'murder', 'robbery', 
                    'prison', 'sentence', 'punishment', 'offense', 'crime']
    },
    
    'BGB': {
        'patterns': [
            re.compile(r'\bBGB\b', re.I),
            re.compile(r'\bBGB\s+§', re.I),
            re.compile(r'\bbürgerliches\s+gesetzbuch\b', re.I),
            re.compile(r'\bcivil\s+code\b', re.I),
            re.compile(r'§\s*\d+\s*(?:BGB|bgb)', re.I),
            re.compile(r'§\s*\d+\s*.*civil', re.I)
        ],
        'domain': 'civil',
        'displayName': 'Bürgerliches Gesetzbuch (German Civil Code)',
        'keywords': ['civil', 'contract', 'obligation', 'property', 'damages', 
                    'liability', 'family', 'inheritance', 'tort', 'compensation']
    },
    
    'HGB': {
        'patterns': [
            re.compile(r'\bHGB\b', re.I),
            re.compile(r'\bHGB\s+§', re.I),
            re.compile(r'\bhandelsgesetzbuch\b', re.I),
            re.compile(r'\bcommercial\s+code\b', re.I),
            re.compile(r'§\s*\d+\s*(?:HGB|hgb)', re.I),
            re.compile(r'§\s*\d+\s*.*commercial', re.I)
        ],
        'domain': 'commercial',
        'displayName': 'Handelsgesetzbuch (German Commercial Code)',
        'keywords': ['commercial', 'merchant', 'trade', 'business', 'company', 
                    'firm', 'register', 'commerce', 'mercantile']
    },
    
    'GG': {
        'patterns': [
            re.compile(r'\bGG\b', re.I),
            re.compile(r'\bgrundgesetz\b', re.I),
            re.compile(r'\bconstitution\b', re.I),
            re.compile(r'\bbasic\s+law\b', re.I),
            re.compile(r'Artikel\s*\d+\s*(?:GG|gg)', re.I),
            re.compile(r'Article\s*\d+\s*.*constitution', re.I)
        ],
        'domain': 'constitutional',
        'displayName': 'Grundgesetz (German Basic Law)',
        'keywords': ['constitution', 'basic law', 'grundrecht', 'freedom', 
                    'democracy', 'state', 'fundamental', 'right', 'charter']
    },
    
    'EU-GDPR': {
        'patterns': [
            re.compile(r'\bGDPR\b', re.I),
            re.compile(r'\bDSGVO\b', re.I),
            re.compile(r'\bdatenschutz-grundverordnung\b', re.I),
            re.compile(r'\bgeneral\s+data\s+protection\s+regulation\b', re.I),
            re.compile(r'Article\s*\d+\s*(?:GDPR|gdpr)', re.I),
            re.compile(r'Artikel\s*\d+\s*(?:DSGVO|gdpr)', re.I)
        ],
        'domain': 'data_protection',
        'displayName': 'EU-Datenschutz-Grundverordnung (GDPR)',
        'keywords': [
            'data protection', 'privacy', 'personal data', 'processing', 'consent',
            'right of access', 'right to erasure', 'right to rectification',
            'right to portability', 'right to object', 'right to restriction',
            'data subject', 'controller', 'processor', 'supervisory authority',
            'data breach', 'data minimization', 'purpose limitation',
            'auskunftsrecht', 'löschungsrecht', 'berichtigungsrecht',
            'datenübertragbarkeit', 'widerspruchsrecht', 'einschränkung',
            'betroffener', 'verantwortlicher', 'aufsichtsbehörde', 'datenschutzverletzung'
        ]
    }
}

def get_available_statutes():
    """Get available statutes and their domains."""
    statutes = {}
    for statute, config in STATUTE_PATTERNS.items():
        statutes[statute] = {
            'displayName': config['displayName'],
            'domain': config['domain']
        }
    return statutes