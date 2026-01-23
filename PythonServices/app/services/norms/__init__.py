"""
Norms Layer - Bridge between raw legal text and legal doctrine.

This module identifies, extracts, classifies, validates, and indexes 
normative legal statements without interpretation.

Architectural Position: Document → Norms → Doctrine → Answer
Responsibility: Answers "WHAT is a binding norm here?" not "WHAT does it mean?"
"""

__version__ = "1.0.0"
__author__ = "Legal-RAG System"
__description__ = "Norms layer for legal normative statement processing"

# Public API - Explicit exports
from .norm_classifier import (
    NormClassifier,
    NormType,
    NormStrength,
    ClassificationResult
)

from .norm_extractor import (
    NormExtractor,
    ExtractedNorm,
    ExtractionMethod
)

from .norm_index import (
    NormIndex,
    NormRecord,
    IndexField
)

from .norm_validator import (
    NormValidator,
    ValidationResult,
    ValidationStatus,
    ValidationRule
)

# Module-level documentation
__doc__ = """
Norms Layer Module

PURPOSE:
To transform raw legal text into structured, validated normative statements
that can be used by the doctrine layer for legal reasoning.

GUARANTEES:
1. Each norm is traceable to its exact legal source
2. Norm classification is based on linguistic markers, not interpretation
3. Validation ensures norms are structurally sound and properly anchored
4. Indexing enables efficient retrieval without semantic ranking

NON-RESPONSIBILITIES:
❌ Legal interpretation or doctrinal synthesis
❌ Conflict resolution between norms
❌ Authority ranking or hierarchy decisions
❌ Application to specific factual scenarios

ARCHITECTURAL FLOW:
1. norm_extractor.py: Segments legal text into atomic norms
2. norm_classifier.py: Classifies norms by type and strength
3. norm_validator.py: Validates norms against authority and structure
4. norm_index.py: Stores and retrieves validated norms

USAGE:
    from norms import NormExtractor, NormClassifier, NormValidator, NormIndex
    
    # Extract norms from legal text
    extractor = NormExtractor()
    norms = extractor.extract_from_paragraph(text, "BGB", "§ 242")
    
    # Classify each norm
    classifier = NormClassifier()
    for norm in norms:
        classification = classifier.classify(norm.text)
    
    # Validate norms
    validator = NormValidator()
    for norm in norms:
        validation = validator.validate(norm.text, norm.statute, norm.article)
    
    # Index validated norms
    index = NormIndex()
    for norm in norms:
        record = NormRecord(
            norm_id=norm.id,
            text=norm.text,
            statute=norm.statute,
            article=norm.article,
            norm_type=classification.norm_type.value
        )
        index.add_norm(record)
"""

# Clean API exports
__all__ = [
    # Core classes
    "NormClassifier",
    "NormExtractor",
    "NormIndex",
    "NormValidator",
    
    # Data structures
    "ClassificationResult",
    "ExtractedNorm",
    "NormRecord",
    "ValidationResult",
    
    # Enums
    "NormType",
    "NormStrength",
    "ExtractionMethod",
    "IndexField",
    "ValidationStatus",
    "ValidationRule",
]

# Import control - ensure clean boundaries
def _validate_imports():
    """Ensure no cross-boundary imports are attempted."""
    forbidden_imports = [
        'doctrine',
        'authority',
        'interpretation',
        'case_law',
        'ranking'
    ]
    
    import sys
    for module in sys.modules:
        for forbidden in forbidden_imports:
            if forbidden in module and 'norms' in module:
                raise ImportError(
                    f"Forbidden cross-boundary import detected: {module}. "
                    f"Norms layer must remain independent of {forbidden} layer."
                )

# Initialize module
_validate_imports()

# Version and boundary declaration
MODULE_BOUNDARIES = {
    "input": "Raw legal text from document analysis layer",
    "output": "Structured norms for doctrine layer",
    "dependencies": "None (pure text processing)",
    "upstream": "Document analysis",
    "downstream": "Doctrine induction",
    "guarantees": [
        "Traceability to legal sources",
        "Linguistic classification only",
        "No interpretation or synthesis",
        "Structural validation"
    ]
}