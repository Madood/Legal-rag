# BGB civil topic → paragraph mapping
CIVIL_PARAGRAPH_MAP = {
    'contract_formation': {
        'paragraph': '311', 
        'offenses': ['contract', 'vertrag', 'agreement', 'formation', 'obligation'],
        'doctrine': 'contract formation'
    },
    'damages_liability': {
        'paragraph': '823', 
        'offenses': [
            'damages', 'schaden', 'liability', 'compensate', 'compensation',
            'duty to compensate', 'tort liability', 'unlawfully injures',
            'negligently injures', 'delictual liability', 'haftung',
            'injury', 'harm', 'loss', 'damage claim'
        ],
        'doctrine': 'delictual liability (§ 823)'
    },
    'contract_damages': {
        'paragraph': '280', 
        'offenses': [
            'breach of contract', 'contract damages', 'contractual liability',
            'non-performance', 'performance failure', 'contract breach',
            'default', 'mangelhafte leistung'
        ],
        'doctrine': 'damages for breach of contract (§ 280)'
    },
    'property_rights': {
        'paragraph': '903', 
        'offenses': ['property', 'eigentum', 'ownership', 'possess', 'possession'],
        'doctrine': 'property rights'
    },
    'sale_of_goods': {
        'paragraph': '433', 
        'offenses': [
            'sale', 'kauf', 'purchase', 'buy', 'seller', 'buyer',
            'sale contract', 'purchase agreement', 'goods', 'ware'
        ],
        'doctrine': 'contract of sale (§ 433)'
    },
    'marriage': {
        'paragraph': '1353', 
        'offenses': ['marriage', 'ehe', 'spouse', 'married', 'marital'],
        'doctrine': 'marriage obligations'
    },
    'inheritance': {
        'paragraph': '1922', 
        'offenses': ['inheritance', 'erbschaft', 'inherit', 'heir', 'will', 'testament'],
        'doctrine': 'inheritance'
    },
    'general_obligations': {
        'paragraph': '241', 
        'offenses': [
            'obligation', 'verpflichtung', 'duty', 'obligations', 
            'general duty', 'general obligation'
        ],
        'doctrine': 'general obligations (§ 241)'
    },
    'good_faith': {
        'paragraph': '242', 
        'offenses': [
            'good faith', 'treu und glauben', 'fair dealing', 'honesty',
            'loyalty', 'trust', 'reliance'
        ],
        'doctrine': 'performance according to good faith (§ 242)'
    }
}

def infer_civil_paragraph(question: str) -> str:
    """Infer BGB paragraph from topic keywords and legal concepts."""
    lower_question = question.lower()
    
    # Track all matches for potential ranking
    matches = []
    
    for topic, data in CIVIL_PARAGRAPH_MAP.items():
        for keyword in data['offenses']:
            if keyword in lower_question:
                # Calculate match quality
                quality_score = 1.0
                
                # Boost for complete phrase matches
                if len(keyword.split()) > 1 and keyword in lower_question:
                    quality_score *= 1.5
                
                matches.append({
                    'paragraph': data['paragraph'],
                    'topic': topic,
                    'doctrine': data.get('doctrine', ''),
                    'quality': quality_score,
                    'matched_keyword': keyword
                })
    
    # Return the best match
    if matches:
        # Sort by quality score (highest first)
        matches.sort(key=lambda x: x['quality'], reverse=True)
        best_match = matches[0]
        
        print(f"📚 Civil inference matched '{best_match['matched_keyword']}' to BGB §{best_match['paragraph']} ({best_match['doctrine']})")
        return best_match['paragraph']
    
    # Additional contextual inference for specific legal phrases
    if 'duty to' in lower_question:
        if 'compensate' in lower_question or 'damage' in lower_question:
            print("📚 Civil inference: 'duty to compensate' → BGB §823 (delictual liability)")
            return '823'
    
    if 'liability for' in lower_question and ('damage' in lower_question or 'harm' in lower_question):
        print("📚 Civil inference: 'liability for damage' → BGB §823")
        return '823'
    
    if 'tort' in lower_question:
        print("📚 Civil inference: 'tort' → BGB §823 (German equivalent: Deliktsrecht)")
        return '823'
    
    return None