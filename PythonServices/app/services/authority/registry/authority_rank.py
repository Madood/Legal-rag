"""
Authority Rank - Determines hierarchy between legal sources.
Pure sovereignty ranking with no statute internals.
"""

from enum import Enum

class AuthorityState(Enum):
    """Authority states for legal questions"""
    FULL_AUTHORITY = "FULL_AUTHORITY"  # Statute and paragraph locked
    STATUTE_CONFIRMED_PARAGRAPH_OPEN = "STATUTE_CONFIRMED_PARAGRAPH_OPEN"  # Statute locked, paragraph open
    CLARIFICATION_REQUIRED = "CLARIFICATION_REQUIRED"  # Clarification needed
    NO_AUTHORITY = "NO_AUTHORITY"  # No legal authority determined

# German legal hierarchy (descending authority)
LEGAL_HIERARCHY = {
    'GG': 100,      # Grundgesetz (Constitutional law)
    'EU-GDPR': 90,  # Supranational EU regulation
    'StGB': 80,     # Strafgesetzbuch (Criminal law)
    'BGB': 70,      # Bürgerliches Gesetzbuch (Civil law)
    'HGB': 60       # Handelsgesetzbuch (Commercial law)
}

def compare_hierarchy(statute_a: str, statute_b: str) -> int:
    """Compare hierarchy rank of two statutes."""
    rank_a = LEGAL_HIERARCHY.get(statute_a, 0)
    rank_b = LEGAL_HIERARCHY.get(statute_b, 0)
    
    if rank_a > rank_b:
        return 1
    elif rank_a < rank_b:
        return -1
    return 0

def get_authority_state(statute: str, has_reference: bool, question_type: str = None) -> dict:
    """
    Determine authority state based on statute and reference.
    
    IMPORTANT: This determines IF authority exists, not WHAT to retrieve.
    """
    if not statute:
        return {
            'state': AuthorityState.NO_AUTHORITY,
            'confidence': 0.0,
            'requiresClarification': True
        }
    
    if has_reference:
        return {
            'state': AuthorityState.FULL_AUTHORITY,
            'confidence': 0.85,  # Base confidence for exact reference
            'requiresClarification': False
        }
    
    # GDPR requires specific article
    if statute == 'EU-GDPR':
        return {
            'state': AuthorityState.CLARIFICATION_REQUIRED,
            'confidence': 0.0,
            'requiresClarification': True
        }
    
    # BGB-specific intermediate state possibility
    if statute == 'BGB' and question_type == 'GENERAL':
        return {
            'state': AuthorityState.STATUTE_CONFIRMED_PARAGRAPH_OPEN,
            'confidence': 0.70,
            'requiresClarification': False
        }
    
    # Other statutes without reference need clarification
    return {
        'state': AuthorityState.CLARIFICATION_REQUIRED,
        'confidence': 0.0,
        'requiresClarification': True
    }