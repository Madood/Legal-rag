"""
DOCTRINE VALIDATOR
==================

Validates doctrinal structures for legal legitimacy and completeness.

Purpose:
- Guards against fake or unanchored doctrine
- Ensures doctrinal structures are legally sound
- Prevents hallucination and overgeneralization
- ENFORCES rules from DoctrineTemplates (single source of truth)

Architecture:
This module performs validation ONLY - it does not modify doctrine,
only assesses its validity and returns validation results.

Key Principle:
Validator ENFORCES rules, does not DECIDE them.
Rules come from DoctrineTemplates (single source of truth).
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import re

from .doctrine_templates import TemplateType, DoctrineTemplates


class ValidationLevel(str, Enum):
    """Levels of validation severity."""
    CRITICAL = "critical"  # Invalidates doctrine entirely
    ERROR = "error"        # Serious issue requiring correction
    WARNING = "warning"    # Potential issue, may be acceptable
    INFO = "info"          # Informational note


class ValidationRule(str, Enum):
    """Specific validation rules."""
    STATUTE_ANCHOR_REQUIRED = "statute_anchor_required"
    TEMPLATE_COMPLIANCE = "template_compliance"
    DOCTRINE_CONTENT_REQUIRED = "doctrine_content_required"
    NO_HALLUCINATED_ELEMENTS = "no_hallucinated_elements"
    JURISDICTION_CONSISTENCY = "jurisdiction_consistency"
    NO_CONTRADICTIONS = "no_contradictions"
    COMPLETE_REQUIREMENTS = "complete_requirements"
    CLEAR_CONSEQUENCES = "clear_consequences"


@dataclass
class ValidationIssue:
    """An individual validation issue."""
    rule: ValidationRule
    level: ValidationLevel
    message: str
    location: Optional[str] = None
    suggestion: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation."""
        return {
            "rule": self.rule.value,
            "level": self.level.value,
            "message": self.message,
            "location": self.location,
            "suggestion": self.suggestion
        }


@dataclass
class ValidationResult:
    """Complete validation result for a doctrine object."""
    is_valid: bool = False
    issues: List[ValidationIssue] = field(default_factory=list)
    warnings_count: int = 0
    errors_count: int = 0
    critical_count: int = 0
    confidence_modifier: float = 1.0
    
    def add_issue(
        self,
        rule: ValidationRule,
        level: ValidationLevel,
        message: str,
        location: Optional[str] = None,
        suggestion: Optional[str] = None
    ):
        """Add a validation issue."""
        issue = ValidationIssue(
            rule=rule,
            level=level,
            message=message,
            location=location,
            suggestion=suggestion
        )
        self.issues.append(issue)
        
        # Update counters
        if level == ValidationLevel.CRITICAL:
            self.critical_count += 1
            self.is_valid = False
        elif level == ValidationLevel.ERROR:
            self.errors_count += 1
            self.is_valid = False
        elif level == ValidationLevel.WARNING:
            self.warnings_count += 1
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation."""
        return {
            "is_valid": self.is_valid,
            "issues": [issue.to_dict() for issue in self.issues],
            "summary": {
                "total_issues": len(self.issues),
                "critical_count": self.critical_count,
                "errors_count": self.errors_count,
                "warnings_count": self.warnings_count
            },
            "confidence_modifier": self.confidence_modifier
        }
    
    def get_issues_by_level(self, level: ValidationLevel) -> List[ValidationIssue]:
        """Get issues filtered by severity level."""
        return [issue for issue in self.issues if issue.level == level]


class DoctrineValidator:
    """
    Validator for doctrinal structures.
    
    This class ensures that doctrine objects are:
    1. Properly anchored in authority (per DoctrineTemplates rules)
    2. Structurally complete
    3. Legally coherent
    4. Free from hallucination
    
    ARCHITECTURAL RULE:
    This validator NEVER decides which domains allow implicit authority.
    It only ENFORCES rules from DoctrineTemplates.get_doctrinal_field_info().
    """
    
    # Common legal citation patterns
    STATUTE_PATTERNS = [
        r'\d+\s+[A-Z]\.?S\.?\s+§?\s*\d+',  # e.g., "42 U.S. § 1983"
        r'[A-Z][a-z]+\s+Code\s+§?\s*\d+',   # e.g., "California Code § 1234"
        r'Act\s+of\s+\d{4}',                 # e.g., "Act of 1990"
        r'\d+\s+[A-Z]{2,}\s+\d+',           # e.g., "42 USC 1983"
        # Civil law patterns
        r'Civil\s+Code\s+(?:Art\.?\s*)?\d+',  # e.g., "Civil Code Art. 1382"
        r'BGB\s+§\s*\d+',                     # e.g., "BGB § 823"
        r'Code\s+civil\s+(?:art\.?\s*)?\d+',  # e.g., "Code civil art. 1240"
        r'StGB\s+§\s*\d+',                    # e.g., "StGB § 211"
    ]
    
    # Indicators of potentially hallucinated content
    HALLUCINATION_INDICATORS = [
        # Vague authority indicators
        "it is well established that",
        "generally accepted",
        "most courts agree",
        "the prevailing view is", 
        "it can be argued that",
        "one might conclude",
        "typically",
        "usually",
        # Legal-specific vague language
        "as a matter of law",
        "it is axiomatic that",
        "without question",
        "undoubtedly",
        "clearly",
        "obviously",
        "it goes without saying",
        "everyone knows that"
    ]
    
    def __init__(self, strict_mode: bool = True):
        """
        Initialize validator.
        
        Args:
            strict_mode: If True, warnings are treated as errors
        """
        self.strict_mode = strict_mode
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) 
                                 for pattern in self.STATUTE_PATTERNS]
    
    def validate(self, doctrine_object: Dict[str, Any]) -> ValidationResult:
        """
        Comprehensive validation of a doctrine object.
        
        Args:
            doctrine_object: Doctrine object to validate
            
        Returns:
            ValidationResult with detailed issues
        """
        result = ValidationResult(is_valid=True)
        
        # Basic structure validation
        if not self._validate_basic_structure(doctrine_object, result):
            return result
        
        # Extract components for validation
        template_type = doctrine_object.get("template")
        statute_anchor = doctrine_object.get("statute_anchor")
        doctrine_content = doctrine_object.get("doctrine", {})
        
        # Core validations
        self._validate_statute_anchor(statute_anchor, result, doctrine_object)
        self._validate_template_compliance(doctrine_content, template_type, result)
        self._validate_doctrine_content(doctrine_content, result)
        self._validate_no_hallucination(doctrine_content, result)
        
        # Contextual validations
        self._validate_jurisdiction_consistency(doctrine_object, result)
        self._validate_no_contradictions(doctrine_content, result)
        
        # Template-specific validations
        if template_type == TemplateType.RULE.value:
            self._validate_rule_requirements(doctrine_content, result)
        elif template_type == TemplateType.TEST.value:
            self._validate_test_structure(doctrine_content, result)
        
        # Final validity determination
        if self.strict_mode and (result.errors_count > 0 or result.warnings_count > 0):
            result.is_valid = False
        elif result.critical_count > 0:
            result.is_valid = False
        elif result.errors_count > 0:
            result.is_valid = False
        
        return result
    
    def _validate_basic_structure(
        self, 
        doctrine_object: Dict, 
        result: ValidationResult
    ) -> bool:
        """Validate basic object structure."""
        if not doctrine_object or not isinstance(doctrine_object, dict):
            result.add_issue(
                rule=ValidationRule.DOCTRINE_CONTENT_REQUIRED,
                level=ValidationLevel.CRITICAL,
                message="Doctrine object is empty or not a dictionary",
                location="root"
            )
            return False
        
        if "doctrine" not in doctrine_object:
            result.add_issue(
                rule=ValidationRule.DOCTRINE_CONTENT_REQUIRED,
                level=ValidationLevel.CRITICAL,
                message="Missing 'doctrine' key in object",
                location="root"
            )
            return False
        
        return True
    
    def _validate_statute_anchor(
        self, 
        statute_anchor: Optional[str], 
        result: ValidationResult,
        doctrine_object: Dict
    ):
        """
        Validate statute anchor presence and format.
        
        CRITICAL: This method ONLY enforces rules from DoctrineTemplates.
        It NEVER decides which domains allow implicit authority.
        """
        # Get domain and field from context
        context = doctrine_object.get("context", {})
        domain = context.get("domain", "").strip()
        field = context.get("field", "").strip()
        
        # Get doctrinal field info from SINGLE SOURCE OF TRUTH
        field_info = DoctrineTemplates.get_doctrinal_field_info(domain, field)
        implicit_allowed = field_info.get("implicit_allowed", False)
        source = field_info.get("source", "unknown")
        
        if not statute_anchor:
            # Check if implicit authority is allowed (per DoctrineTemplates)
            if domain and implicit_allowed:
                # Allow implicit statutory anchoring - downgrade confidence
                result.confidence_modifier *= 0.9
                result.add_issue(
                    rule=ValidationRule.STATUTE_ANCHOR_REQUIRED,
                    level=ValidationLevel.WARNING,
                    message=f"Implicit authority accepted ({source}) for {domain}" + 
                           (f"/{field}" if field else ""),
                    location="statute_anchor",
                    suggestion="Consider adding explicit citation if available"
                )
                return
            else:
                # Missing required statute anchor
                level = ValidationLevel.CRITICAL if domain else ValidationLevel.ERROR
                result.add_issue(
                    rule=ValidationRule.STATUTE_ANCHOR_REQUIRED,
                    level=level,
                    message="Missing statute anchor" + 
                           (f" for {domain}" if domain else ""),
                    location="statute_anchor",
                    suggestion="Add a specific statutory citation or authoritative source"
                )
                return
        
        # Validate citation format (doesn't depend on implicit authority rules)
        self._validate_citation_format(statute_anchor, result)
    
    def _validate_citation_format(
        self,
        statute_anchor: str,
        result: ValidationResult
    ):
        """Validate citation format without domain inference."""
        # Check if it looks like a legal citation
        is_valid_citation = False
        for pattern in self.compiled_patterns:
            if pattern.search(statute_anchor):
                is_valid_citation = True
                break
        
        if not is_valid_citation:
            # Check for common non-pattern citations
            common_citations = [
                "constitution", "regulation", "ordinance", 
                "charter", "common law", "case law", "precedent",
                "grundgesetz", "verfassung", "gesetz"
            ]
            
            citation_found = any(citation in statute_anchor.lower() 
                                for citation in common_citations)
            
            if not citation_found:
                result.add_issue(
                    rule=ValidationRule.STATUTE_ANCHOR_REQUIRED,
                    level=ValidationLevel.WARNING,
                    message=f"Statute anchor format may be non-standard: '{statute_anchor}'",
                    location="statute_anchor",
                    suggestion="Use standard legal citation format when possible"
                )
    
    def _validate_template_compliance(
        self,
        doctrine_content: Dict,
        template_type: Optional[str],
        result: ValidationResult
    ):
        """Validate that content matches template requirements."""
        if not template_type:
            result.add_issue(
                rule=ValidationRule.TEMPLATE_COMPLIANCE,
                level=ValidationLevel.ERROR,
                message="Missing template type",
                location="template"
            )
            return
        
        try:
            # Convert string to TemplateType enum
            template_enum = TemplateType(template_type)
            
            # Check if template is valid
            if not DoctrineTemplates.validate_template_structure(doctrine_content, template_enum):
                result.add_issue(
                    rule=ValidationRule.TEMPLATE_COMPLIANCE,
                    level=ValidationLevel.ERROR,
                    message=f"Doctrine content does not match {template_type} template structure",
                    location="doctrine",
                    suggestion=f"Ensure all required sections for {template_type} are present and non-empty"
                )
        except ValueError:
            result.add_issue(
                rule=ValidationRule.TEMPLATE_COMPLIANCE,
                level=ValidationLevel.ERROR,
                message=f"Unknown template type: {template_type}",
                location="template",
                suggestion=f"Use one of: {[t.value for t in TemplateType]}"
            )
    
    def _validate_doctrine_content(
        self,
        doctrine_content: Dict,
        result: ValidationResult
    ):
        """Validate doctrine content completeness and quality."""
        if not doctrine_content or not isinstance(doctrine_content, dict):
            result.add_issue(
                rule=ValidationRule.DOCTRINE_CONTENT_REQUIRED,
                level=ValidationLevel.CRITICAL,
                message="Doctrine content is empty or invalid",
                location="doctrine"
            )
            return
        
        # Check for empty sections
        for key, value in doctrine_content.items():
            if value in (None, "", [], {}):
                result.add_issue(
                    rule=ValidationRule.COMPLETE_REQUIREMENTS,
                    level=ValidationLevel.WARNING,
                    message=f"Doctrine section '{key}' is empty",
                    location=f"doctrine.{key}",
                    suggestion="Provide content for this section or remove it if not applicable"
                )
    
    def _validate_no_hallucination(
        self,
        doctrine_content: Dict,
        result: ValidationResult
    ):
        """Check for indicators of hallucinated content."""
        # Convert content to text for pattern matching
        content_text = self._dict_to_text(doctrine_content)
        
        for indicator in self.HALLUCINATION_INDICATORS:
            if indicator in content_text.lower():
                result.add_issue(
                    rule=ValidationRule.NO_HALLUCINATED_ELEMENTS,
                    level=ValidationLevel.WARNING,
                    message=f"Content contains potential hallucination indicator: '{indicator}'",
                    location="doctrine",
                    suggestion="Replace vague language with specific citations or qualifications"
                )
    
    def _validate_jurisdiction_consistency(
        self,
        doctrine_object: Dict,
        result: ValidationResult
    ):
        """Validate jurisdiction consistency within doctrine."""
        context = doctrine_object.get("context", {})
        statute_anchor = doctrine_object.get("statute_anchor", "")
        
        # Extract jurisdiction hints
        jurisdiction_hints = []
        
        # From context
        if "jurisdiction" in context:
            jurisdiction_hints.append(context["jurisdiction"])
        
        # From statute anchor (simple extraction)
        common_jurisdictions = ["german", "germany", "us", "federal", "uniform", "model", "eu"]
        for jurisdiction in common_jurisdictions:
            if jurisdiction in statute_anchor.lower():
                jurisdiction_hints.append(jurisdiction.capitalize())
        
        # Check for contradictions
        if len(set(jurisdiction_hints)) > 1:
            result.add_issue(
                rule=ValidationRule.JURISDICTION_CONSISTENCY,
                level=ValidationLevel.WARNING,
                message=f"Multiple jurisdiction hints detected: {jurisdiction_hints}",
                location="context/statute_anchor",
                suggestion="Ensure doctrine is consistently anchored to a single jurisdiction"
            )
    
    def _validate_no_contradictions(
        self,
        doctrine_content: Dict,
        result: ValidationResult
    ):
        """Check for internal contradictions in doctrine."""
        contradictions = []
        content_text = self._dict_to_text(doctrine_content).lower()
        
        # Common contradiction patterns
        contradiction_pairs = [
            ("must", "cannot"),
            ("required", "prohibited"),
            ("always", "never"),
            ("all", "none"),
            ("mandatory", "optional"),
            ("shall", "shall not"),
            ("necessary", "unnecessary")
        ]
        
        for term1, term2 in contradiction_pairs:
            if term1 in content_text and term2 in content_text:
                contradictions.append(f"{term1}/{term2}")
        
        if contradictions:
            result.add_issue(
                rule=ValidationRule.NO_CONTRADICTIONS,
                level=ValidationLevel.WARNING,
                message=f"Potential contradictions detected: {contradictions}",
                location="doctrine",
                suggestion="Review doctrine for logical consistency"
            )
    
    def _validate_rule_requirements(
        self,
        doctrine_content: Dict,
        result: ValidationResult
    ):
        """Validate rule-specific requirements."""
        requirements = doctrine_content.get("requirements", [])
        consequence = doctrine_content.get("legal_consequence", "")
        
        if not requirements:
            result.add_issue(
                rule=ValidationRule.COMPLETE_REQUIREMENTS,
                level=ValidationLevel.ERROR,
                message="Rule has no specified requirements",
                location="doctrine.requirements"
            )
        
        if not consequence:
            result.add_issue(
                rule=ValidationRule.CLEAR_CONSEQUENCES,
                level=ValidationLevel.ERROR,
                message="Rule has no specified legal consequence",
                location="doctrine.legal_consequence"
            )
    
    def _validate_test_structure(
        self,
        doctrine_content: Dict,
        result: ValidationResult
    ):
        """Validate test-specific structure."""
        steps = doctrine_content.get("steps", [])
        standard = doctrine_content.get("evaluation_standard", "")
        
        if not steps:
            result.add_issue(
                rule=ValidationRule.COMPLETE_REQUIREMENTS,
                level=ValidationLevel.ERROR,
                message="Legal test has no steps defined",
                location="doctrine.steps"
            )
        
        if not standard:
            result.add_issue(
                rule=ValidationRule.CLEAR_CONSEQUENCES,
                level=ValidationLevel.ERROR,
                message="Legal test has no evaluation standard",
                location="doctrine.evaluation_standard"
            )
    
    def _dict_to_text(self, d: Dict, depth: int = 0) -> str:
        """Recursively convert dictionary to text for pattern matching."""
        text_parts = []
        
        for key, value in d.items():
            if isinstance(value, dict):
                text_parts.append(self._dict_to_text(value, depth + 1))
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        text_parts.append(self._dict_to_text(item, depth + 1))
                    else:
                        text_parts.append(str(item))
            else:
                text_parts.append(str(value))
        
        return " ".join(text_parts)
    
    def validate_batch(
        self,
        doctrine_objects: List[Dict[str, Any]]
    ) -> Dict[str, ValidationResult]:
        """
        Validate multiple doctrine objects.
        
        Args:
            doctrine_objects: List of doctrine objects to validate
            
        Returns:
            Dictionary mapping doctrine_id to validation result
        """
        results = {}
        
        for doctrine in doctrine_objects:
            doctrine_id = doctrine.get("doctrine_id", f"unknown_{len(results)}")
            results[doctrine_id] = self.validate(doctrine)
        
        return results
    
    def get_validation_summary(
        self,
        validation_results: Dict[str, ValidationResult]
    ) -> Dict[str, Any]:
        """
        Generate summary statistics from batch validation.
        
        Args:
            validation_results: Dictionary of validation results
            
        Returns:
            Summary statistics
        """
        total = len(validation_results)
        valid = sum(1 for result in validation_results.values() if result.is_valid)
        
        total_issues = sum(len(result.issues) for result in validation_results.values())
        total_critical = sum(result.critical_count for result in validation_results.values())
        total_errors = sum(result.errors_count for result in validation_results.values())
        total_warnings = sum(result.warnings_count for result in validation_results.values())
        
        # Track confidence modifications
        implicit_auth_count = sum(1 for result in validation_results.values() 
                                 if result.confidence_modifier < 1.0)
        
        # Most common issues
        issue_counts = {}
        for result in validation_results.values():
            for issue in result.issues:
                rule = issue.rule.value
                issue_counts[rule] = issue_counts.get(rule, 0) + 1
        
        most_common = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "total_doctrines": total,
            "valid_doctrines": valid,
            "validity_rate": round(valid / total * 100, 2) if total > 0 else 0,
            "issue_statistics": {
                "total_issues": total_issues,
                "critical_issues": total_critical,
                "error_issues": total_errors,
                "warning_issues": total_warnings
            },
            "implicit_authority_count": implicit_auth_count,
            "most_common_issues": most_common
        }