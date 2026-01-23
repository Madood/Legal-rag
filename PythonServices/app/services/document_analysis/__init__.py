"""
DOCUMENT ANALYSIS LAYER
======================

Pre-legal document intelligence layer.
Determines WHAT a legal document IS, not what it MEANS.

BOUNDARIES:
- INGESTION → This layer → AUTHORITY → DOCTRINE
- NO legal interpretation
- NO authority ranking
- NO doctrine induction

RESPONSIBILITIES:
1. Detect document structure
2. Infer internal hierarchy
3. Measure normative density
4. Classify document type
5. Extract jurisdiction hints
"""

from .structure_detector import StructureDetector
from .hierarchy_detector import HierarchyDetector
from .norm_density_analyzer import NormDensityAnalyzer
from .legal_document_classifier import LegalDocumentClassifier
from .analysis_orchestrator import AnalysisOrchestrator

__all__ = [
    "StructureDetector",
    "HierarchyDetector", 
    "NormDensityAnalyzer",
    "LegalDocumentClassifier",
    "AnalysisOrchestrator"
]

__version__ = "1.0.0"