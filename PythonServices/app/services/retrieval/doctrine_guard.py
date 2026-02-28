DOCTRINAL_QUESTION_TYPES = {
    "DOCTRINE", "LEGAL_PRINCIPLE", "GRUNDSATZ", "PRINCIPLE", "DOCTRINAL_ANALYSIS"
}

CANONICAL_DOCTRINES = {
    "schuldprinzip": "SCHULDPRINZIP",
    "nulla poena sine lege": "NULLA_POENA_SINE_LEGE",
    "verhältnismäßigkeitsprinzip": "VERHAELTNISMAESSIGKEIT",
    "rechtsstaatsprinzip": "RECHTSSTAATSPRINZIP",
    "bestimmtheitsgrundsatz": "BESTIMMTHEITSGRUNDSATZ",
}

CIVIL_LAW_DOCTRINES = {
    "privatautonomie": {
        "canonical_id": "PRIVATAUTONOMIE",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§ 145 BGB", "§§ 305 ff. BGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG (indirect)"],
        "description": "Freedom of contract as private autonomy principle",
        "aliases": ["vertragsfreiheit", "freedom of contract"]
    },
    "trennungsprinzip": {
        "canonical_id": "TRENNUNGSPRINZIP",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§ 925 BGB", "§ 929 BGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)"],
        "description": "Separation principle between obligation and conveyance",
        "aliases": ["trennungsgrundsatz", "separation principle"]
    }
}

DOCTRINE_LOOKUP = {}
for term, canonical_id in CANONICAL_DOCTRINES.items():
    DOCTRINE_LOOKUP[term] = {
        "canonical_id": canonical_id,
        "hierarchy": "constitutional",
        "constitutional_basis": ["Art. 20 GG", "Art. 103 GG"],
        "statutory_basis": None,
        "description": "Fundamental constitutional principle"
    }

for term, metadata in CIVIL_LAW_DOCTRINES.items():
    DOCTRINE_LOOKUP[term] = metadata
    for alias in metadata.get("aliases", []):
        DOCTRINE_LOOKUP[alias] = metadata

SETTLED_DOCTRINES = set(DOCTRINE_LOOKUP.keys())

class DoctrineGuard:
    """Doctrine detection and metadata"""
    
    @staticmethod
    def get_doctrinal_empty_result(doctrine_mode: bool = True, 
                                  doctrine_metadata: dict = None) -> dict:
        """Return empty result for doctrinal questions"""
        default_metadata = {
            "canonical_id": "GENERAL_DOCTRINE",
            "hierarchy": "constitutional",
            "constitutional_basis": ["Art. 20 GG", "Art. 103 GG"],
            "statutory_basis": None,
            "description": "General constitutional principle"
        }
        
        metadata = doctrine_metadata or default_metadata
        hierarchy = metadata.get("hierarchy", "constitutional")
        
        if hierarchy == "civil_law_doctrine":
            constitutional_basis = metadata.get("constitutional_basis", ["Art. 2 Abs. 1 GG (indirect)"])
            statutory_basis = metadata.get("statutory_basis", [])
            legal_hierarchy = "civil_law_doctrine"
            doctrinal_template = "civil_law_principle"
            message = f"No retrieval for civil law doctrine: {metadata.get('canonical_id')}"
        else:
            constitutional_basis = metadata.get("constitutional_basis", ["Art. 20 GG", "Art. 103 GG"])
            statutory_basis = None
            legal_hierarchy = "constitutional"
            doctrinal_template = "constitutional_principle"
            message = f"No retrieval for constitutional doctrine: {metadata.get('canonical_id')}"
        
        return {
            "results": [],
            "terminal": True,
            "mode": "DOCTRINAL_ONLY",
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "constitutional_basis": constitutional_basis,
                "statutory_basis": statutory_basis,
                "legal_hierarchy": legal_hierarchy,
                "doctrine_mode": doctrine_mode,
                "canonical_doctrine": metadata.get("canonical_id"),
                "doctrine_description": metadata.get("description"),
                "retrieval_performed": False,
                "retrieval_blocked": True,
                "has_real_norms": False,
                "doctrinal_template": doctrinal_template,
                "doctrine_blocking_applied": True,
                "doctrine_enforcement_blocked": True,
                "terminal": True
            },
            "authority_validation": {
                "status": "doctrinal_early_exit",
                "message": message,
                "doctrine": {
                    "applied": True,
                    "status": "settled_doctrine_no_retrieval",
                    "canonical_doctrine": metadata.get("canonical_id"),
                    "hierarchy": legal_hierarchy,
                    "blocking_invariant": "enforced"
                }
            },
            "requires_clarification": False,
            "doctrine_metadata": {
                "status": "settled_doctrine_no_retrieval",
                "canonical_doctrine": metadata.get("canonical_id"),
                "doctrinal_template": doctrinal_template,
                "applied": True,
                "retrieval_blocked": True,
                "type": "blocking_not_enforcement",
                "hierarchy_level": legal_hierarchy,
                "terminal": True
            }
        }

# ✅ CRITICAL: Export all necessary symbols
__all__ = [
    'DoctrineGuard', 
    'DOCTRINAL_QUESTION_TYPES', 
    'SETTLED_DOCTRINES', 
    'DOCTRINE_LOOKUP',
    'CANONICAL_DOCTRINES',
    'CIVIL_LAW_DOCTRINES'
]