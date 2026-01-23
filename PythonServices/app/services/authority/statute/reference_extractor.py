import re
from typing import Dict, Optional

def extract_explicit_reference(question: str) -> Optional[Dict[str, str]]:
    """Extract explicit legal reference (paragraph or article) from question."""
    # Match German paragraph: § 242 or §242
    paragraph_match = re.search(r'§\s*(\d+[a-z]?)', question, re.I)
    if paragraph_match:
        return {
            'number': paragraph_match.group(1),
            'type': 'PARAGRAPH'
        }
    
    # Match "paragraph 242" format
    paragraph_word_match = re.search(r'(?:paragraph|paragraf|para)\s+(\d+[a-z]?)', question, re.I)
    if paragraph_word_match:
        return {
            'number': paragraph_word_match.group(1),
            'type': 'PARAGRAPH'
        }
    
    # Match article: Article 15 or Artikel 15
    article_match = re.search(r'(?:article|artikel)\s+(\d+[a-z]?)', question, re.I)
    if article_match:
        return {
            'number': article_match.group(1),
            'type': 'ARTICLE'
        }
    
    return None