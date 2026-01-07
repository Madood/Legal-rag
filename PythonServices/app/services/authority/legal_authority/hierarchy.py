# German legal hierarchy (descending authority)
LEGAL_HIERARCHY = {
    'GG': 100,      # Grundgesetz (Constitutional law)
    'EU-GDPR': 90,  # Supranational EU regulation
    'StGB': 80,     # Strafgesetzbuch (Criminal law)
    'BGB': 70,      # Bürgerliches Gesetzbuch (Civil law)
    'HGB': 60       # Handelsgesetzbuch (Commercial law)
}

# Legal domain isolation matrix
DOMAIN_ISOLATION = {
    'criminal': ['StGB'],
    'constitutional': ['GG'],
    'civil': ['BGB'],
    'commercial': ['HGB'],
    'data_protection': ['EU-GDPR']
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