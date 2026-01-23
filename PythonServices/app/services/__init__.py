"""
Core service layer for the Legal Intelligence System.

This package exposes high-level service domains only.
Internal module structure is intentionally hidden to
preserve architectural boundaries.
"""

# =========================
# NORMS LAYER - NEW INTEGRATION
# =========================

from .norms.norm_classifier import (
    NormClassifier,
    NormType,
    NormStrength,
    ClassificationResult
)

from .norms.norm_extractor import (
    NormExtractor,
    ExtractedNorm,
    ExtractionMethod
)

from .norms.norm_index import (
    NormIndex,
    NormRecord,
    IndexField
)

from .norms.norm_validator import (
    NormValidator,
    ValidationResult,
    ValidationStatus,
    ValidationRule
)

# =========================
# NORMS SERVICE FUNCTIONS
# =========================

def extract_norms_from_text(text: str, statute: str, article: str) -> list:
    """Extract norms from legal text."""
    try:
        extractor = NormExtractor()
        return extractor.extract_from_paragraph(text, statute, article)
    except Exception as e:
        # Fallback extraction
        return [ExtractedNorm(
            id=f"{statute}_{article}_fallback",
            text=text[:200] + "..." if len(text) > 200 else text,
            statute=statute,
            article=article,
            position=0,
            context={"fallback": True},
            metadata={"error": str(e)}
        )]

def classify_norm(norm_text: str) -> ClassificationResult:
    """Classify a norm text."""
    try:
        classifier = NormClassifier()
        return classifier.classify(norm_text)
    except Exception as e:
        # Fallback classification
        return ClassificationResult(
            norm_type=NormType.NON_NORMATIVE,
            strength=NormStrength.DESCRIPTIVE,
            confidence=0.5,
            markers=["fallback"],
            text_segment=norm_text
        )

def validate_norm(norm_text: str, statute: str, article: str) -> ValidationResult:
    """Validate a norm against authority and structure."""
    try:
        validator = NormValidator()
        return validator.validate(norm_text, statute, article)
    except Exception as e:
        # Fallback validation
        return ValidationResult(
            status=ValidationStatus.WARNING,
            confidence=0.5,
            passed_rules=[],
            failed_rules=[ValidationRule.AUTHORITY_EXISTS],
            warnings=[f"Validation failed: {str(e)}"],
            errors=[],
            metadata={"fallback": True}
        )

def create_norm_index() -> NormIndex:
    """Create a new norm index."""
    return NormIndex()

# =========================
# LEGAL AUTHORITY
# =========================

from .authority.registry import (
    resolve_authority,
    get_metrics,
    classify_question_type,
    assess_complexity,
    detect_language,
    validate_statute_consistency,
    score_question_domain,
    compare_hierarchy,
    get_authority_state,
)

# Import source_authority_resolver from its actual location
try:
    from .authority.registry.authority_resolver import source_authority_resolver
except ImportError:
    # Define a fallback if the module doesn't exist
    def source_authority_resolver(*args, **kwargs):
        """Fallback source authority resolver."""
        raise ImportError("source_authority_resolver not found. Check authority.registry.authority_resolver module.")

from .authority.statute import (
    get_available_statutes,
    validate_answer,
    LEGAL_HIERARCHY,
    DOMAIN_ISOLATION,
)

# =========================
# DOCTRINE FUNCTION
# =========================

def get_doctrine_explanation(doctrine_name: str, language: str = 'german'):
    """Get doctrine/principle explanation."""
    try:
        from .doctrine_induction import get_doctrine_explanation as get_doctrine
        return get_doctrine(doctrine_name, language)
    except (ImportError, AttributeError):
        # Fallback doctrine data
        DOCTRINES = {
            'schuldprinzip': {
                'type': 'PRINCIPLE',
                'domain': 'criminal',
                'explanation': {
                    'german': """**Das Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Rechtsnatur:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB).""",
                    'english': """**The Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Legal Nature:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB)."""
                },
                'sources': ['GG Art. 1', 'GG Art. 20', 'StGB implied']
            }
        }
        
        doctrine = DOCTRINES.get(doctrine_name.lower())
        if not doctrine:
            return None
        
        return {
            'type': doctrine['type'],
            'domain': doctrine['domain'],
            'explanation': doctrine['explanation'].get(language, doctrine['explanation']['german']),
            'sources': doctrine['sources']
        }

# =========================
# SERVICE FLAGS - UPDATED
# =========================

AUTHORITY_AVAILABLE = True
NORMS_AVAILABLE = True
DOCTRINE_AVAILABLE = True
NORMS_LOCATION = "norms.norm_classifier + norms.norm_extractor + norms.norm_index + norms.norm_validator"

# =========================
# SERVICE MODULE IMPORTS
# =========================

# Import remaining service modules
try:
    from . import ingestion
    INGESTION_AVAILABLE = True
except ImportError:
    INGESTION_AVAILABLE = False

try:
    from . import document_analysis
    DOCUMENT_ANALYSIS_AVAILABLE = True
except ImportError:
    DOCUMENT_ANALYSIS_AVAILABLE = False

try:
    from . import norms
    NORMS_AVAILABLE = True
except ImportError:
    NORMS_AVAILABLE = False

try:
    from . import domain_induction
    DOMAIN_INDUCTION_AVAILABLE = True
except ImportError:
    DOMAIN_INDUCTION_AVAILABLE = False

try:
    from . import doctrine_induction
    DOCTRINE_INDUCTION_AVAILABLE = True
except ImportError:
    DOCTRINE_INDUCTION_AVAILABLE = False

try:
    from . import question_understanding
    QUESTION_UNDERSTANDING_AVAILABLE = True
except ImportError:
    QUESTION_UNDERSTANDING_AVAILABLE = False

try:
    from . import retrieval
    RETRIEVAL_AVAILABLE = True
except ImportError:
    RETRIEVAL_AVAILABLE = False

try:
    from . import embeddings
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False

try:
    from . import clarification
    CLARIFICATION_AVAILABLE = True
except ImportError:
    CLARIFICATION_AVAILABLE = False

# =========================
# UTILITY FUNCTIONS
# =========================

def get_safety():
    """Lazy access to safety module to avoid circular imports."""
    try:
        from . import safety
        return safety
    except ImportError:
        return None

def get_utils():
    """Lazy access to utils module to avoid circular imports."""
    try:
        from . import utils
        return utils
    except ImportError:
        return None

# =========================
# NORMS PROCESSING PIPELINE
# =========================

def process_legal_text_to_norms(text: str, statute: str, article: str) -> dict:
    """
    Full pipeline: Extract → Classify → Validate → Index norms.
    
    Args:
        text: Raw legal text
        statute: Source statute identifier
        article: Article/paragraph identifier
        
    Returns:
        Dict with processed norms and metadata
    """
    try:
        # Extract norms
        extractor = NormExtractor()
        extracted_norms = extractor.extract_from_paragraph(text, statute, article)
        
        # Classify each norm
        classifier = NormClassifier()
        classified_norms = []
        
        # Validate each norm
        validator = NormValidator()
        validated_norms = []
        
        # Index norms
        index = NormIndex()
        
        for norm in extracted_norms:
            # Classify
            classification = classifier.classify(norm.text)
            
            # Validate
            validation = validator.validate(
                norm.text, 
                norm.statute, 
                norm.article,
                norm_type=classification.norm_type.value
            )
            
            # Create norm record
            record = NormRecord(
                norm_id=norm.id,
                text=norm.text,
                statute=norm.statute,
                article=norm.article,
                norm_type=classification.norm_type.value,
                metadata=norm.metadata,
                classification={
                    'type': classification.norm_type.value,
                    'strength': classification.strength.value,
                    'confidence': classification.confidence,
                    'markers': classification.markers
                },
                validation={
                    'status': validation.status.value,
                    'confidence': validation.confidence,
                    'passed_rules': [rule.value for rule in validation.passed_rules],
                    'failed_rules': [rule.value for rule in validation.failed_rules],
                    'warnings': validation.warnings,
                    'errors': validation.errors
                }
            )
            
            # Add to index
            index.add_norm(record)
            
            classified_norms.append({
                'norm': norm,
                'classification': classification,
                'validation': validation,
                'record': record
            })
            validated_norms.append(record)
        
        return {
            'success': True,
            'extracted_count': len(extracted_norms),
            'validated_count': len(validated_norms),
            'norms': classified_norms,
            'index': index,
            'statistics': {
                'obligations': sum(1 for n in classified_norms 
                                 if n['classification'].norm_type == NormType.OBLIGATION),
                'prohibitions': sum(1 for n in classified_norms 
                                  if n['classification'].norm_type == NormType.PROHIBITION),
                'permissions': sum(1 for n in classified_norms 
                                 if n['classification'].norm_type == NormType.PERMISSION),
                'valid_norms': sum(1 for n in classified_norms 
                                 if n['validation'].status == ValidationStatus.VALID),
                'invalid_norms': sum(1 for n in classified_norms 
                                   if n['validation'].status == ValidationStatus.INVALID)
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'extracted_count': 0,
            'validated_count': 0,
            'norms': [],
            'statistics': {},
            'fallback': True
        }

# =========================
# SERVICE HEALTH CHECK - UPDATED
# =========================

def get_service_health():
    """Report on availability of all service modules."""
    return {
        'authority': AUTHORITY_AVAILABLE,
        'norms': NORMS_AVAILABLE,
        'doctrine': DOCTRINE_AVAILABLE,
        'ingestion': INGESTION_AVAILABLE,
        'document_analysis': DOCUMENT_ANALYSIS_AVAILABLE,
        'domain_induction': DOMAIN_INDUCTION_AVAILABLE,
        'doctrine_induction': DOCTRINE_INDUCTION_AVAILABLE,
        'question_understanding': QUESTION_UNDERSTANDING_AVAILABLE,
        'retrieval': RETRIEVAL_AVAILABLE,
        'embeddings': EMBEDDINGS_AVAILABLE,
        'clarification': CLARIFICATION_AVAILABLE,
        'norms_location': NORMS_LOCATION,
    }

# =========================
# SAFE EXPORTS - UPDATED
# =========================

__all__ = [
    # Norms layer
    "NormClassifier",
    "NormExtractor",
    "NormIndex",
    "NormValidator",
    
    # Norms data structures
    "NormType",
    "NormStrength",
    "ExtractedNorm",
    "ExtractionMethod",
    "NormRecord",
    "IndexField",
    "ValidationResult",
    "ValidationStatus",
    "ValidationRule",
    "ClassificationResult",
    
    # Norms service functions
    "extract_norms_from_text",
    "classify_norm",
    "validate_norm",
    "create_norm_index",
    "process_legal_text_to_norms",
    
    # Authority resolution
    "resolve_authority",
    "get_metrics",
    "compare_hierarchy",
    "get_authority_state",
    "source_authority_resolver",  # ADDED: The missing export
    
    # Classification
    "classify_question_type",
    "assess_complexity",
    "detect_language",
    "validate_statute_consistency",
    "score_question_domain",
    
    # Statute controls
    "get_available_statutes",
    "validate_answer",
    "LEGAL_HIERARCHY",
    "DOMAIN_ISOLATION",
    
    # Doctrine function
    "get_doctrine_explanation",
    
    # Service health
    "get_service_health",
    
    # Flags
    "AUTHORITY_AVAILABLE",
    "NORMS_AVAILABLE",
    "DOCTRINE_AVAILABLE",
    "NORMS_LOCATION",
    
    # Lazy loaders
    "get_safety",
    "get_utils",
]