"""
Doctrine Inductor - Orchestrates doctrine induction from retrieval results.

COMPATIBLE WITH EXISTING DOCTRINE SYSTEM:
- doctrine_builder.py
- doctrine_validator.py  
- doctrine_templates.py
"""

from typing import Dict, List, Optional, Any
import logging
from dataclasses import dataclass

# Import your existing doctrine components CORRECTLY
from .doctrine_builder import DoctrineBuilder, LegalElement
from .doctrine_validator import DoctrineValidator, ValidationResult
from .doctrine_templates import DoctrineTemplates, TemplateType

logger = logging.getLogger(__name__)


@dataclass
class InductionConfig:
    """Configuration for doctrine induction"""
    strict_mode: bool = True
    require_statute_anchor: bool = True
    require_paragraph_match: bool = True
    min_confidence_threshold: float = 0.7
    max_hallucination_score: float = 0.3
    enforce_examiner_standards: bool = True


@dataclass
class InductionContext:
    """Context for doctrine induction"""
    question_type: str = "GENERAL"
    retrieval_results: Optional[List[Dict]] = None
    statute: Optional[str] = None
    paragraph: Optional[str] = None
    authority_constraints: Optional[Dict] = None
    strict_mode_enforced: bool = False
    domain: Optional[str] = None
    field: Optional[str] = None


@dataclass
class DoctrineInductionResult:
    """Result of doctrine induction"""
    doctrine: Optional[Dict] = None
    validation: Optional[Dict] = None
    is_valid: bool = False
    confidence: float = 0.0
    template_used: Optional[str] = None
    doctrinal_field: Optional[str] = None
    status: str = "not_applied"
    message: str = ""
    examiner_ready: bool = False
    requires_clarification: bool = False


class DoctrineInductor:
    """
    Orchestrates doctrine induction from retrieval results.
    
    This is the central controller that determines when and how to apply
    doctrinal reasoning to legal questions.
    
    COMPATIBILITY NOTES:
    1. Uses DoctrineTemplates.get_field_for_question() for field detection
    2. Respects DoctrineBuilder method signatures
    3. Adds context to doctrine objects (not embedded in builder output)
    4. Validator reads context, not root-level keys
    """

    def __init__(self, config: Optional[InductionConfig] = None):
        """
        Initialize the doctrine inductor.
        
        Args:
            config: Configuration for doctrine induction
        """
        self.config = config or InductionConfig()
        self.builder = DoctrineBuilder()
        self.validator = DoctrineValidator(strict_mode=self.config.strict_mode)
        
        logger.info(f"DoctrineInductor initialized with strict_mode={self.config.strict_mode}")

    def induct(
        self,
        question: str,
        statute: Optional[str] = None,
        paragraph: Optional[str] = None,
        retrieval_results: Optional[List[Dict]] = None,
        context: Optional[InductionContext] = None
    ) -> DoctrineInductionResult:
        """
        Induce doctrine from retrieval results.
        
        Args:
            question: The legal question being asked
            statute: The applicable statute (e.g., "BGB", "StGB") [Optional]
            paragraph: The specific paragraph (e.g., "286") [Optional]
            retrieval_results: Results from authority-contracted retrieval
            context: Additional context for induction
            
        Returns:
            DoctrineInductionResult containing doctrine object and validation
        """
        logger.info(f"Doctrine induction for: {statute or 'NO_STATUTE'} §{paragraph or 'NO_PARAGRAPH'} - '{question[:50]}...'")
        
        # Create default context if not provided
        if context is None:
            context = InductionContext(
                statute=statute,
                paragraph=paragraph,
                retrieval_results=retrieval_results or [],
                question_type="GENERAL"
            )
        else:
            # Ensure retrieval_results is not None
            if context.retrieval_results is None:
                context.retrieval_results = retrieval_results or []
        
        # Step 1: Check if doctrine should be applied
        should_apply = self._should_apply_doctrine(question, statute, paragraph, context.retrieval_results, context)
        
        if not should_apply:
            return DoctrineInductionResult(
                status="not_applied",
                message="Doctrine not required for this question type",
                examiner_ready=False
            )
        
        # Step 2: Determine doctrinal field using CORRECT method
        field_info = self._determine_doctrinal_field(question, context)
        
        if not field_info:
            return DoctrineInductionResult(
                status="no_field_determined",
                message="Could not determine appropriate doctrinal field",
                examiner_ready=False,
                requires_clarification=True
            )
        
        # Update context with field info
        context.domain = field_info.get("domain")
        context.field = field_info.get("field") or "unclassified"  # 🔴 FIXED: Never empty field
        
        # Step 3: Build doctrine object based on field
        doctrine = self._build_doctrine_object(
            question=question,
            field_info=field_info,
            context=context
        )
        
        if not doctrine:
            return DoctrineInductionResult(
                status="doctrine_build_failed",
                message="Failed to build doctrine object",
                examiner_ready=False
            )
        
        # Step 4: Validate doctrine
        validation = self.validator.validate(doctrine)
        
        # Step 5: Determine examiner readiness
        examiner_ready = self._determine_examiner_readiness(validation, doctrine, context)
        
        # Step 6: Calculate confidence
        confidence = self._calculate_confidence(validation, doctrine, context.retrieval_results, context)
        
        return DoctrineInductionResult(
            doctrine=doctrine,
            validation=validation.to_dict() if hasattr(validation, 'to_dict') else validation,
            is_valid=validation.is_valid if hasattr(validation, 'is_valid') else False,
            confidence=confidence,
            template_used=field_info.get("template_type", ""),
            doctrinal_field=f"{field_info.get('domain', '')}.{field_info.get('field', 'unclassified')}",
            status="applied" if confidence > 0.5 else "low_confidence",
            message=f"Doctrine applied: {field_info.get('field', 'unknown')}",
            examiner_ready=examiner_ready,
            requires_clarification=confidence < self.config.min_confidence_threshold
        )

    def _should_apply_doctrine(
        self,
        question: str,
        statute: Optional[str],
        paragraph: Optional[str],
        retrieval_results: List[Dict],
        context: InductionContext
    ) -> bool:
        """
        Determine if doctrine should be applied to this question.
        """
        # Always apply in strict mode
        if context.strict_mode_enforced:
            logger.info("Doctrine required: Strict mode enforcement")
            return True
        
        # Check question type
        question_lower = question.lower()
        doctrinal_indicators = [
            "explain", "analyze", "interpret", "apply", "what does", 
            "how does", "meaning of", "requirement", "element", "principle",
            "doctrine", "legal effect", "consequence", "voraussetzung",
            "prüfen", "prüfungsreihenfolge", "rechtliche beurteilung"
        ]
        
        for indicator in doctrinal_indicators:
            if indicator in question_lower:
                logger.info(f"Doctrine required: Question contains '{indicator}'")
                return True
        
        # Check if we have paragraph information
        if statute and paragraph:
            logger.info(f"Doctrine required: Specific paragraph {statute} §{paragraph}")
            return True
        
        # Check retrieval results for normative content
        normative_count = sum(1 for r in retrieval_results if r.get("is_normative", False))
        if normative_count > 0:
            logger.info(f"Doctrine required: Found {normative_count} normative documents")
            return True
        
        logger.info("Doctrine not required for this question")
        return False

    def _determine_doctrinal_field(
        self,
        question: str,
        context: InductionContext
    ) -> Optional[Dict]:
        """
        Determine which doctrinal field applies to this question.
        
        Uses DoctrineTemplates.get_field_for_question() - SINGLE SOURCE OF TRUTH.
        """
        # Extract context for field detection
        detection_context = {}
        if context.domain:
            detection_context["domain"] = context.domain
        
        # Use CORRECT method from DoctrineTemplates
        field_info = DoctrineTemplates.get_field_for_question(question, detection_context)
        
        if not field_info:
            logger.warning("Could not determine doctrinal field")
            return None
        
        logger.info(f"Determined doctrinal field: {field_info.get('domain')}.{field_info.get('field')}")
        
        # Get template type from config
        config = field_info.get("config", {})
        template_type = config.get("template_type", TemplateType.RULE)
        
        return {
            "domain": field_info.get("domain"),
            "field": field_info.get("field") or "unclassified",  # 🔴 FIXED: Never empty
            "template_type": template_type,
            "config": config,
            "match_score": field_info.get("match_score", 0.0),
            "inferred": field_info.get("inferred", False)
        }

    def _build_doctrine_object(
        self,
        question: str,
        field_info: Dict,
        context: InductionContext
    ) -> Optional[Dict]:
        """
        Build doctrine object based on determined field.
        
        RESPECTS existing DoctrineBuilder method signatures.
        """
        # 🔴 FIXED: Normalize template_type to TemplateType enum
        template_type_raw = field_info.get("template_type")
        if isinstance(template_type_raw, str):
            try:
                template_type = TemplateType(template_type_raw)
            except ValueError:
                logger.warning(f"Unknown template type: {template_type_raw}, defaulting to RULE")
                template_type = TemplateType.RULE
        elif isinstance(template_type_raw, TemplateType):
            template_type = template_type_raw
        else:
            template_type = TemplateType.RULE
        
        domain = field_info.get("domain", "")
        field = field_info.get("field", "unclassified")  # 🔴 FIXED: Never empty
        
        try:
            # Get resolved authority from DoctrineTemplates
            authority_info = DoctrineTemplates.resolve_implicit_authority(
                domain=domain,
                field=field,
                provided_statute=context.statute,
                provided_paragraphs=[context.paragraph] if context.paragraph else None
            )
            
            # Determine statute to use
            statute_to_use = authority_info.get("statute") or context.statute or "German Law"
            
            # Extract requirements from retrieval results
            requirements = self._extract_requirements(context.retrieval_results)
            
            # Build doctrine based on template type
            if template_type == TemplateType.RULE:
                doctrine = self._build_rule_doctrine(
                    question=question,
                    statute=statute_to_use,
                    requirements=requirements,
                    context=context
                )
            elif template_type == TemplateType.PRINCIPLE:
                doctrine = self._build_principle_doctrine(
                    question=question,
                    statute=statute_to_use,
                    context=context
                )
            elif template_type == TemplateType.DEFINITION:
                doctrine = self._build_definition_doctrine(
                    question=question,
                    statute=statute_to_use,
                    context=context
                )
            elif template_type == TemplateType.TEST:
                doctrine = self._build_test_doctrine(
                    question=question,
                    statute=statute_to_use,
                    context=context
                )
            else:
                # Default to rule
                doctrine = self._build_rule_doctrine(
                    question=question,
                    statute=statute_to_use,
                    requirements=requirements,
                    context=context
                )
            
            if not doctrine:
                return None
            
            # Add context to doctrine (VALIDATOR READS THIS)
            doctrine["context"] = {
                "statute": statute_to_use,
                "paragraph": context.paragraph,
                "question": question,
                "domain": domain,
                "field": field,  # 🔴 FIXED: Never empty
                "authority_info": authority_info,
                "retrieval_sources": [
                    r.get("document_id", "") 
                    for r in context.retrieval_results[:3] 
                    if r.get("document_id")
                ]
            }
            
            return doctrine
            
        except Exception as e:
            logger.error(f"Failed to build doctrine object: {e}", exc_info=True)
            return None

    def _build_rule_doctrine(
        self,
        question: str,
        statute: str,
        requirements: List[str],
        context: InductionContext
    ) -> Dict:
        """Build a RULE doctrine object using CORRECT builder signature."""
        # Create rule name
        rule_name = f"Anwendung von {statute}"
        if context.paragraph:
            rule_name += f" §{context.paragraph}"
        
        # Use CORRECT builder signature
        return self.builder.build_rule(
            rule_name=rule_name,
            statute=statute,
            requirements=requirements or ["Die gesetzlichen Voraussetzungen müssen erfüllt sein"],
            consequence="Rechtliche Wirkung tritt ein",
            exceptions=None,
            test=None
        )

    def _build_principle_doctrine(
        self,
        question: str,
        statute: str,
        context: InductionContext
    ) -> Dict:
        """Build a PRINCIPLE doctrine object using CORRECT builder signature."""
        # Extract principle content from retrieval
        principle_content = ""
        for result in context.retrieval_results[:2]:
            content = result.get("content", "")
            if "principle" in content.lower() or "grundsatz" in content.lower():
                principle_content = content[:300]
                break
        
        if not principle_content:
            principle_content = f"Rechtsgrundsatz aus {statute}"
        
        return self.builder.build_principle(
            principle_name=f"Grundsatz gemäß {statute}",
            statute=statute,
            scope="Anwendung im relevanten Rechtsbereich",
            function="Systemische Funktion des Grundsatzes",
            balancing_factors=None,
            policy_rationale="Rechtssicherheit und Fairness"
        )

    def _build_definition_doctrine(
        self,
        question: str,
        statute: str,
        context: InductionContext
    ) -> Dict:
        """Build a DEFINITION doctrine object using CORRECT builder signature."""
        # Extract definition from question
        words = question.split()
        concept = words[-1] if words else "Rechtsbegriff"
        
        # Extract definition elements from retrieval
        elements = []
        for result in context.retrieval_results[:2]:
            content = result.get("content", "")
            if "definition" in content.lower() or "bedeutet" in content.lower():
                elements.append(content[:150])
                break
        
        if not elements:
            elements = [f"Begriffserklärung gemäß {statute}"]
        
        return self.builder.build_definition(
            concept=concept,
            statute=statute,
            elements=elements,
            purpose="Begriffsbestimmung für rechtliche Anwendung"
        )

    def _build_test_doctrine(
        self,
        question: str,
        statute: str,
        context: InductionContext
    ) -> Dict:
        """Build a TEST doctrine object using CORRECT builder signature."""
        # Extract test steps from retrieval
        steps = []
        for i, result in enumerate(context.retrieval_results[:3]):
            content = result.get("content", "")
            if content:
                steps.append({"step": i + 1, "description": content[:100]})
        
        if not steps:
            steps = [{"step": 1, "description": "Prüfung der gesetzlichen Voraussetzungen"}]
        
        return self.builder.build_test(
            test_name=f"Prüfung gemäß {statute}",
            statute=statute,
            steps=steps,
            standard="Verhältnismäßigkeitsprüfung",
            burden="Beweislast nach allgemeinen Grundsätzen"
        )

    def _extract_requirements(self, retrieval_results: List[Dict]) -> List[str]:
        """Extract requirements from retrieval results."""
        requirements = []
        
        for result in retrieval_results[:3]:
            content = result.get("content", "")
            if not content:
                continue
            
            # Look for requirement indicators
            if any(indicator in content.lower() for indicator in 
                  ["voraussetzung", "erfordert", "muss", "sollte", "bedarf"]):
                requirements.append(content[:200])
        
        return requirements if requirements else ["Erfüllung der gesetzlichen Tatbestandsmerkmale"]

    def _determine_examiner_readiness(
        self,
        validation: ValidationResult,
        doctrine: Dict,
        context: InductionContext
    ) -> bool:
        """
        Determine if doctrine is examiner-ready.
        
        CRITICAL: Reads from doctrine["context"], not root-level keys.
        """
        # Check validation result
        if not validation.is_valid:
            return False
        
        # Get context from doctrine
        doctrine_context = doctrine.get("context", {})
        
        # Check statute anchoring
        if context.statute and doctrine_context.get("statute") != context.statute:
            return False
        
        # Check paragraph citation if required
        if context.paragraph and doctrine_context.get("paragraph") != context.paragraph:
            return False
        
        # Check authority sources
        if not doctrine_context.get("retrieval_sources"):
            return False
        
        # Check confidence from validation
        if validation.confidence_modifier < self.config.min_confidence_threshold:
            return False
        
        # Additional checks for strict mode
        if context.strict_mode_enforced:
            # Check for critical issues
            if validation.critical_count > 0:
                return False
            
            # Check for high hallucination risk
            hallucination_issues = [
                issue for issue in validation.issues
                if "hallucination" in issue.message.lower()
            ]
            if len(hallucination_issues) > 0:
                return False
        
        return True

    def _calculate_confidence(
        self,
        validation: ValidationResult,
        doctrine: Dict,
        retrieval_results: List[Dict],
        context: InductionContext
    ) -> float:
        """
        Calculate confidence score for doctrine induction.
        """
        confidence = 0.5  # Base confidence
        
        # Validation contribution
        confidence += validation.confidence_modifier * 0.3
        
        # Statute matching from context
        doctrine_context = doctrine.get("context", {})
        if doctrine_context.get("statute") == context.statute:
            confidence += 0.2
        
        # Paragraph matching (if applicable)
        if context.paragraph and doctrine_context.get("paragraph") == context.paragraph:
            confidence += 0.15
        
        # Authority sources from context
        authority_count = len(doctrine_context.get("retrieval_sources", []))
        confidence += min(authority_count * 0.05, 0.1)
        
        # Retrieval relevance
        if retrieval_results:
            avg_score = sum(r.get("score", 0) for r in retrieval_results[:3]) / min(3, len(retrieval_results))
            confidence += avg_score * 0.25
        
        # Strict mode bonus
        if context.strict_mode_enforced:
            confidence += 0.1
        
        return min(max(confidence, 0.0), 1.0)

    def induct_for_examiner(
        self,
        question: str,
        statute: str,
        paragraph: str,
        retrieval_results: List[Dict],
        authority_constraints: Optional[Dict] = None
    ) -> Dict:
        """
        Special induction method for examiner-grade questions.
        """
        # Create examiner context
        context = InductionContext(
            question_type="EXAMINER",
            statute=statute,
            paragraph=paragraph,
            retrieval_results=retrieval_results,
            authority_constraints=authority_constraints,
            strict_mode_enforced=True
        )
        
        # Use examiner config
        examiner_config = InductionConfig(
            strict_mode=True,
            require_statute_anchor=True,
            require_paragraph_match=True,
            min_confidence_threshold=0.8,
            max_hallucination_score=0.2,
            enforce_examiner_standards=True
        )
        
        # Create temporary inductor with examiner config
        examiner_inductor = DoctrineInductor(config=examiner_config)
        
        # Perform induction
        result = examiner_inductor.induct(
            question=question,
            statute=statute,
            paragraph=paragraph,
            retrieval_results=retrieval_results,
            context=context
        )
        
        # Format for API response
        return {
            "doctrine": result.doctrine,
            "validation": result.validation,
            "examiner_ready": result.examiner_ready,
            "confidence": result.confidence,
            "requires_clarification": result.requires_clarification,
            "status": result.status,
            "message": result.message,
            "metadata": {
                "statute": statute,
                "paragraph": paragraph,
                "doctrinal_field": result.doctrinal_field,
                "template_used": result.template_used,
                "strict_mode": True,
                "examiner_standards_enforced": True
            }
        }

    def validate_template_type_compatibility(self, template_type: Any) -> TemplateType:
        """
        Validate and normalize template type.
        
        Args:
            template_type: Raw template type (string, enum, or unknown)
            
        Returns:
            Normalized TemplateType enum
        """
        if isinstance(template_type, TemplateType):
            return template_type
        elif isinstance(template_type, str):
            try:
                return TemplateType(template_type)
            except ValueError:
                logger.warning(f"Unknown template type: {template_type}, defaulting to RULE")
                return TemplateType.RULE
        else:
            logger.warning(f"Invalid template type format: {type(template_type)}, defaulting to RULE")
            return TemplateType.RULE


# Factory function for easy instantiation
def create_doctrine_inductor(strict_mode: bool = True) -> DoctrineInductor:
    """
    Factory function to create a DoctrineInductor.
    
    Args:
        strict_mode: Whether to enforce strict validation standards
        
    Returns:
        Configured DoctrineInductor instance
    """
    config = InductionConfig(strict_mode=strict_mode)
    return DoctrineInductor(config=config)


# Optional: Create singleton instance for convenience
_default_inductor = None

def get_default_inductor() -> DoctrineInductor:
    """Get or create default singleton DoctrineInductor"""
    global _default_inductor
    if _default_inductor is None:
        _default_inductor = create_doctrine_inductor(strict_mode=True)
    return _default_inductor