"""
Question-type specific filtering rules.
"""
from typing import List, Dict, Any

def apply_question_type_rules(documents: List[Dict[str, Any]], 
                             question_type: str, statute: str) -> List[Dict[str, Any]]:
    """Apply question-type specific filtering rules."""
    print(f'[Authority] Applying {question_type} rules for {statute}')
    
    filtered_docs = []
    
    for doc in documents:
        source_type = doc.get('authority_metadata', {}).get('source_type')
        authority_rank = doc.get('authority_metadata', {}).get('authority_rank', 100)
        has_normative = doc.get('authority_metadata', {}).get('has_normative_content', False)
        paragraph_count = doc.get('authority_metadata', {}).get('paragraph_count', 0)
        
        if _should_include_document(doc, question_type, statute):
            filtered_docs.append(doc)
    
    print(f'[Authority] Filtered to {len(filtered_docs)} documents for {question_type}')
    return filtered_docs

def _should_include_document(doc: Dict[str, Any], question_type: str, 
                            statute: str) -> bool:
    """Determine if document should be included based on question type."""
    source_type = doc.get('authority_metadata', {}).get('source_type')
    authority_rank = doc.get('authority_metadata', {}).get('authority_rank', 100)
    has_normative = doc.get('authority_metadata', {}).get('has_normative_content', False)
    paragraph_count = doc.get('authority_metadata', {}).get('paragraph_count', 0)
    
    if question_type == 'NORMATIVE':
        # §280 BGB - ONLY official German text or EU English
        return (source_type == 'official_statute_de' or
                (statute == 'EU-GDPR' and source_type == 'official_eu_en'))
    
    elif question_type == 'DEFINITION':
        # Can use translations if German not available
        return authority_rank <= 5
    
    elif question_type == 'DOCTRINE':
        # Use doctrine only
        return source_type == 'doctrine_commentary'
    
    elif question_type == 'OFFENSE':
        # Criminal law - German official only
        return source_type == 'official_statute_de'
    
    elif question_type == 'GENERAL_STATUTE':
        # General questions about a statute
        return doc.get('authority_metadata', {}).get('is_authoritative', False)
    
    elif question_type == 'SYSTEM':
        # Legal system questions - use any authoritative
        return authority_rank <= 7
    
    elif statute == 'HGB' and question_type == 'NORMATIVE':
        # HGB has translations for § references, be more lenient
        return (authority_rank <= 3 or
                (has_normative and paragraph_count > 0))
    
    else:
        # GENERAL - Use authoritative sources
        return authority_rank <= 5