"""
CentralityEngine — computes 5 graph centrality measures and a composite score.

Algorithms:
  1. Degree centrality         (structural connectivity)
  2. Betweenness centrality    (bridge / chokepoint role)
  3. PageRank / citation auth  (authoritative norm)
  4. Eigenvector centrality    (connected-to-important)
  5. Cluster centrality        (intra-cluster authority)

Composite:  0.30·pagerank + 0.25·eigenvector + 0.20·betweenness + 0.15·degree + 0.10·cluster
"""

from __future__ import annotations
import time
from typing import Dict

import networkx as nx

from .graph_store import GraphStore


_W_PAGERANK    = 0.30
_W_EIGENVECTOR = 0.25
_W_BETWEEN     = 0.20
_W_DEGREE      = 0.15
_W_CLUSTER     = 0.10


class CentralityEngine:

    def __init__(self, store: GraphStore):
        self._store = store

    def compute_all(self) -> Dict[str, float]:
        """
        Compute all centrality measures and write results back to GraphStore nodes.
        Returns {node_id: composite_score}.
        """
        g = self._store.get_nx_graph()
        if g.number_of_nodes() == 0:
            return {}

        t0 = time.time()
        print(f"[CentralityEngine] Computing centrality for {g.number_of_nodes()} nodes …")

        degree      = self._degree(g)
        between     = self._betweenness(g)
        pagerank    = self._pagerank(g)
        eigenvector = self._eigenvector(g)
        cluster     = self._cluster_centrality(g)

        composite: Dict[str, float] = {}
        for nid in g.nodes():
            d  = degree.get(nid, 0.0)
            b  = between.get(nid, 0.0)
            pr = pagerank.get(nid, 0.0)
            ev = eigenvector.get(nid, 0.0)
            cl = cluster.get(nid, 0.0)
            score = (_W_PAGERANK * pr + _W_EIGENVECTOR * ev +
                     _W_BETWEEN  * b  + _W_DEGREE      * d  +
                     _W_CLUSTER  * cl)
            composite[nid] = round(score, 6)
            self._store.update_node_centrality(
                nid,
                centrality_score    = composite[nid],
                citation_authority  = pr,
                degree_centrality   = d,
                betweenness_centrality = b,
                eigenvector_centrality = ev,
            )

        # Mark metadata
        self._store.metadata.centrality_computed = True
        self._store.save()

        elapsed = time.time() - t0
        print(f"[CentralityEngine] Done in {elapsed:.2f}s. "
              f"Top node: {max(composite, key=composite.get)} "
              f"({max(composite.values()):.4f})")
        return composite

    # ── Individual algorithms ──────────────────────────────────────────────────

    def _degree(self, g: nx.DiGraph) -> Dict[str, float]:
        raw = nx.degree_centrality(g)
        return self._normalize(raw)

    def _betweenness(self, g: nx.DiGraph) -> Dict[str, float]:
        # k-sample approximation for large graphs (k=min(n, 200))
        k = min(g.number_of_nodes(), 200)
        try:
            raw = nx.betweenness_centrality(g, k=k, normalized=True, weight="weight")
        except Exception:
            raw = nx.betweenness_centrality(g, normalized=True)
        return self._normalize(raw)

    def _pagerank(self, g: nx.DiGraph) -> Dict[str, float]:
        try:
            raw = nx.pagerank(g, alpha=0.85, weight="weight", max_iter=200)
        except nx.PowerIterationFailedConvergence:
            raw = nx.pagerank(g, alpha=0.85, weight=None, max_iter=500)
        return self._normalize(raw)

    def _eigenvector(self, g: nx.DiGraph) -> Dict[str, float]:
        try:
            raw = nx.eigenvector_centrality(g, max_iter=500, weight="weight")
        except nx.PowerIterationFailedConvergence:
            # Fall back to undirected version if directed fails to converge
            try:
                ug = g.to_undirected()
                raw = nx.eigenvector_centrality(ug, max_iter=1000, weight="weight")
            except Exception:
                raw = {n: 0.0 for n in g.nodes()}
        return self._normalize(raw)

    def _cluster_centrality(self, g: nx.DiGraph) -> Dict[str, float]:
        """
        Intra-cluster authority: fraction of in-cluster edges pointing TO this node,
        weighted by edge weight.
        """
        result: Dict[str, float] = {n: 0.0 for n in g.nodes()}
        cluster_map = {n: self._store.get_cluster_id(n) for n in g.nodes()}

        # Sum weighted in-degree from same-cluster predecessors
        for node in g.nodes():
            c = cluster_map.get(node, "")
            if not c:
                continue
            in_w = sum(
                data.get("weight", 0.5)
                for pred, _, data in g.in_edges(node, data=True)
                if cluster_map.get(pred) == c
            )
            result[node] = in_w

        return self._normalize(result)

    @staticmethod
    def _normalize(scores: Dict[str, float]) -> Dict[str, float]:
        if not scores:
            return scores
        max_v = max(scores.values()) or 1.0
        return {k: v / max_v for k, v in scores.items()}
