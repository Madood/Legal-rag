"""
DOCTRINE TEMPLATES
==================

Pure structural templates for legal doctrine AND single source of truth for doctrinal field rules.
"""

from enum import Enum
from typing import Dict, List, TypedDict, Optional, Any, Union
from dataclasses import dataclass


class TemplateType(str, Enum):
    """Enumeration of valid doctrinal template types."""
    DEFINITION = "definition"
    RULE = "rule"
    PRINCIPLE = "principle"
    TEST = "legal_test"
    STANDARD = "legal_standard"
    EXCEPTION = "exception"
    PRESUMPTION = "presumption"


@dataclass(frozen=True)
class TemplateSpec:
    """Specification for a doctrinal template."""
    template_type: TemplateType
    required_sections: List[str]
    optional_sections: List[str] = None
    description: str = ""
    
    def __post_init__(self):
        if self.optional_sections is None:
            object.__setattr__(self, 'optional_sections', [])


class DefinitionTemplate(TypedDict):
    """Template for legal definitions."""
    legal_definition: str
    core_elements: List[str]
    normative_purpose: str
    statutory_basis: Optional[str]
    contrasting_concepts: Optional[List[str]]


class RuleTemplate(TypedDict):
    """Template for legal rules."""
    rule_statement: str
    requirements: List[str]
    legal_consequence: str
    triggering_conditions: Optional[List[str]]
    exceptions: Optional[List[str]]


class PrincipleTemplate(TypedDict):
    """Template for legal principles."""
    principle_statement: str
    scope_of_application: str
    systemic_function: str
    balancing_factors: Optional[List[str]]
    policy_justification: Optional[str]


class TestTemplate(TypedDict):
    """Template for legal tests."""
    test_name: str
    steps: List[str]
    evaluation_standard: str
    burden_of_proof: Optional[str]
    threshold: Optional[str]


class DoctrinalFieldConfig(TypedDict, total=False):
    """
    Configuration for a recognized doctrinal field.
    
    This replaces the rigid statute/paragraph requirement with
    civil-law-correct doctrinal reasoning.
    """
    domain: str
    default_statute: Optional[str]
    default_paragraphs: Optional[List[str]]
    implicit_allowed: bool
    examiner_mode: str  # "strict", "overview", "lenient"
    confidence_threshold: Optional[float]
    question_keywords: Optional[List[str]]
    template_type: TemplateType
    citation_style: Optional[str]  # e.g., "german_legal", "bluebook"


class DoctrineTemplates:
    """
    Repository of all doctrinal templates AND doctrinal field configurations.
    
    SINGLE SOURCE OF TRUTH for:
    1. Template structures
    2. Doctrinal field configurations
    3. Implicit authority rules
    4. Confidence thresholds
    
    Usage:
        templates = DoctrineTemplates.get_template(TemplateType.DEFINITION)
        field_config = DoctrineTemplates.get_doctrinal_field("family_law", "divorce")
    """
    
    # Template specifications registry
    _TEMPLATE_SPECS: Dict[TemplateType, TemplateSpec] = {
        TemplateType.DEFINITION: TemplateSpec(
            template_type=TemplateType.DEFINITION,
            required_sections=["legal_definition", "core_elements", "normative_purpose"],
            optional_sections=["statutory_basis", "contrasting_concepts", "historical_context"],
            description="Formal legal definition with normative grounding"
        ),
        
        TemplateType.RULE: TemplateSpec(
            template_type=TemplateType.RULE,
            required_sections=["rule_statement", "requirements", "legal_consequence"],
            optional_sections=["triggering_conditions", "exceptions", "illustrative_examples"],
            description="Complete legal rule with requirements and consequences"
        ),
        
        TemplateType.PRINCIPLE: TemplateSpec(
            template_type=TemplateType.PRINCIPLE,
            required_sections=["principle_statement", "scope_of_application", "systemic_function"],
            optional_sections=["balancing_factors", "policy_justification", "limitations"],
            description="Overarching legal principle with systemic role"
        ),
        
        TemplateType.TEST: TemplateSpec(
            template_type=TemplateType.TEST,
            required_sections=["test_name", "steps", "evaluation_standard"],
            optional_sections=["burden_of_proof", "threshold", "application_guidance"],
            description="Structured legal test with procedural steps"
        ),
        
        TemplateType.STANDARD: TemplateSpec(
            template_type=TemplateType.STANDARD,
            required_sections=["standard_name", "level_of_review", "factors"],
            optional_sections=["deference_level", "modifications"],
            description="Legal standard of review or evaluation"
        ),
        
        TemplateType.EXCEPTION: TemplateSpec(
            template_type=TemplateType.EXCEPTION,
            required_sections=["exception_name", "applicable_rule", "conditions"],
            optional_sections=["rationale", "limitations"],
            description="Exception to a general legal rule"
        ),
        
        TemplateType.PRESUMPTION: TemplateSpec(
            template_type=TemplateType.PRESUMPTION,
            required_sections=["presumption_name", "effect", "rebuttal_conditions"],
            optional_sections=["policy_basis", "strength"],
            description="Legal presumption with rebuttal conditions"
        )
    }
    
    # Doctrinal field configurations - SINGLE SOURCE OF TRUTH
    # All implicit authority rules defined here, nowhere else
    _DOCTRINAL_FIELDS: Dict[str, Dict[str, DoctrinalFieldConfig]] = {
        "family_law": {
            "divorce": {
                "domain": "family_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 1564", "§ 1565", "§ 1566"],
                "implicit_allowed": True,
                "examiner_mode": "overview",
                "confidence_threshold": 0.85,
                "question_keywords": [
                    "Ehescheidung", "Scheidung", "Trennungsjahr", 
                    "Zerrüttung", "unzumutbare Härte", "Härtefall",
                    "Ehegatte", "Ehepartner", "Eheleute", "Ehepaar",
                    "Trennung", "getrennt leben", "Scheidungsantrag",
                    "Voraussetzungen", "Bedingungen", "Anforderungen",
                    "Scheidungsgründe", "Scheidungsfolgen"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            },
            "child_custody": {
                "domain": "family_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 1626", "§ 1627", "§ 1631"],
                "implicit_allowed": True,
                "examiner_mode": "strict",
                "confidence_threshold": 0.9,
                "question_keywords": [
                    "Sorgerecht", "Kindeswohl", "Umgangsrecht",
                    "gemeinsame Sorge", "Aufenthaltsbestimmungsrecht",
                    "Kind", "Kinder", "Eltern", "Elternteil",
                    "Sorgerechtsverfahren", "Umgangsregelung",
                    "Obsorge", "Besuchsrecht"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            }
        },
        "contract_law": {
            "formation": {
                "domain": "contract_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 145", "§ 146", "§ 147"],
                "implicit_allowed": True,
                "examiner_mode": "strict",
                "confidence_threshold": 0.95,
                "question_keywords": [
                    "Vertragsschluss", "Angebot", "Annahme",
                    "Willenserklärung", "Schweigen",
                    "Vertrag", "Verträge", "Vertragsabschluss",
                    "Vertragspartner", "Vertragsinhalt",
                    "Angebotsannahfme", "Vertragsanbahnung"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            },
            "defects": {
                "domain": "contract_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 119", "§ 123", "§ 142"],
                "implicit_allowed": False,  # Requires explicit citation
                "examiner_mode": "strict",
                "confidence_threshold": 0.9,
                "question_keywords": [
                    "Anfechtung", "Irrtum", "arglistige Täuschung",
                    "Drohung", "Wegfall der Geschäftsgrundlage",
                    "Willensmangel", "Willenserkärung",
                    "Anfechtungsfrist", "Anfechtungsrecht"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            }
        },
        # NEW DOMAIN: civil_doctrine for systematic reasoning
        "civil_doctrine": {
            "mistake_doctrine": {
                "domain": "civil_doctrine",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 119", "§ 120", "§ 121", "§ 122"],
                "implicit_allowed": True,
                "examiner_mode": "overview",
                "confidence_threshold": 0.8,
                "question_keywords": [
                    "Irrtum", "mistake", "error", "Anfechtung", "avoidance",
                    "voidable", "Willensmangel", "wesentliche Eigenschaft",
                    "essential characteristic", "§ 119", "§ 120", "§ 121", "§ 122",
                    "Täuschung", "deception", "Drohung", "duress",
                    "Erklärungsirrtum", "Inhaltsirrtum", "Eigenschaftsirrtum",
                    "Geschäftsgrundlage", "reliance", "Vertrauensschaden",
                    "fehlerhafte Willenserklärung", "declaration of intent",
                    "provisional validity", "reliance protection"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            }
        },
        "tort_law": {
            "negligence": {
                "domain": "tort_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 823", "§ 826"],
                "implicit_allowed": True,
                "examiner_mode": "overview",
                "confidence_threshold": 0.85,
                "question_keywords": [
                    "Fahrlässigkeit", "Sorgfaltspflicht", "Verkehrssicherungspflicht",
                    "haftung", "Schadensersatz", "Verschulden",
                    "Delikt", "unerlaubte Handlung",
                    "Verletzung", "Schaden", "Schadensersatzanspruch",
                    "Gefährdungshaftung", "Produkthaftung"
                ],
                "template_type": TemplateType.TEST,
                "citation_style": "german_legal"
            }
        },
        "criminal_law": {
            "homicide": {
                "domain": "criminal_law",
                "default_statute": "StGB",
                "default_paragraphs": ["§ 211", "§ 212", "§ 222"],
                "implicit_allowed": True,
                "examiner_mode": "strict",
                "confidence_threshold": 0.9,
                "question_keywords": [
                    "Tötung", "Mord", "Totschlag", "Fahrlässige Tötung",
                    "Notwehr", "Notstand",
                    "Tötungsdelikt", "Tötungsverbrechen",
                    "Mordmerkmal", "Totschlagmerkmal",
                    "Tötungshandlung", "Lebensentziehung"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            },
            "theft": {
                "domain": "criminal_law",
                "default_statute": "StGB",
                "default_paragraphs": ["§ 242", "§ 243", "§ 244"],
                "implicit_allowed": True,
                "examiner_mode": "strict",
                "confidence_threshold": 0.9,
                "question_keywords": [
                    "Diebstahl", "Raub", "Unterschlagung",
                    "Eigentumsdelikt", "Fremdbesitz",
                    "Wegnahme", "Zueignung", "Zueignungsabsicht",
                    "Diebstahlsschaden", "Raubüberfall"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            }
        },
        "property_law": {
            "ownership": {
                "domain": "property_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 903", "§ 904", "§ 905"],
                "implicit_allowed": True,
                "examiner_mode": "strict",
                "confidence_threshold": 0.9,
                "question_keywords": [
                    "Eigentum", "Besitz", "Sachenrecht", "Grundstück",
                    "Eigentumsvorbehalt",
                    "Eigentümer", "Eigentumsrecht", "Eigentumserwerb",
                    "Eigentumsübertragung", "Eigentumsverhältnis",
                    "Grundstückseigentum", "Fahrniseigentum"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            }
        },
        "labor_law": {
            "termination": {
                "domain": "labor_law",
                "default_statute": "BGB",
                "default_paragraphs": ["§ 622", "§ 626"],
                "implicit_allowed": True,
                "examiner_mode": "strict",
                "confidence_threshold": 0.9,
                "question_keywords": [
                    "Kündigung", "Arbeitsverhältnis", "Arbeitnehmer",
                    "Kündigungsfrist", "Kündigungsschutz",
                    "ordentliche Kündigung", "außerordentliche Kündigung",
                    "Kündigungsgrund", "Kündigungsschutzklage",
                    "Arbeitsvertrag", "Beschäftigungsverhältnis"
                ],
                "template_type": TemplateType.RULE,
                "citation_style": "german_legal"
            }
        }
    }
    
    @classmethod
    def get_template(cls, template_type: TemplateType) -> Dict:
        """Get a template structure for the specified type."""
        spec = cls._TEMPLATE_SPECS.get(template_type)
        if not spec:
            raise ValueError(f"Unknown template type: {template_type}")
        
        return {
            "type": spec.template_type.value,
            "required_sections": spec.required_sections,
            "optional_sections": spec.optional_sections,
            "description": spec.description
        }
    
    @classmethod
    def get_all_templates(cls) -> Dict[TemplateType, Dict]:
        """Get all available templates."""
        return {ttype: cls.get_template(ttype) for ttype in cls._TEMPLATE_SPECS.keys()}
    
    @classmethod
    def validate_template_structure(cls, doctrine: Dict, template_type: TemplateType) -> bool:
        """Validate that a doctrine object matches its template structure."""
        if not doctrine or not isinstance(doctrine, dict):
            return False
        
        template = cls.get_template(template_type)
        
        # Check required sections
        for section in template["required_sections"]:
            if section not in doctrine:
                return False
            if doctrine[section] in (None, "", [], {}):
                return False
        
        return True
    
    @classmethod
    def get_doctrinal_field(cls, domain: str, field: str) -> Optional[DoctrinalFieldConfig]:
        """Get configuration for a recognized doctrinal field."""
        return cls._DOCTRINAL_FIELDS.get(domain, {}).get(field)
    
    @classmethod
    def get_doctrinal_field_info(cls, domain: str, field: Optional[str] = None) -> Dict[str, Any]:
        """
        Get doctrinal field information including implicit authority rules.
        SINGLE SOURCE OF TRUTH for validator to check implicit authority.
        
        Args:
            domain: Legal domain (e.g., "family_law", "criminal_law")
            field: Specific field within domain (e.g., "divorce")
            
        Returns:
            Field information dict
        """
        if not domain:
            return {
                "implicit_allowed": False,
                "common_law_basis": False,
                "source": "no_domain",
                "requires_validation": True
            }
        
        # If field is specified, get field-specific config
        if field:
            field_config = cls.get_doctrinal_field(domain, field)
            if field_config:
                return {
                    "implicit_allowed": field_config.get("implicit_allowed", False),
                    "common_law_basis": False,  # Neutral placeholder - jurisdiction layer handles this
                    "source": "field_specific",
                    "domain": domain,
                    "field": field,
                    "confidence_threshold": field_config.get("confidence_threshold", 0.8),
                    "requires_validation": not field_config.get("implicit_allowed", False)
                }
        
        # Domain-level check: does ANY field in this domain allow implicit authority?
        domain_fields = cls._DOCTRINAL_FIELDS.get(domain, {})
        if domain_fields:
            # Check if any field in this domain allows implicit authority
            domain_implicit_allowed = any(
                field_cfg.get("implicit_allowed", False) 
                for field_cfg in domain_fields.values()
            )
            
            return {
                "implicit_allowed": domain_implicit_allowed,
                "common_law_basis": False,
                "source": "domain_inferred",
                "domain": domain,
                "requires_validation": not domain_implicit_allowed
            }
        
        # Domain not recognized
        return {
            "implicit_allowed": False,
            "common_law_basis": False,
            "source": "unknown_domain",
            "requires_validation": True
        }
    
    @classmethod
    def get_field_for_template(cls, template_type: TemplateType) -> Optional[Dict[str, Dict[str, DoctrinalFieldConfig]]]:
        """Get all doctrinal fields that use a specific template type."""
        result = {}
        for domain, fields in cls._DOCTRINAL_FIELDS.items():
            for field_name, config in fields.items():
                if config.get("template_type") == template_type:
                    if domain not in result:
                        result[domain] = {}
                    result[domain][field_name] = config
        return result if result else None
    
    @classmethod
    def find_field_by_keywords(cls, keywords: List[str], context_domain: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Find doctrinal field configuration by matching keywords."""
        matches = []
        
        for domain, fields in cls._DOCTRINAL_FIELDS.items():
            if context_domain and domain != context_domain:
                continue
                
            for field_name, config in fields.items():
                field_keywords = config.get("question_keywords", [])
                if not field_keywords:
                    continue
                    
                # Calculate match score - FIXED: measure against question keywords, not field keywords
                matches_found = 0
                for kw in keywords:
                    kw_lower = kw.lower()
                    for fk in field_keywords:
                        fk_lower = fk.lower()
                        # Exact match or partial match
                        if kw_lower == fk_lower or kw_lower in fk_lower or fk_lower in kw_lower:
                            matches_found += 1
                            break
                
                if matches_found > 0:
                    # CRITICAL FIX: Score based on question keywords, not field keywords
                    match_score = matches_found / max(len(keywords), 1) if keywords else 0.0
                    matches.append({
                        "domain": domain,
                        "field": field_name,
                        "config": config,
                        "match_score": match_score,
                        "match_count": matches_found,
                        "matched_keywords": keywords
                    })
        
        if not matches:
            return None
            
        # Return best match
        best_match = max(matches, key=lambda m: (m["match_score"], m["match_count"]))
        
        # Check confidence threshold
        confidence_threshold = best_match["config"].get("confidence_threshold", 0.7)
        
        # DOCTRINAL CORRECTION: Overview-capable fields tolerate abstraction
        # This reflects civil-law reasoning patterns where 2-3 indicators are sufficient
        if best_match["config"].get("implicit_allowed", False):
            # For implicit-allowed fields, be more permissive with keyword matching
            confidence_threshold = min(confidence_threshold, 0.4)
        
        if best_match["match_score"] >= confidence_threshold:
            return best_match
        
        return None
    
    @classmethod
    def get_field_for_question(cls, question_text: str, context: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Infer doctrinal field from question text and context."""
        # Extract keywords from question - improved tokenization
        question_lower = question_text.lower()
        
        # Tokenize the question better
        tokens = []
        # Split by common separators
        for part in question_lower.split():
            # Remove punctuation
            part = part.strip('.,!?;:()[]{}"\'')
            if part and len(part) > 2:  # Only keep meaningful words
                tokens.append(part)
        
        # Also look for compound words
        for domain, fields in cls._DOCTRINAL_FIELDS.items():
            for field_name, config in fields.items():
                field_keywords = [kw.lower() for kw in config.get("question_keywords", [])]
                for keyword in field_keywords:
                    if keyword in question_lower:
                        tokens.append(keyword)
        
        # Remove duplicates
        keywords = list(set(tokens))
        
        # If no keywords found but we have context domain, try fallback
        if not keywords and context:
            context_domain = context.get("domain")
            if context_domain in cls._DOCTRINAL_FIELDS:
                for field_name, config in cls._DOCTRINAL_FIELDS[context_domain].items():
                    if config.get("implicit_allowed", False):
                        return {
                            "domain": context_domain,
                            "field": field_name,
                            "config": config,
                            "match_score": 0.5,
                            "match_count": 0,
                            "inferred": True,
                            "keywords_found": []
                        }
        
        # Find field by keywords
        context_domain = context.get("domain") if context else None
        result = cls.find_field_by_keywords(keywords, context_domain)
        
        if result:
            result["inferred"] = True
            result["question"] = question_text
            result["keywords_used"] = keywords
        
        return result
    
    @classmethod
    def resolve_implicit_authority(cls, domain: str, field: str, 
                                  provided_statute: Optional[str] = None,
                                  provided_paragraphs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Resolve implicit authority for a doctrinal field."""
        field_config = cls.get_doctrinal_field(domain, field)
        
        if not field_config:
            return {
                "statute": provided_statute,
                "paragraphs": provided_paragraphs,
                "implicit": False,
                "authority_mode": "strict",
                "confidence": 0.0,
                "status": "field_not_found"
            }
        
        # Check if implicit authority is allowed for this field
        if not field_config.get("implicit_allowed", False):
            return {
                "statute": provided_statute,
                "paragraphs": provided_paragraphs,
                "implicit": False,
                "authority_mode": field_config.get("examiner_mode", "strict"),
                "confidence": 1.0 if provided_statute else 0.0,
                "status": "explicit_required"
            }
        
        # Use provided if available, otherwise use defaults
        statute = provided_statute or field_config.get("default_statute")
        paragraphs = provided_paragraphs or field_config.get("default_paragraphs")
        
        # Determine if this is implicit
        is_implicit = not (provided_statute or provided_paragraphs)
        
        return {
            "statute": statute,
            "paragraphs": paragraphs,
            "implicit": is_implicit,
            "authority_mode": field_config.get("examiner_mode", "strict"),
            "confidence": field_config.get("confidence_threshold", 0.8) if is_implicit else 1.0,
            "status": "resolved",
            "field": field,
            "domain": domain
        }
    
    @classmethod
    def diagnose_question(cls, question_text: str) -> Dict[str, Any]:
        """Diagnose a question to see how it's processed by the template system."""
        result = {
            "question": question_text,
            "field_match": None,
            "keywords_found": [],
            "domains_checked": [],
            "processing_steps": []
        }
        
        # Step 1: Try to get field from question
        field_info = cls.get_field_for_question(question_text)
        result["processing_steps"].append({
            "step": "field_detection",
            "result": field_info is not None,
            "details": field_info
        })
        
        if field_info:
            result["field_match"] = field_info
            result["keywords_found"] = field_info.get("keywords_used", [])
            
            # Step 2: Resolve authority
            authority = cls.resolve_implicit_authority(
                domain=field_info["domain"],
                field=field_info["field"]
            )
            result["processing_steps"].append({
                "step": "authority_resolution",
                "result": authority,
                "details": authority
            })
        
        # List all domains checked
        for domain in cls._DOCTRINAL_FIELDS.keys():
            result["domains_checked"].append(domain)
        
        return result
    
    @classmethod
    def test_divorce_scoring(cls):
        """Test the divorce question scoring with the fix."""
        question = "Nach 3 Jahren Trennung Scheidung – Voraussetzungen?"
        
        # Simulate keyword extraction
        keywords = ["trennung", "scheidung", "voraussetzungen"]
        
        # Find field
        result = cls.find_field_by_keywords(keywords, context_domain="family_law")
        
        if result:
            print(f"✅ Field matched: {result['domain']}.{result['field']}")
            print(f"   Match score: {result['match_score']:.2f}")
            print(f"   Confidence threshold: {result['config'].get('confidence_threshold')}")
            print(f"   Implicit allowed: {result['config'].get('implicit_allowed')}")
            
            # Check if it passes threshold
            threshold = result["config"].get("confidence_threshold", 0.7)
            if result["match_score"] >= threshold:
                print(f"✅ PASSES threshold → implicit authority allowed")
            else:
                print(f"❌ FAILS threshold → clarification required")
            
            # Show authority resolution
            authority = cls.resolve_implicit_authority(result["domain"], result["field"])
            print(f"   Authority mode: {authority['authority_mode']}")
            print(f"   Implicit: {authority['implicit']}")
            print(f"   Statute: {authority['statute']}")
            print(f"   Paragraphs: {authority['paragraphs']}")
        else:
            print("❌ No field matched")
        
        return result
    
    # Convenience methods for common templates
    @staticmethod
    def definition() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.DEFINITION)
    
    @staticmethod
    def rule() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.RULE)
    
    @staticmethod
    def principle() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.PRINCIPLE)
    
    @staticmethod
    def test() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.TEST)
    
    @staticmethod
    def standard() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.STANDARD)
    
    @staticmethod
    def exception() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.EXCEPTION)
    
    @staticmethod
    def presumption() -> Dict:
        return DoctrineTemplates.get_template(TemplateType.PRESUMPTION)