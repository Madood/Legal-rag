"""
Shared constants between ingestion and query modules.
This ensures they can never drift apart.
Single source of truth for statute-domain mappings and utilities.
"""

from typing import Dict, Optional
import re

# Domain mapping - MUST match between ingestion and query
# This is the single source of truth for statute domains
# ALL KEYS ARE UPPERCASE to match system-wide normalization
STATUTE_DOMAIN_MAP: Dict[str, str] = {
    "BGB": "civil",
    "STGB": "criminal",      # Uppercase to match authority resolver output
    "HGB": "commercial",
    "GG": "constitutional",
    "EU-GDPR": "data_protection",
    "GMBHG": "company_law",
    "ZPO": "civil_procedure",
    "STPO": "criminal_procedure",
}

# Reverse mapping for looking up statutes by domain
# Values are UPPERCASE to match STATUTE_DOMAIN_MAP keys
DOMAIN_TO_STATUTE_MAP: Dict[str, str] = {
    "civil": "BGB",
    "criminal": "STGB",      # Uppercase to match STATUTE_DOMAIN_MAP
    "commercial": "HGB",
    "constitutional": "GG",
    "data_protection": "EU-GDPR",
    "company_law": "GMBHG",
    "civil_procedure": "ZPO",
    "criminal_procedure": "STPO",
}

# Embedding dimension - must match your model
# This should be verified against your embedding model's output dimension
EMBEDDING_DIMENSION: int = 768

# Jurisdiction constant
JURISDICTION: str = "DE"

# Statute full names for display (keys UPPERCASE)
STATUTE_FULL_NAMES: Dict[str, str] = {
    "BGB": "Bürgerliches Gesetzbuch",
    "STGB": "Strafgesetzbuch",   # Uppercase
    "HGB": "Handelsgesetzbuch",
    "GG": "Grundgesetz",
    "EU-GDPR": "Datenschutz-Grundverordnung",
    "GMBHG": "Gesetz betreffend die Gesellschaften mit beschränkter Haftung",
    "ZPO": "Zivilprozessordnung",
    "STPO": "Strafprozessordnung",
}

# Statute English names (keys UPPERCASE)
STATUTE_ENGLISH_NAMES: Dict[str, str] = {
    "BGB": "German Civil Code",
    "STGB": "German Criminal Code",  # Uppercase
    "HGB": "German Commercial Code",
    "GG": "German Basic Law",
    "EU-GDPR": "EU General Data Protection Regulation",
    "GMBHG": "German Limited Liability Company Act",
    "ZPO": "German Code of Civil Procedure",
    "STPO": "German Code of Criminal Procedure",
}

# Minimum expected paragraphs per statute (for validation) - keys UPPERCASE
MIN_EXPECTED_PARAGRAPHS: Dict[str, int] = {
    "BGB": 200,
    "STGB": 100,    # Uppercase
    "HGB": 50,
    "GG": 20,
    "EU-GDPR": 30,
    "GMBHG": 30,
    "ZPO": 100,
    "STPO": 100,
}

# Test paragraphs for sanity checks - keys UPPERCASE
TEST_PARAGRAPHS: Dict[str, str] = {
    "BGB": "433",
    "STGB": "211",   # Uppercase
    "HGB": "1",
    "GG": "1",
    "EU-GDPR": "1",
    "GMBHG": "1",
    "ZPO": "253",
    "STPO": "112",
}

# Domain-specific search keywords for fallback routing
DOMAIN_KEYWORDS: Dict[str, list] = {
    "civil": [
        "bgb", "civil", "bürgerliches", "vertrag", "kauf", "miete", "schadensersatz",
        "verjährung", "willenserklärung", "geschäftsfähigkeit", "vollmacht", "stellvertretung",
        "kaufvertrag", "mietvertrag", "werkvertrag", "darlehen", "verzug", "unmöglichkeit",
        "mitverschulden", "bereicherung", "agb", "widerrufsrecht", "eigentumsübertragung",
        "gewährleistung", "treu und glauben", "anfechtung", "BGB",
    ],
    "criminal": [
        "stgb", "criminal", "straf", "verbrechen", "diebstahl", "mord", "körperverletzung",
        "totschlag", "raub", "erpressung", "betrug", "untreue", "hehlerei",
        "nötigung", "hausfriedensbruch", "beleidigung", "urkundenfälschung",
        "notwehr", "notstand", "fahrlässige tötung", "StGB",
    ],
    "commercial": [
        "hgb", "commercial", "handel", "kaufmann", "firma", "register",
        "prokura", "ohg", "kg", "kommanditgesellschaft", "handelsmakler",
        "handelsbücher", "handlungsgehilfe", "kommissionsgeschäft", "HGB",
    ],
    "constitutional": [
        "gg", "grundgesetz", "constitution", "grundrecht", "menschenwürde",
        "meinungsfreiheit", "versammlungsfreiheit", "religionsfreiheit", "berufsfreiheit",
        "eigentumsgarantie", "gleichheit", "verhältnismäßigkeit", "rechtsstaat",
        "sozialstaat", "ewigkeitsklausel", "GG",
    ],
    "data_protection": ["gdpr", "dsgvo", "datenschutz", "privacy", "personenbezogene", "EU-GDPR"],
    "company_law": [
        "gmbhg", "gmbh", "stammkapital", "gesellschaft", "geschäftsführer",
        "unternehmergesellschaft", "ug", "gesellschafterbeschluss", "kapitalerhöhung",
        "liquidation", "insolvenzantrag", "GMBHG",
    ],
    "civil_procedure": [
        "zpo", "zivilprozess", "klage", "mahnbescheid", "zwangsvollstreckung",
        "einstweilige verfügung", "versäumnisurteil", "berufung", "revision",
        "beweislast", "arrest", "klageschrift", "ZPO",
    ],
    "criminal_procedure": [
        "stpo", "strafprozess", "untersuchungshaft", "hauptverhandlung",
        "haftbefehl", "durchsuchung", "strafbefehl", "akteneinsicht",
        "verfahrenseinstellung", "vernehmung", "STPO",
    ],
}

# Paragraph patterns for different statute types
PARAGRAPH_PATTERNS: Dict[str, str] = {
    "BGB": r'^§\s*(\d+[a-z]?)(?:\s+Abs?\.?\s*\d+)?',
    "STGB": r'(?:^|\s)§\s*(\d+[a-z]?)(?:\s+Abs?\.?\s*\d+)?',
    "HGB": r'(?:^|\s)§\s*(\d+[a-z]?)(?:\s+Abs?\.?\s*\d+)?',
    "GG": r'(?:^|\s)(?:Artikel|Art\.?)\s*(\d+[a-z]?)',
    "EU-GDPR": r'(?:^|\s)(?:Artikel|Art\.?)\s*(\d+[a-z]?)'
}


def get_store_name(statute: str, jurisdiction: str = JURISDICTION) -> str:
    """
    Generate consistent store name for FAISS indices.
    Format: {statute}_{domain}_{jurisdiction}
    
    Args:
        statute: Statute code (e.g., "BGB", "STGB")
        jurisdiction: Jurisdiction code (default: "DE")
    
    Returns:
        Consistent store name string
    """
    statute_upper = statute.upper()
    domain = STATUTE_DOMAIN_MAP.get(statute_upper, "unknown")
    return f"{statute_upper}_{domain}_{jurisdiction}"


def normalize_paragraph(paragraph: str) -> str:
    """
    Normalize paragraph number for consistent matching.
    - Removes § symbol
    - Strips whitespace
    - Preserves letters (e.g., "433a" stays "433a")
    
    Args:
        paragraph: Raw paragraph string (may include §)
    
    Returns:
        Normalized paragraph string
    """
    if not paragraph:
        return ""
    # Remove § symbol and any extra whitespace
    normalized = paragraph.replace("§", "").strip()
    # Remove any remaining special characters but keep letters/numbers
    normalized = re.sub(r'[^\w\s]', '', normalized)
    return normalized


def extract_canonical_paragraph(paragraph: str) -> str:
    """
    Extract canonical paragraph number (numeric part only).
    Used for matching when letters should be ignored.
    
    Args:
        paragraph: Paragraph number (may include letters like "433a")
    
    Returns:
        Numeric part of paragraph (e.g., "433" from "433a")
    """
    if not paragraph:
        return ""
    # Extract leading digits
    match = re.match(r'^(\d+)', paragraph)
    return match.group(1) if match else paragraph


def validate_domain_consistency() -> Dict[str, bool]:
    """
    Validate that all domain mappings are consistent.
    Useful for testing and debugging.
    
    Returns:
        Dictionary with validation results
    """
    results = {}
    
    # Check that all statutes have domains
    for statute in STATUTE_DOMAIN_MAP:
        domain = STATUTE_DOMAIN_MAP[statute]
        results[f"statute_{statute}_has_domain"] = bool(domain)
        
        # Check reverse mapping exists
        reverse_statute = DOMAIN_TO_STATUTE_MAP.get(domain)
        results[f"domain_{domain}_maps_back"] = reverse_statute == statute
    
    # Check that all domains map to statutes
    for domain in DOMAIN_TO_STATUTE_MAP:
        statute = DOMAIN_TO_STATUTE_MAP[domain]
        results[f"domain_{domain}_maps_to_statute"] = statute in STATUTE_DOMAIN_MAP
    
    # Check for key case consistency
    all_keys_uppercase = all(key.isupper() for key in STATUTE_DOMAIN_MAP.keys())
    results["all_statute_keys_uppercase"] = all_keys_uppercase
    
    # Check that TEST_PARAGRAPHS keys match STATUTE_DOMAIN_MAP keys
    test_keys_match = set(TEST_PARAGRAPHS.keys()) == set(STATUTE_DOMAIN_MAP.keys())
    results["test_paragraphs_keys_match"] = test_keys_match
    
    # Check that MIN_EXPECTED_PARAGRAPHS keys match
    min_expected_keys_match = set(MIN_EXPECTED_PARAGRAPHS.keys()) == set(STATUTE_DOMAIN_MAP.keys())
    results["min_expected_keys_match"] = min_expected_keys_match
    
    # Overall consistency
    results["all_consistent"] = all(results.values())
    
    return results


def get_statute_from_domain(domain: str) -> Optional[str]:
    """
    Get statute code from domain name.
    
    Args:
        domain: Domain string (e.g., "civil", "criminal")
    
    Returns:
        Statute code or None if not found
    """
    return DOMAIN_TO_STATUTE_MAP.get(domain)


def get_domain_from_statute(statute: str) -> str:
    """
    Get domain from statute code with fallback.
    
    Args:
        statute: Statute code (e.g., "BGB", "STGB")
    
    Returns:
        Domain string or "unknown" if not found
    """
    statute_upper = statute.upper()
    return STATUTE_DOMAIN_MAP.get(statute_upper, "unknown")


def get_paragraph_pattern(statute: str) -> str:
    """
    Get the appropriate paragraph extraction pattern for a statute.
    
    Args:
        statute: Statute code (e.g., "BGB", "STGB")
    
    Returns:
        Regex pattern string
    """
    statute_upper = statute.upper()
    return PARAGRAPH_PATTERNS.get(statute_upper, PARAGRAPH_PATTERNS["BGB"])


def get_test_paragraph(statute: str) -> str:
    """
    Get the test paragraph for a statute.
    
    Args:
        statute: Statute code (e.g., "BGB", "STGB")
    
    Returns:
        Test paragraph number
    """
    statute_upper = statute.upper()
    return TEST_PARAGRAPHS.get(statute_upper, "1")


def get_min_expected_paragraphs(statute: str) -> int:
    """
    Get minimum expected paragraphs for a statute.
    
    Args:
        statute: Statute code (e.g., "BGB", "STGB")
    
    Returns:
        Minimum expected paragraph count
    """
    statute_upper = statute.upper()
    return MIN_EXPECTED_PARAGRAPHS.get(statute_upper, 10)


def get_statute_full_name(statute: str, language: str = "de") -> str:
    """
    Get full name of statute in specified language.
    
    Args:
        statute: Statute code (e.g., "BGB", "STGB")
        language: "de" for German, "en" for English
    
    Returns:
        Full statute name
    """
    statute_upper = statute.upper()
    if language.lower() == "en":
        return STATUTE_ENGLISH_NAMES.get(statute_upper, statute_upper)
    return STATUTE_FULL_NAMES.get(statute_upper, statute_upper)


def is_valid_statute(statute: str) -> bool:
    """
    Check if a statute code is valid.
    
    Args:
        statute: Statute code to check
    
    Returns:
        True if statute is supported
    """
    return statute.upper() in STATUTE_DOMAIN_MAP


def get_all_statutes() -> list:
    """
    Get list of all supported statutes.
    
    Returns:
        List of statute codes
    """
    return list(STATUTE_DOMAIN_MAP.keys())


def get_domain_keywords(domain: str) -> list:
    """
    Get search keywords for a domain.
    
    Args:
        domain: Domain name
    
    Returns:
        List of keywords for fallback routing
    """
    return DOMAIN_KEYWORDS.get(domain, [])


# Test the constants if run directly
if __name__ == "__main__":
    print("=" * 60)
    print("TESTING CONSTANTS MODULE")
    print("=" * 60)
    
    print(f"\n📋 STATUTE_DOMAIN_MAP:")
    for statute, domain in STATUTE_DOMAIN_MAP.items():
        print(f"   {statute} -> {domain}")
    
    print(f"\n🔄 DOMAIN_TO_STATUTE_MAP:")
    for domain, statute in DOMAIN_TO_STATUTE_MAP.items():
        print(f"   {domain} -> {statute}")
    
    print(f"\n🔍 Validation results:")
    validation = validate_domain_consistency()
    for check, result in validation.items():
        status = "✅" if result else "❌"
        print(f"   {status} {check}: {result}")
    
    if not validation["all_consistent"]:
        print("\n⚠️  WARNING: Inconsistencies detected in constants!")
    else:
        print("\n✅ All constants are consistent!")
    
    print(f"\n📊 Store name tests:")
    for statute in get_all_statutes():
        store_name = get_store_name(statute)
        print(f"   {statute} -> {store_name}")
    
    print(f"\n🔤 Paragraph normalization tests:")
    test_paragraphs = ["§433", "433a", " 211 ", "§ 1564", "§433a", "14", ""]
    for p in test_paragraphs:
        normalized = normalize_paragraph(p)
        canonical = extract_canonical_paragraph(normalized)
        print(f"   '{p}' -> normalized: '{normalized}', canonical: '{canonical}'")
    
    print(f"\n🧪 Test paragraphs:")
    for statute in get_all_statutes():
        test_para = get_test_paragraph(statute)
        print(f"   {statute}: §{test_para}")
    
    print(f"\n📏 Minimum expected paragraphs:")
    for statute in get_all_statutes():
        min_exp = get_min_expected_paragraphs(statute)
        print(f"   {statute}: {min_exp}")
    
    print(f"\n📚 Statute full names:")
    for statute in get_all_statutes():
        de_name = get_statute_full_name(statute, "de")
        en_name = get_statute_full_name(statute, "en")
        print(f"   {statute}: {de_name} / {en_name}")
    
    print(f"\n🔑 Domain keywords sample:")
    for domain in ["civil", "criminal", "commercial"]:
        keywords = get_domain_keywords(domain)[:3]
        print(f"   {domain}: {keywords}")
    
    print("\n" + "=" * 60)
    print("CONSTANTS MODULE READY")
    print("=" * 60)