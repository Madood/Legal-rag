"""
Norm Validator - Anti-hallucination firewall.

Ensures extracted norms are legitimate, anchored, and structurally sound.
Validates against authority and linguistic criteria.

Architectural Role: Verifies norms are properly grounded in legal sources.
"""

import re
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class ValidationStatus(Enum):
    """Validation status levels."""
    VALID = "valid"        # Fully validated
    WARNING = "warning"    # Minor issues
    INVALID = "invalid"    # Failed validation


class ValidationRule(Enum):
    """Validation rules applied to norms."""
    AUTHORITY_EXISTS = "authority_exists"          # Statute reference valid
    ARTICLE_VALID = "article_valid"                # Article/paragraph exists
    NORMATIVE_LANGUAGE = "normative_language"      # Contains normative markers
    STRUCTURAL_SOUNDNESS = "structural_soundness"  # Well-formed norm
    NO_DUPLICATION = "no_duplication"              # Not a duplicate
    ANCHORED = "anchored"                          # Has proper legal anchor


@dataclass
class ValidationResult:
    """Result of norm validation."""
    status: ValidationStatus
    confidence: float  # 0.0 to 1.0
    passed_rules: List[ValidationRule] = field(default_factory=list)
    failed_rules: List[ValidationRule] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class NormValidator:
    """
    Validates extracted norms for legitimacy and soundness.
    
    Responsibilities:
    1. Verify statute references exist
    2. Validate article/paragraph numbers
    3. Confirm normative language presence
    4. Detect malformed or orphan norms
    5. Assign validation status and confidence
    
    Non-Responsibilities:
    ❌ Rewrite norms
    ❌ Resolve conflicts
    ❌ Apply legal reasoning
    ❌ Decide which norm "wins"
    """
    
    def __init__(self, authority_checker=None):
        """
        Initialize validator.
        
        Args:
            authority_checker: Optional external authority validation
        """
        self.authority_checker = authority_checker
        self.known_statutes = set()
        self.seen_norms = {}  # For duplication detection
    
    def validate(
        self, 
        norm_text: str, 
        statute: str, 
        article: str,
        norm_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ValidationResult:
        """
        Validate a single norm.
        
        Args:
            norm_text: The norm text to validate
            statute: Source statute identifier
            article: Article/paragraph identifier
            norm_type: Optional norm type from classifier
            context: Optional validation context
            
        Returns:
            ValidationResult with status and details
        """
        if context is None:
            context = {}
        
        passed_rules = []
        failed_rules = []
        warnings = []
        errors = []
        
        # Apply validation rules
        rule_checks = [
            (self._check_authority_exists, [statute], ValidationRule.AUTHORITY_EXISTS),
            (self._check_article_valid, [statute, article], ValidationRule.ARTICLE_VALID),
            (self._check_normative_language, [norm_text, norm_type], ValidationRule.NORMATIVE_LANGUAGE),
            (self._check_structural_soundness, [norm_text], ValidationRule.STRUCTURAL_SOUNDNESS),
            (self._check_no_duplication, [norm_text, statute, article], ValidationRule.NO_DUPLICATION),
            (self._check_anchored, [norm_text, statute, article], ValidationRule.ANCHORED),
        ]
        
        for check_func, args, rule in rule_checks:
            try:
                is_valid, message = check_func(*args)
                if is_valid:
                    passed_rules.append(rule)
                else:
                    failed_rules.append(rule)
                    if message:
                        warnings.append(message) if rule != ValidationRule.AUTHORITY_EXISTS else errors.append(message)
            except Exception as e:
                failed_rules.append(rule)
                errors.append(f"Rule {rule.value} failed: {str(e)}")
        
        # Determine overall status
        status, confidence = self._determine_status(passed_rules, failed_rules, warnings, errors)
        
        return ValidationResult(
            status=status,
            confidence=confidence,
            passed_rules=passed_rules,
            failed_rules=failed_rules,
            warnings=warnings,
            errors=errors,
            metadata={
                "statute": statute,
                "article": article,
                "norm_type": norm_type,
                "validation_timestamp": context.get("timestamp"),
                "validator_version": "1.0"
            }
        )
    
    def _check_authority_exists(self, statute: str) -> Tuple[bool, str]:
        """Check if statute reference is valid."""
        # Use external authority checker if available
        if self.authority_checker:
            return self.authority_checker.validate_statute(statute)
        
        # Internal check: known statutes
        if statute in self.known_statutes:
            return True, ""
        
        # For now, accept common statutes
        common_statutes = {"BGB", "StGB", "GG", "ZPO", "StPO", "AO", "HGB"}
        if statute in common_statutes:
            self.known_statutes.add(statute)
            return True, ""
        
        # Check statute pattern
        if self._looks_like_statute(statute):
            self.known_statutes.add(statute)
            return True, f"Assuming statute '{statute}' exists based on naming pattern"
        
        return False, f"Unknown statute: {statute}"
    
    def _check_article_valid(self, statute: str, article: str) -> Tuple[bool, str]:
        """Check if article/paragraph reference is valid."""
        # Basic format validation
        if not article or article.strip() == "":
            return False, "Empty article reference"
        
        # Check for legal paragraph format
        if statute == "BGB" and not re.match(r'^§?\s*\d+[a-zA-Z]*$', article):
            return False, f"Invalid BGB paragraph format: {article}"
        
        # Check for article format
        if statute == "GG" and not re.match(r'^Art\.?\s*\d+[a-zA-Z]*$', article):
            return False, f"Invalid GG article format: {article}"
        
        return True, ""
    
    def _check_normative_language(self, norm_text: str, norm_type: Optional[str]) -> Tuple[bool, str]:
        """Check if text contains normative language."""
        # If norm_type is provided from classifier, trust it
        if norm_type and norm_type not in ["non_normative", "descriptive"]:
            return True, ""
        
        # Check for normative markers
        normative_markers = [
            r'shall', r'must', r'may', r'required to', r'obliged to',
            r'prohibited', r'forbidden', r'entitled to', r'right to',
            r'has the duty', r'is liable', r'may claim', r'can request'
        ]
        
        pattern = '|'.join(normative_markers)
        if re.search(pattern, norm_text, re.IGNORECASE):
            return True, ""
        
        # Check for legal imperative structures
        if re.search(r'§.*shall|Art.*shall|paragraph.*shall', norm_text, re.IGNORECASE):
            return True, ""
        
        return False, "No clear normative language detected"
    
    def _check_structural_soundness(self, norm_text: str) -> Tuple[bool, str]:
        """Check if norm is structurally sound."""
        # Minimum length
        if len(norm_text) < 15:
            return False, "Norm text too short"
        
        # Maximum length (single norm shouldn't be too long)
        if len(norm_text) > 500:
            return False, "Norm text suspiciously long"
        
        # Should be a complete thought
        if norm_text.count('.') > 3:  # Too many sentences for single norm
            return False, "Text contains too many sentences for single norm"
        
        # Check for legal reference completeness
        if '§' in norm_text and not re.search(r'§\s*\d+', norm_text):
            return False, "Incomplete paragraph reference"
        
        return True, ""
    
    def _check_no_duplication(self, norm_text: str, statute: str, article: str) -> Tuple[bool, str]:
        """Check for duplicate norms."""
        norm_hash = self._create_norm_hash(norm_text, statute, article)
        
        if norm_hash in self.seen_norms:
            duplicate_info = self.seen_norms[norm_hash]
            return False, f"Duplicate of norm at {duplicate_info}"
        
        self.seen_norms[norm_hash] = f"{statute} {article}"
        return True, ""
    
    def _check_anchored(self, norm_text: str, statute: str, article: str) -> Tuple[bool, str]:
        """Check if norm is properly anchored in legal text."""
        # Norm should reference its own statute/article
        if statute in norm_text or article in norm_text:
            return True, ""
        
        # Check for implicit anchoring
        if self._is_implicitly_anchored(norm_text, statute):
            return True, "Implicitly anchored in statute context"
        
        return False, "Norm not clearly anchored to source"
    
    def _determine_status(
        self, 
        passed_rules: List[ValidationRule], 
        failed_rules: List[ValidationRule],
        warnings: List[str],
        errors: List[str]
    ) -> Tuple[ValidationStatus, float]:
        """Determine overall validation status and confidence."""
        total_rules = len(passed_rules) + len(failed_rules)
        
        if total_rules == 0:
            return ValidationStatus.WARNING, 0.5
        
        # Calculate confidence based on passed rules
        confidence = len(passed_rules) / total_rules
        
        # Critical rules that must pass
        critical_rules = {
            ValidationRule.AUTHORITY_EXISTS,
            ValidationRule.ARTICLE_VALID,
            ValidationRule.NORMATIVE_LANGUAGE
        }
        
        failed_critical = any(rule in failed_rules for rule in critical_rules)
        
        # Determine status
        if errors and failed_critical:
            status = ValidationStatus.INVALID
            confidence *= 0.5  # Reduce confidence for invalid
        elif warnings or failed_rules:
            status = ValidationStatus.WARNING
            confidence *= 0.8  # Slightly reduce for warnings
        else:
            status = ValidationStatus.VALID
        
        return status, min(max(confidence, 0.0), 1.0)
    
    def _looks_like_statute(self, statute: str) -> bool:
        """Check if string looks like a statute identifier."""
        # Common patterns: 3-4 letters, sometimes with numbers
        if re.match(r'^[A-Z]{2,4}\d*$', statute):
            return True
        
        # With spaces: "StGB", "BGB", "GG" etc.
        if re.match(r'^[A-Z]{2,4}(\s+[A-Z]+)?$', statute):
            return True
        
        return False
    
    def _create_norm_hash(self, norm_text: str, statute: str, article: str) -> str:
        """Create a hash for duplicate detection."""
        # Normalize text for comparison
        normalized = norm_text.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Create hash
        content = f"{normalized}|{statute}|{article}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _is_implicitly_anchored(self, norm_text: str, statute: str) -> bool:
        """Check for implicit anchoring in legal context."""
        # Some norms are implicitly anchored by context
        implicit_anchors = {
            "BGB": ["civil code", "bürgerliches gesetzbuch", "contract", "obligation"],
            "StGB": ["criminal code", "strafgesetzbuch", "penalty", "punishment"],
            "GG": ["basic law", "grundgesetz", "constitutional", "right"],
        }
        
        if statute in implicit_anchors:
            anchors = implicit_anchors[statute]
            norm_lower = norm_text.lower()
            return any(anchor in norm_lower for anchor in anchors)
        
        return False
    
    def add_known_statute(self, statute: str) -> None:
        """Manually add a statute to known statutes."""
        self.known_statutes.add(statute)
    
    def get_validation_summary(self) -> Dict[str, Any]:
        """Get summary of validation results."""
        return {
            "total_norms_validated": len(self.seen_norms),
            "known_statutes": list(self.known_statutes),
            "validation_rules": [rule.value for rule in ValidationRule]
        }