"""
GraphService — singleton API over the norm graph.

Public API (8 methods):
  1. get_node(node_id)
  2. get_neighbors(node_id, edge_types, min_weight, depth)
  3. expand_query_nodes(statute, paragraph_refs)
  4. get_domain_anchors(domain)
  5. score_node(node_id)                 → composite centrality float
  6. get_cluster_members(cluster_id)
  7. get_explanation(node_id, anchor_ids)
  8. is_ready()
"""

from __future__ import annotations
import os
import threading
from functools import lru_cache
from typing import Dict, List, Optional, TYPE_CHECKING

from .graph_schema import NormNode, EdgeType, GraphRetrievalExplanation
from .graph_store import GraphStore
from .graph_builder import GraphBuilder
from .centrality_engine import CentralityEngine

if TYPE_CHECKING:
    from ..embeddings.embedding_service import EmbeddingService

_SINGLETON: Optional["GraphService"] = None
_SINGLETON_LOCK = threading.Lock()


class GraphService:
    """Singleton; use GraphService.get_instance()."""

    def __init__(self, store: GraphStore, builder: GraphBuilder, centrality: CentralityEngine):
        self._store     = store
        self._builder   = builder
        self._centrality= centrality
        self._ready     = False

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    def get_instance(cls, embedding_service: Optional["EmbeddingService"] = None) -> "GraphService":
        global _SINGLETON
        if _SINGLETON is not None:
            return _SINGLETON
        with _SINGLETON_LOCK:
            if _SINGLETON is not None:
                return _SINGLETON
            store    = GraphStore()
            builder  = GraphBuilder(store, embedding_service)
            engine   = CentralityEngine(store)
            instance = cls(store, builder, engine)
            _SINGLETON = instance
        return _SINGLETON

    def initialize(self, force_rebuild: bool = False) -> bool:
        """
        Load graph from disk (or build from seed if missing).
        Computes centrality if not already done.
        """
        loaded = self._store.load()
        if not loaded or force_rebuild:
            self._builder.build(force_rebuild=True)
        if not self._store.metadata.centrality_computed:
            self._centrality.compute_all()
        self._ready = True
        print(f"[GraphService] Ready — {self._store.node_count()} nodes, "
              f"{self._store.edge_count()} edges.")
        return True

    # ── 8 Public methods ──────────────────────────────────────────────────────

    def is_ready(self) -> bool:
        return self._ready

    def get_node(self, node_id: str) -> Optional[NormNode]:
        return self._store.get_node(node_id)

    def get_neighbors(
        self,
        node_id: str,
        edge_types: Optional[List[EdgeType]] = None,
        min_weight: float = 0.25,
        depth: int = 1,
    ) -> List[NormNode]:
        """BFS to `depth` hops; returns unique NormNode list sorted by centrality."""
        if not self._ready:
            return []
        visited: set = set()
        frontier = [node_id]
        for _ in range(depth):
            next_frontier = []
            for nid in frontier:
                for nbr_id, _ in self._store.get_edges(nid, edge_types, min_weight):
                    if nbr_id not in visited and nbr_id != node_id:
                        visited.add(nbr_id)
                        next_frontier.append(nbr_id)
            frontier = next_frontier
        nodes = [self._store.get_node(n) for n in visited if self._store.get_node(n)]
        return sorted(nodes, key=lambda n: n.centrality_score, reverse=True)

    def expand_query_nodes(self, statute: str, paragraph_refs: List[str]) -> List[NormNode]:
        """
        Given a statute and list of paragraph strings, return those nodes plus
        their 1-hop doctrinal neighbors.
        """
        if not self._ready:
            return []
        stat = statute.upper()
        result: List[NormNode] = []
        seen: set = set()
        for para in paragraph_refs:
            nid = f"{stat}_{para}"
            node = self._store.get_node(nid)
            if node and nid not in seen:
                result.append(node)
                seen.add(nid)
                for nbr in self.get_neighbors(
                    nid,
                    edge_types=[EdgeType.CITES, EdgeType.DOCTRINALLY_RELATED,
                                 EdgeType.PREREQUISITE_FOR, EdgeType.EXCEPTION_TO,
                                 EdgeType.INTERPRETED_WITH],
                    min_weight=0.40,
                    depth=1,
                ):
                    if nbr.node_id not in seen:
                        result.append(nbr)
                        seen.add(nbr.node_id)
        return sorted(result, key=lambda n: n.centrality_score, reverse=True)

    def get_domain_anchors(self, domain: str) -> List[NormNode]:
        """Return nodes for a domain, sorted by centrality."""
        nodes = self._store.get_nodes_by_domain(domain)
        return sorted(nodes, key=lambda n: n.centrality_score, reverse=True)

    def score_node(self, node_id: str) -> float:
        node = self._store.get_node(node_id)
        return node.centrality_score if node else 0.0

    def get_cluster_members(self, cluster_id: str) -> List[NormNode]:
        members = [n for n in self._store.get_all_nodes()
                   if self._store.get_cluster_id(n.node_id) == cluster_id]
        return sorted(members, key=lambda n: n.centrality_score, reverse=True)

    def get_explanation(
        self,
        node_id: str,
        anchor_ids: Optional[List[str]] = None,
    ) -> GraphRetrievalExplanation:
        node = self._store.get_node(node_id)
        if not node:
            return GraphRetrievalExplanation(norm=node_id)

        anchor_boost = 0.0
        expansion_source = "direct"
        edge_path: List[str] = []

        if anchor_ids:
            for aid in anchor_ids:
                path = self._store.shortest_path(aid, node_id)
                if path and 1 < len(path) <= 3:
                    anchor_boost = 0.35 / len(path)
                    expansion_source = "anchor_neighbor"
                    edge_path = path
                    break
                if path and len(path) == 1:
                    expansion_source = "anchor_neighbor"
                    anchor_boost = 0.35
                    edge_path = path

        cluster_members = self.get_cluster_members(node.cluster_id) if node.cluster_id else []
        if expansion_source == "direct" and len(cluster_members) > 1:
            expansion_source = "cluster"

        reasons: List[str] = []
        if node.centrality_score > 0.5:
            reasons.append(f"high centrality ({node.centrality_score:.2f})")
        if node.citation_authority > 0.5:
            reasons.append(f"high citation authority ({node.citation_authority:.2f})")
        if anchor_boost > 0:
            reasons.append(f"anchor proximity boost ({anchor_boost:.2f})")
        if expansion_source == "cluster":
            reasons.append(f"same doctrinal cluster ({node.cluster_id})")

        return GraphRetrievalExplanation(
            norm                = node.citation,
            centrality          = node.centrality_score,
            citation_authority  = node.citation_authority,
            anchor_boost        = anchor_boost,
            expansion_source    = expansion_source,
            retrieval_reason    = reasons,
            edge_path           = edge_path,
        )
