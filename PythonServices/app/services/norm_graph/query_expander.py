"""
QueryExpander — graph-guided doctrinal query expansion.

Takes a resolved (statute, paragraph_refs, domain) tuple and returns:
  - expanded_paragraphs: list of paragraph strings (original + graph neighbors)
  - expansion_context:   brief text describing the expansion rationale
  - graph_node_ids:      node_ids of all included nodes (for reranker)
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple

from .graph_schema import EdgeType, NormNode
from .graph_service import GraphService

_EXPANSION_EDGE_TYPES = [
    EdgeType.CITES,
    EdgeType.DOCTRINALLY_RELATED,
    EdgeType.PREREQUISITE_FOR,
    EdgeType.EXCEPTION_TO,
    EdgeType.INTERPRETED_WITH,
]
_MAX_EXPANSION = 6


class QueryExpander:

    def __init__(self, graph_service: Optional[GraphService] = None):
        self._gs = graph_service or GraphService.get_instance()

    def expand(
        self,
        statute: str,
        paragraph_refs: List[str],
        domain: str = "",
        question_type: str = "GENERAL",
    ) -> Dict:
        """
        Returns:
          {
            "expanded_paragraphs": ["249", "280", ...],
            "expansion_context":   "§ 249 BGB → § 280 BGB (prerequisite_for) …",
            "graph_node_ids":      ["BGB_249", "BGB_280", ...],
            "anchor_node_ids":     ["BGB_249"],      # original resolved nodes
          }
        """
        if not self._gs.is_ready():
            return self._passthrough(statute, paragraph_refs)

        stat = statute.upper()
        anchor_ids = [f"{stat}_{p}" for p in paragraph_refs]
        expanded_nodes = self._gs.expand_query_nodes(stat, paragraph_refs)

        # For CONCEPT/DEFINITION queries also pull top domain anchors
        if question_type in ("CONCEPT", "DEFINITION") and domain:
            domain_anchors = self._gs.get_domain_anchors(domain)[:3]
            seen = {n.node_id for n in expanded_nodes}
            for n in domain_anchors:
                if n.node_id not in seen:
                    expanded_nodes.append(n)

        # Cap expansion
        expanded_nodes = expanded_nodes[:_MAX_EXPANSION]

        expanded_paragraphs = [n.paragraph for n in expanded_nodes
                                if n.statute.upper() == stat]
        graph_node_ids      = [n.node_id for n in expanded_nodes]

        context = self._build_context(anchor_ids, expanded_nodes)

        return {
            "expanded_paragraphs": expanded_paragraphs,
            "expansion_context":   context,
            "graph_node_ids":      graph_node_ids,
            "anchor_node_ids":     anchor_ids,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_context(self, anchor_ids: List[str], expanded: List[NormNode]) -> str:
        if not expanded:
            return ""
        parts = []
        for node in expanded[:4]:
            parts.append(node.citation)
        return " · ".join(parts)

    def _passthrough(self, statute: str, paragraph_refs: List[str]) -> Dict:
        stat = statute.upper()
        return {
            "expanded_paragraphs": paragraph_refs,
            "expansion_context":   "",
            "graph_node_ids":      [f"{stat}_{p}" for p in paragraph_refs],
            "anchor_node_ids":     [f"{stat}_{p}" for p in paragraph_refs],
        }
