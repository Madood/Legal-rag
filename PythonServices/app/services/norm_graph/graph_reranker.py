"""
GraphReranker — hybrid scoring + explainability for post-FAISS reranking.

Hybrid score formula:
  semantic * 0.45 + graph * 0.20 + centrality * 0.15 + citation_auth * 0.10 + anchor_boost * 0.10

Inputs:
  - FAISS retrieval results (list of dicts with 'score' and metadata)
  - graph_node_ids from QueryExpander
  - anchor_node_ids (original resolved anchor nodes)
  - GraphService instance
"""

from __future__ import annotations
from typing import Dict, List, Optional

from .graph_schema import GraphRetrievalExplanation
from .graph_service import GraphService

# Hybrid weight constants
_W_SEMANTIC  = 0.45
_W_GRAPH     = 0.20
_W_CENTRALITY= 0.15
_W_CITATION  = 0.10
_W_ANCHOR    = 0.10


class GraphReranker:

    def __init__(self, graph_service: Optional[GraphService] = None):
        self._gs = graph_service or GraphService.get_instance()

    def rerank(
        self,
        results: List[Dict],
        statute: str,
        graph_node_ids: List[str],
        anchor_node_ids: List[str],
        question_type: str = "GENERAL",
    ) -> List[Dict]:
        """
        Accepts and returns the same list structure as FAISS results.
        Each result dict must have at minimum:
          - 'score': float (semantic similarity)
          - 'metadata': dict with at least 'paragraph' key

        Adds fields to each result:
          - 'hybrid_score': final reranked float
          - 'graph_explanation': GraphRetrievalExplanation.to_dict()
        """
        if not self._gs.is_ready() or not results:
            return results

        stat = statute.upper()
        graph_set = set(graph_node_ids)
        anchor_set = set(anchor_node_ids)

        scored = []
        for item in results:
            paragraph = str(item.get("metadata", {}).get("paragraph", ""))
            node_id   = f"{stat}_{paragraph}"
            node      = self._gs.get_node(node_id)

            semantic   = float(item.get("score", 0.0))
            graph_sc   = 1.0 if node_id in graph_set else 0.0
            centrality = node.centrality_score     if node else 0.0
            citation   = node.citation_authority   if node else 0.0
            anchor_b   = self._compute_anchor_boost(node_id, anchor_set)

            hybrid = (
                _W_SEMANTIC   * semantic   +
                _W_GRAPH      * graph_sc   +
                _W_CENTRALITY * centrality +
                _W_CITATION   * citation   +
                _W_ANCHOR     * anchor_b
            )

            explanation = self._gs.get_explanation(node_id, list(anchor_set))
            explanation.semantic_score = round(semantic, 4)
            explanation.graph_score    = round(graph_sc, 4)
            explanation.centrality     = round(centrality, 4)
            explanation.citation_authority = round(citation, 4)
            explanation.anchor_boost   = round(anchor_b, 4)
            explanation.final_score    = round(hybrid, 4)

            enriched = dict(item)
            enriched["hybrid_score"]      = round(hybrid, 4)
            enriched["graph_explanation"] = explanation.to_dict()
            scored.append(enriched)

        scored.sort(key=lambda x: x["hybrid_score"], reverse=True)
        return scored

    def _compute_anchor_boost(self, node_id: str, anchor_set: set) -> float:
        if node_id in anchor_set:
            return 1.0
        # 1-hop from anchor
        for aid in anchor_set:
            nbrs = self._gs.get_neighbors(aid, min_weight=0.40, depth=1)
            if any(n.node_id == node_id for n in nbrs):
                return 0.7
        return 0.0
