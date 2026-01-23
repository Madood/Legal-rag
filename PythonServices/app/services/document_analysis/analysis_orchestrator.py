"""
ANALYSIS ORCHESTRATOR
====================

Orchestrates the complete document analysis pipeline.
Coordinates all analysis components.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
import logging
import time
from datetime import datetime

from .structure_detector import StructureDetector
from .hierarchy_detector import HierarchyDetector
from .norm_density_analyzer import NormDensityAnalyzer
from .legal_document_classifier import LegalDocumentClassifier

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Complete analysis result."""
    document_id: str
    timestamp: str
    processing_time_ms: int
    
    # Component results
    structure_analysis: Dict[str, Any] = field(default_factory=dict)
    hierarchy_analysis: Dict[str, Any] = field(default_factory=dict)
    norm_analysis: Dict[str, Any] = field(default_factory=dict)
    classification: Dict[str, Any] = field(default_factory=dict)
    
    # Consolidated insights
    insights: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "document_id": self.document_id,
            "timestamp": self.timestamp,
            "processing_time_ms": self.processing_time_ms,
            "structure_analysis": self.structure_analysis,
            "hierarchy_analysis": self.hierarchy_analysis,
            "norm_analysis": self.norm_analysis,
            "classification": self.classification,
            "insights": self.insights,
            "warnings": self.warnings,
            "errors": self.errors,
            "metadata": self.metadata,
        }
    
    def is_valid(self) -> bool:
        """Check if analysis is valid."""
        return (
            self.structure_analysis is not None
            and self.hierarchy_analysis is not None
            and self.norm_analysis is not None
            and self.classification is not None
            and len(self.errors) == 0
        )


class AnalysisOrchestrator:
    """
    Orchestrates the complete document analysis pipeline.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize orchestrator.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config or {}
        
        # Initialize components
        self.structure_detector = StructureDetector(
            config.get("structure_detector", {})
        )
        self.hierarchy_detector = HierarchyDetector(
            use_existing_hierarchy=config.get("use_existing_hierarchy", True)
        )
        self.norm_analyzer = NormDensityAnalyzer(
            languages=config.get("languages", ["en", "de", "fr", "es"])
        )
        self.classifier = LegalDocumentClassifier(
            config.get("classifier", {})
        )
        
        # Performance tracking
        self.performance_stats = {
            "total_documents": 0,
            "successful_analyses": 0,
            "failed_analyses": 0,
            "avg_processing_time_ms": 0,
        }
        
        logger.info("AnalysisOrchestrator initialized")
    
    def analyze(self, document_id: str, text: str, 
                detailed: bool = True) -> AnalysisResult:
        """
        Perform complete document analysis.
        
        Args:
            document_id: Unique document identifier
            text: Document text
            detailed: Whether to include detailed analysis
            
        Returns:
            Complete analysis result
        """
        start_time = time.time()
        result = AnalysisResult(
            document_id=document_id,
            timestamp=datetime.now().isoformat(),
            processing_time_ms=0,
        )
        
        try:
            # Validate input
            if not text or len(text.strip()) < 100:
                result.errors.append("Text too short for analysis")
                return self._finalize_result(result, start_time)
            
            # 1. Structure Analysis
            logger.debug(f"Starting structure analysis for {document_id}")
            structure_result = self.structure_detector.detect(text, include_raw=detailed)
            result.structure_analysis = structure_result
            
            # 2. Hierarchy Analysis (requires structure analysis)
            logger.debug(f"Starting hierarchy analysis for {document_id}")
            hierarchy_result = self.hierarchy_detector.detect(structure_result, text)
            result.hierarchy_analysis = hierarchy_result
            
            # 3. Normative Density Analysis
            logger.debug(f"Starting normative analysis for {document_id}")
            norm_result = self.norm_analyzer.analyze(text, detailed=detailed)
            result.norm_analysis = norm_result
            
            # 4. Document Classification
            logger.debug(f"Starting classification for {document_id}")
            classification_result = self.classifier.classify(text, include_features=detailed)
            result.classification = classification_result.to_dict()
            
            # 5. Generate consolidated insights
            result.insights = self._generate_insights(
                structure_result,
                hierarchy_result,
                norm_result,
                classification_result,
                text
            )
            
            # 6. Generate warnings
            result.warnings = self._generate_warnings(
                structure_result,
                hierarchy_result,
                norm_result,
                classification_result
            )
            
            # 7. Update metadata
            result.metadata = {
                "analysis_version": "1.0.0",
                "components_used": [
                    "structure_detector",
                    "hierarchy_detector",
                    "norm_density_analyzer",
                    "legal_document_classifier"
                ],
                "detailed_analysis": detailed,
                "text_preview": text[:500] + "..." if len(text) > 500 else text,
            }
            
            # Update performance stats
            self.performance_stats["total_documents"] += 1
            self.performance_stats["successful_analyses"] += 1
            
        except Exception as e:
            logger.error(f"Analysis failed for {document_id}: {e}", exc_info=True)
            result.errors.append(f"Analysis failed: {str(e)}")
            self.performance_stats["failed_analyses"] += 1
        
        return self._finalize_result(result, start_time)
    
    def _generate_insights(self, structure: Dict, hierarchy: Dict, 
                          norm: Dict, classification: Dict, 
                          text: str) -> Dict[str, Any]:
        """Generate consolidated insights from all analyses."""
        insights = {}
        
        # Structural insights
        if structure and "summary" in structure:
            struct_summary = structure["summary"]
            insights["structure"] = {
                "element_count": struct_summary.get("total_elements", 0),
                "hierarchy_depth": struct_summary.get("hierarchy_depth", 0),
                "coverage": struct_summary.get("line_coverage", 0.0),
                "type": structure.get("classification", {}).get("structure_type", "unknown"),
            }
        
        # Hierarchy insights
        if hierarchy and "summary" in hierarchy:
            hierarchy_summary = hierarchy["summary"]
            insights["hierarchy"] = {
                "has_clear_hierarchy": hierarchy_summary.get("has_clear_hierarchy", False),
                "hierarchy_depth": hierarchy_summary.get("hierarchy_depth", 0),
                "authority_range": hierarchy_summary.get("authority_range", {}),
                "conflict_count": hierarchy_summary.get("conflict_count", 0),
            }
        
        # Normative insights
        if norm and "classification" in norm:
            norm_class = norm["classification"]
            insights["normative"] = {
                "category": norm_class.get("category", "unknown"),
                "density_class": norm_class.get("density_class", "unknown"),
                "score": norm.get("metrics", {}).get("overall_normative_score", 0),
                "has_penalty_clauses": norm.get("has_penalty_clauses", False),
            }
        
        # Classification insights
        if classification:
            insights["classification"] = {
                "primary_category": classification.get("primary_category", "unknown"),
                "legal_system": classification.get("legal_system", "unknown"),
                "confidence": classification.get("confidence", 0.0),
                "jurisdiction_count": len(classification.get("jurisdiction_hints", [])),
            }
        
        # Combined insights
        insights["combined"] = {
            "is_structured": insights.get("structure", {}).get("element_count", 0) > 5,
            "is_normative": insights.get("normative", {}).get("score", 0) > 30,
            "has_legal_value": insights.get("normative", {}).get("score", 0) > 20,
            "is_binding_document": (
                insights.get("normative", {}).get("category") in ["highly_normative", "moderately_normative"]
                and insights.get("classification", {}).get("primary_category") not in ["article", "commentary"]
            ),
            "requires_authority_analysis": (
                insights.get("normative", {}).get("score", 0) > 40
                and insights.get("structure", {}).get("element_count", 0) > 3
            ),
        }
        
        # Quality assessment
        insights["quality"] = {
            "structure_confidence": structure.get("classification", {}).get("confidence", 0.0),
            "classification_confidence": classification.get("confidence", 0.0),
            "normative_confidence": norm.get("metrics", {}).get("average_confidence", 0.0),
            "overall_confidence": self._calculate_overall_confidence(
                structure, hierarchy, norm, classification
            ),
        }
        
        return insights
    
    def _calculate_overall_confidence(self, structure: Dict, hierarchy: Dict,
                                    norm: Dict, classification: Dict) -> float:
        """Calculate overall confidence score."""
        scores = []
        
        # Structure confidence
        if "classification" in structure:
            scores.append(structure["classification"].get("confidence", 0.0))
        
        # Classification confidence
        if classification:
            scores.append(classification.get("confidence", 0.0))
        
        # Normative confidence
        if "metrics" in norm:
            scores.append(norm["metrics"].get("average_confidence", 0.0))
        
        if not scores:
            return 0.0
        
        # Weighted average (classification is most important)
        weights = [0.2, 0.5, 0.3]  # Structure, Classification, Normative
        weighted_sum = sum(s * w for s, w in zip(scores[:3], weights[:len(scores)]))
        return round(weighted_sum * 100, 1)  # Convert to 0-100 scale
    
    def _generate_warnings(self, structure: Dict, hierarchy: Dict,
                          norm: Dict, classification: Dict) -> List[str]:
        """Generate warnings based on analysis results."""
        warnings = []
        
        # Structure warnings
        if structure and "summary" in structure:
            struct_summary = structure["summary"]
            if struct_summary.get("total_elements", 0) < 3:
                warnings.append("Document has minimal structural elements")
            
            if struct_summary.get("line_coverage", 0.0) < 0.1:
                warnings.append("Low structural coverage - document may be unstructured")
        
        # Hierarchy warnings
        if hierarchy:
            if hierarchy.get("method") == "fallback_detection":
                warnings.append("Used fallback hierarchy detection (existing resolver not available)")
            
            if not hierarchy.get("summary", {}).get("has_clear_hierarchy", False):
                warnings.append("No clear hierarchy detected - authority analysis may be limited")
            
            if hierarchy.get("summary", {}).get("conflict_count", 0) > 0:
                warnings.append(f"Detected {hierarchy['summary']['conflict_count']} hierarchy conflicts")
        
        # Normative warnings
        if norm and "metrics" in norm:
            metrics = norm["metrics"]
            if metrics.get("overall_normative_score", 0) < 10:
                warnings.append("Very low normative score - document may not be legally binding")
            
            if metrics.get("strong_norm_ratio", 0) < 0.3:
                warnings.append("Low ratio of strong normative language")
        
        # Classification warnings
        if classification:
            if classification.get("confidence", 0) < 50:
                warnings.append(f"Low classification confidence: {classification.get('confidence', 0)}%")
            
            if classification.get("primary_category") == "unknown":
                warnings.append("Could not determine document category")
        
        return warnings
    
    def _finalize_result(self, result: AnalysisResult, start_time: float) -> AnalysisResult:
        """Finalize result with processing time and stats."""
        processing_time_ms = int((time.time() - start_time) * 1000)
        result.processing_time_ms = processing_time_ms
        
        # Update average processing time
        total_docs = self.performance_stats["total_documents"]
        current_avg = self.performance_stats["avg_processing_time_ms"]
        
        if total_docs > 0:
            new_avg = ((current_avg * (total_docs - 1)) + processing_time_ms) / total_docs
            self.performance_stats["avg_processing_time_ms"] = int(new_avg)
        
        return result
    
    def analyze_batch(self, documents: List[Dict[str, str]], 
                     detailed: bool = True) -> List[AnalysisResult]:
        """
        Analyze multiple documents.
        
        Args:
            documents: List of dictionaries with 'id' and 'text' keys
            detailed: Whether to include detailed analysis
            
        Returns:
            List of analysis results
        """
        results = []
        
        for doc in documents:
            doc_id = doc.get("id", f"doc_{len(results)}")
            text = doc.get("text", "")
            
            result = self.analyze(doc_id, text, detailed)
            results.append(result)
        
        return results
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        return {
            **self.performance_stats,
            "success_rate": (
                self.performance_stats["successful_analyses"] / 
                max(self.performance_stats["total_documents"], 1)
            ) * 100,
            "components": {
                "structure_detector": "active",
                "hierarchy_detector": "active",
                "norm_density_analyzer": "active",
                "legal_document_classifier": "active",
            }
        }
    
    def get_analysis_summary(self, result: AnalysisResult) -> Dict[str, Any]:
        """Get a summary of the analysis result."""
        if not result.is_valid():
            return {"error": "Invalid analysis result"}
        
        insights = result.insights.get("combined", {})
        
        summary = {
            "document_id": result.document_id,
            "processing_time_ms": result.processing_time_ms,
            "document_type": result.classification.get("primary_category", "unknown"),
            "legal_system": result.classification.get("legal_system", "unknown"),
            "normative_score": result.norm_analysis.get("metrics", {}).get("overall_normative_score", 0),
            "structure_elements": result.structure_analysis.get("summary", {}).get("total_elements", 0),
            "hierarchy_depth": result.hierarchy_analysis.get("summary", {}).get("hierarchy_depth", 0),
            "jurisdiction_hints": result.classification.get("jurisdiction_hints", []),
            "confidence": result.insights.get("quality", {}).get("overall_confidence", 0),
            "warnings_count": len(result.warnings),
            "key_insights": {
                "is_binding_document": insights.get("is_binding_document", False),
                "has_legal_value": insights.get("has_legal_value", False),
                "requires_authority_analysis": insights.get("requires_authority_analysis", False),
            }
        }
        
        return summary
    
    def export_analysis(self, result: AnalysisResult, format: str = "json") -> Dict[str, Any]:
        """
        Export analysis in specified format.
        
        Args:
            result: Analysis result
            format: Export format ('json', 'minimal', 'detailed')
        
        Returns:
            Exported analysis
        """
        if format == "minimal":
            return self.get_analysis_summary(result)
        
        elif format == "detailed":
            return {
                "summary": self.get_analysis_summary(result),
                "full_analysis": result.to_dict(),
                "performance": self.get_performance_stats(),
            }
        
        else:  # json (default)
            return result.to_dict()