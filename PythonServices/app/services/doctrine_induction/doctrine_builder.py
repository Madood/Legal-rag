"""
DOCTRINE BUILDER
================

Constructs doctrinal structures from authoritative norms and legal materials.

Purpose:
- Synthesizes doctrine from raw legal materials
- Structures legal reasoning into exam-grade formats
- Prepares doctrinal explanations for answer composition
- Transforms "what is written" into "how the law operates"

Architecture:
This module is PURE synthesis - it DOES NOT validate correctness,
retrieve authorities, or compose final answers.

Input: Authoritative content with norm context
Output: Structured doctrine ready for validation and use
"""

from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import uuid

from .doctrine_templates import (
    TemplateType, 
    DefinitionTemplate,
    RuleTemplate,
    PrincipleTemplate,
    TestTemplate
)


class LegalElementType(str, Enum):
    """Types of legal elements in doctrine."""
    REQUISITE = "requisite"
    FACTOR = "factor"
    CONDITION = "condition"
    EXCEPTION = "exception"
    PRESUMPTION = "presumption"
    DEFENSE = "defense"


@dataclass
class LegalElement:
    """A discrete legal element within doctrine."""
    element_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    element_type: LegalElementType = LegalElementType.REQUISITE
    description: str = ""
    statutory_basis: Optional[str] = None
    is_mandatory: bool = True
    weight: Optional[float] = None  # For balancing tests
    precedence: int = 0  # Order in application
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation."""
        return {
            "element_id": self.element_id,
            "element_type": self.element_type.value,
            "description": self.description,
            "statutory_basis": self.statutory_basis,
            "is_mandatory": self.is_mandatory,
            "weight": self.weight,
            "precedence": self.precedence
        }


@dataclass
class DoctrinalTest:
    """A structured legal test or standard."""
    test_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    description: str = ""
    steps: List[Dict] = field(default_factory=list)
    burden_of_proof: str = "preponderance"  # Default
    threshold: str = ""
    factors: List[LegalElement] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation."""
        return {
            "test_id": self.test_id,
            "name": self.name,
            "description": self.description,
            "steps": self.steps,
            "burden_of_proof": self.burden_of_proof,
            "threshold": self.threshold,
            "factors": [factor.to_dict() for factor in self.factors]
        }


class DoctrineBuilder:
    """
    Builder for structured legal doctrine.
    
    This class transforms authoritative legal materials into
    structured doctrinal objects that explain legal operation.
    """
    
    def __init__(self):
        self.generated_at = datetime.utcnow().isoformat()
        self.doctrine_count = 0
    
    def build_definition(
        self,
        concept: str,
        statute: str,
        elements: List[Union[str, LegalElement]],
        purpose: str,
        context: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Build a legal definition doctrine.
        
        Args:
            concept: The legal concept being defined
            statute: Authoritative statutory basis
            elements: Core elements of the definition
            purpose: Normative purpose of the definition
            context: Additional context (jurisdiction, area of law, etc.)
            
        Returns:
            Structured definition doctrine
        """
        self.doctrine_count += 1
        
        # Process elements
        processed_elements = []
        for elem in elements:
            if isinstance(elem, LegalElement):
                processed_elements.append(elem.to_dict())
            else:
                processed_elements.append(str(elem))
        
        doctrine_object = {
            "doctrine_id": f"DEF_{self.doctrine_count:06d}",
            "template": TemplateType.DEFINITION.value,
            "statute_anchor": statute,
            "concept": concept,
            "generated_at": self.generated_at,
            "context": context or {},
            "doctrine": {
                "legal_definition": f"{concept} as defined and regulated under {statute}.",
                "core_elements": processed_elements,
                "normative_purpose": purpose,
                "statutory_basis": statute,
                "doctrine_type": "definition"
            }
        }
        
        return doctrine_object
    
    def build_rule(
        self,
        rule_name: str,
        statute: str,
        requirements: List[Union[str, LegalElement]],
        consequence: str,
        exceptions: Optional[List[str]] = None,
        test: Optional[DoctrinalTest] = None
    ) -> Dict[str, Any]:
        """
        Build a legal rule doctrine.
        
        Args:
            rule_name: Name/statement of the rule
            statute: Authoritative statutory basis
            requirements: Elements required to trigger the rule
            consequence: Legal consequence of rule application
            exceptions: List of exceptions to the rule
            test: Optional test for applying the rule
            
        Returns:
            Structured rule doctrine
        """
        self.doctrine_count += 1
        
        # Process requirements
        processed_requirements = []
        for req in requirements:
            if isinstance(req, LegalElement):
                processed_requirements.append(req.to_dict())
            else:
                processed_requirements.append(str(req))
        
        doctrine_object = {
            "doctrine_id": f"RULE_{self.doctrine_count:06d}",
            "template": TemplateType.RULE.value,
            "statute_anchor": statute,
            "rule": rule_name,
            "generated_at": self.generated_at,
            "doctrine": {
                "rule_statement": rule_name,
                "requirements": processed_requirements,
                "legal_consequence": consequence,
                "exceptions": exceptions or [],
                "doctrine_type": "rule"
            }
        }
        
        # Add test if provided
        if test:
            doctrine_object["doctrine"]["application_test"] = test.to_dict()
        
        return doctrine_object
    
    def build_principle(
        self,
        principle_name: str,
        statute: str,
        scope: str,
        function: str,
        balancing_factors: Optional[List[str]] = None,
        policy_rationale: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Build a legal principle doctrine.
        
        Args:
            principle_name: Name/statement of the principle
            statute: Authoritative basis
            scope: Scope of application
            function: Systemic function of the principle
            balancing_factors: Factors for balancing applications
            policy_rationale: Underlying policy justification
            
        Returns:
            Structured principle doctrine
        """
        self.doctrine_count += 1
        
        doctrine_object = {
            "doctrine_id": f"PRIN_{self.doctrine_count:06d}",
            "template": TemplateType.PRINCIPLE.value,
            "statute_anchor": statute,
            "principle": principle_name,
            "generated_at": self.generated_at,
            "doctrine": {
                "principle_statement": principle_name,
                "scope_of_application": scope,
                "systemic_function": function,
                "balancing_factors": balancing_factors or [],
                "policy_justification": policy_rationale,
                "doctrine_type": "principle"
            }
        }
        
        return doctrine_object
    
    def build_test(
        self,
        test_name: str,
        statute: str,
        steps: List[Dict],
        standard: str,
        burden: str = "preponderance",
        factors: Optional[List[LegalElement]] = None
    ) -> Dict[str, Any]:
        """
        Build a legal test doctrine.
        
        Args:
            test_name: Name of the test
            statute: Authoritative basis
            steps: Sequential steps of the test
            standard: Evaluation standard
            burden: Burden of proof
            factors: Legal factors to consider
            
        Returns:
            Structured test doctrine
        """
        self.doctrine_count += 1
        
        doctrine_object = {
            "doctrine_id": f"TEST_{self.doctrine_count:06d}",
            "template": TemplateType.TEST.value,
            "statute_anchor": statute,
            "test": test_name,
            "generated_at": self.generated_at,
            "doctrine": {
                "test_name": test_name,
                "steps": steps,
                "evaluation_standard": standard,
                "burden_of_proof": burden,
                "factors": [factor.to_dict() for factor in (factors or [])],
                "doctrine_type": "test"
            }
        }
        
        return doctrine_object
    
    def build_composite_doctrine(
        self,
        main_doctrine: Dict,
        related_doctrines: List[Dict],
        relationship_type: str = "hierarchical"
    ) -> Dict[str, Any]:
        """
        Build composite doctrine with related sub-doctrines.
        
        Args:
            main_doctrine: Primary doctrine object
            related_doctrines: Related subordinate doctrines
            relationship_type: Type of relationship between doctrines
            
        Returns:
            Composite doctrine structure
        """
        self.doctrine_count += 1
        
        composite = {
            "doctrine_id": f"COMP_{self.doctrine_count:06d}",
            "template": "composite",
            "main_doctrine": main_doctrine,
            "related_doctrines": related_doctrines,
            "relationship_type": relationship_type,
            "generated_at": self.generated_at,
            "doctrine_count": len(related_doctrines) + 1
        }
        
        return composite
    
    def extract_elements_from_text(
        self,
        text: str,
        element_type: LegalElementType = LegalElementType.REQUISITE
    ) -> List[LegalElement]:
        """
        Extract legal elements from text (basic implementation).
        
        Args:
            text: Text to analyze
            element_type: Type of elements to extract
            
        Returns:
            List of legal elements
        """
        # This is a simplified implementation
        # In production, this would use NLP to identify legal elements
        elements = []
        
        # Simple keyword-based extraction for demonstration
        keywords = {
            LegalElementType.REQUISITE: ["must", "shall", "required", "necessity"],
            LegalElementType.FACTOR: ["factor", "consideration", "element", "aspect"],
            LegalElementType.CONDITION: ["if", "when", "provided that", "condition"],
            LegalElementType.EXCEPTION: ["except", "unless", "however", "notwithstanding"]
        }
        
        sentences = text.split('.')
        for i, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if any(keyword in sentence.lower() for keyword in keywords.get(element_type, [])):
                element = LegalElement(
                    element_type=element_type,
                    description=sentence,
                    precedence=i
                )
                elements.append(element)
        
        return elements
    
    def get_stats(self) -> Dict[str, Any]:
        """Get builder statistics."""
        return {
            "doctrines_generated": self.doctrine_count,
            "generated_at": self.generated_at,
            "builder_version": "1.0.0"
        }