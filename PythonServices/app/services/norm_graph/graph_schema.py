"""
Norm Graph Schema — Node, Edge, and metadata models.

Design principles:
- Immutable node IDs (statute + paragraph, uppercase)
- All weights in [0.0, 1.0]
- EdgeType is the single source of truth for relationship vocabulary
- NormNode is the retrieval unit; NormEdge is the doctrinal unit
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional, Any


# ── Edge vocabulary ─────────────────────────────────────────────────────────

class EdgeType(str, Enum):
    CITES                = "cites"
    DOCTRINALLY_RELATED  = "doctrinally_related"
    PREREQUISITE_FOR     = "prerequisite_for"
    EXCEPTION_TO         = "exception_to"
    INTERPRETED_WITH     = "interpreted_with"
    SEMANTICALLY_ADJACENT = "semantically_adjacent"
    SAME_CLUSTER         = "same_cluster"


# Edge type metadata (directional flag, default weight)
EDGE_TYPE_META: Dict[EdgeType, Dict] = {
    EdgeType.CITES:                {"directional": True,  "base_weight": 0.85, "decay": 0.01},
    EdgeType.DOCTRINALLY_RELATED:  {"directional": False, "base_weight": 0.70, "decay": 0.005},
    EdgeType.PREREQUISITE_FOR:     {"directional": True,  "base_weight": 0.80, "decay": 0.01},
    EdgeType.EXCEPTION_TO:         {"directional": True,  "base_weight": 0.75, "decay": 0.01},
    EdgeType.INTERPRETED_WITH:     {"directional": False, "base_weight": 0.65, "decay": 0.005},
    EdgeType.SEMANTICALLY_ADJACENT:{"directional": False, "base_weight": 0.50, "decay": 0.002},
    EdgeType.SAME_CLUSTER:         {"directional": False, "base_weight": 0.60, "decay": 0.002},
}


# ── Node model ───────────────────────────────────────────────────────────────

@dataclass
class NormNode:
    node_id: str                          # "BGB_249"  — stable, immutable
    statute: str                          # "BGB"
    paragraph: str                        # "249"
    citation: str                         # "§ 249 BGB"
    title: str                            # "Art und Umfang des Schadensersatzes"
    domain: str                           # "damages"
    jurisdiction: str = "DE"

    # Centrality (precomputed, written back by CentralityEngine)
    centrality_score: float = 0.0         # Composite score
    citation_authority: float = 0.0       # PageRank
    degree_centrality: float = 0.0
    betweenness_centrality: float = 0.0
    eigenvector_centrality: float = 0.0
    cluster_id: str = ""

    # Semantic enrichment
    semantic_keywords: List[str] = field(default_factory=list)
    linked_concepts: List[str] = field(default_factory=list)
    aliases: List[str] = field(default_factory=list)

    # Provenance
    version: str = "1.0"
    text_embedding_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def make_id(statute: str, paragraph: str) -> str:
        return f"{statute.upper()}_{paragraph}"

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict) -> "NormNode":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ── Edge model ───────────────────────────────────────────────────────────────

@dataclass
class NormEdge:
    source: str                           # node_id
    target: str                           # node_id
    edge_type: EdgeType
    weight: float                         # [0, 1]
    directional: bool = True
    frequency: int = 1                    # co-occurrence / citation count
    source_type: str = "seed"             # seed | statute_text | judgment | embedding | log
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["edge_type"] = self.edge_type.value
        return d

    @classmethod
    def from_dict(cls, d: Dict) -> "NormEdge":
        d = dict(d)
        d["edge_type"] = EdgeType(d["edge_type"])
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ── Graph metadata ───────────────────────────────────────────────────────────

@dataclass
class GraphMetadata:
    version: str = "1.0"
    node_count: int = 0
    edge_count: int = 0
    statutes: List[str] = field(default_factory=list)
    domains: List[str] = field(default_factory=list)
    last_built: str = ""
    centrality_computed: bool = False
    schema_version: str = "2025.1"

    def to_dict(self) -> Dict:
        return asdict(self)


# ── Retrieval explainability ─────────────────────────────────────────────────

@dataclass
class GraphRetrievalExplanation:
    norm: str
    semantic_score: float = 0.0
    graph_score: float = 0.0
    centrality: float = 0.0
    citation_authority: float = 0.0
    anchor_boost: float = 0.0
    final_score: float = 0.0
    expansion_source: str = ""           # "anchor_neighbor" | "cluster" | "prerequisite" | "direct"
    retrieval_reason: List[str] = field(default_factory=list)
    edge_path: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)
