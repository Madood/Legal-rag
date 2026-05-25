"""
norm_graph package — Legal Norm Graph for doctrinal retrieval augmentation.

Public surface:
  GraphService.get_instance()  — singleton entry point
  GraphReranker                — post-FAISS hybrid reranking
  QueryExpander                — doctrinal query expansion
  RetrievalLogger              — co-occurrence event sink
  GraphLearner                 — incremental edge weight updates
"""

from .graph_schema import (
    NormNode, NormEdge, EdgeType, EDGE_TYPE_META,
    GraphMetadata, GraphRetrievalExplanation,
)
from .graph_store      import GraphStore
from .graph_builder    import GraphBuilder
from .centrality_engine import CentralityEngine
from .graph_service    import GraphService
from .query_expander   import QueryExpander
from .graph_reranker   import GraphReranker
from .retrieval_logger import RetrievalLogger
from .graph_learner    import GraphLearner

__all__ = [
    "NormNode", "NormEdge", "EdgeType", "EDGE_TYPE_META",
    "GraphMetadata", "GraphRetrievalExplanation",
    "GraphStore", "GraphBuilder", "CentralityEngine",
    "GraphService", "QueryExpander", "GraphReranker",
    "RetrievalLogger", "GraphLearner",
]
