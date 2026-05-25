"""
GraphBuilder — 4-stage pipeline that constructs and persists the norm graph.

Stages:
  1. Seed:       Load SEED_NODES + SEED_EDGES into GraphStore
  2. Cluster:    Assign DOCTRINAL_CLUSTERS labels to nodes
  3. Embedding:  Add SEMANTICALLY_ADJACENT edges for high-similarity node pairs
  4. Persist:    Write to norm_graph.json; trigger centrality computation
"""

from __future__ import annotations
import os
import time
from typing import List, Optional, TYPE_CHECKING

from .graph_schema import NormNode, NormEdge, EdgeType, EDGE_TYPE_META, GraphMetadata
from .graph_store import GraphStore
from .seed_data import SEED_NODES, SEED_EDGES, DOCTRINAL_CLUSTERS

if TYPE_CHECKING:
    from ..embeddings.embedding_service import EmbeddingService

_SIMILARITY_THRESHOLD = 0.82   # minimum cosine sim to add semantic edge
_SEMANTIC_EDGE_LIMIT  = 5      # max semantic neighbors per node


class GraphBuilder:

    def __init__(self, store: GraphStore, embedding_service: Optional["EmbeddingService"] = None):
        self._store = store
        self._emb   = embedding_service

    # ── Public entry point ────────────────────────────────────────────────────

    def build(self, force_rebuild: bool = False) -> bool:
        """
        Full 4-stage build.  Returns True when the graph is ready.
        If the graph is already loaded and force_rebuild=False, skips Stage 1-3.
        """
        if self._store.is_loaded() and not force_rebuild:
            return True

        t0 = time.time()
        print("[GraphBuilder] Starting build …")

        self._stage_seed()
        self._stage_clusters()
        if self._emb is not None:
            self._stage_embedding_neighbors()
        else:
            print("[GraphBuilder] Stage 3 skipped — no EmbeddingService provided")
        self._stage_persist()

        elapsed = time.time() - t0
        print(f"[GraphBuilder] Build complete — "
              f"{self._store.node_count()} nodes, "
              f"{self._store.edge_count()} edges in {elapsed:.2f}s")
        return True

    def incremental_update(self, new_nodes: List[NormNode], new_edges: List[NormEdge]) -> int:
        """Add nodes/edges that don't already exist. Returns count of additions."""
        added = 0
        for node in new_nodes:
            if self._store.get_node(node.node_id) is None:
                self._store.add_node(node)
                added += 1
        for edge in new_edges:
            if self._store.get_edge_data(edge.source, edge.target) is None:
                self._store.add_edge(edge)
                added += 1
        if added:
            self._store.save()
        return added

    # ── Stage 1: Seed ─────────────────────────────────────────────────────────

    def _stage_seed(self) -> None:
        print(f"[GraphBuilder] Stage 1 — seeding {len(SEED_NODES)} nodes …")
        for nd in SEED_NODES:
            node = NormNode(
                node_id=nd["node_id"],
                statute=nd["statute"],
                paragraph=nd["paragraph"],
                citation=nd["citation"],
                title=nd["title"],
                domain=nd["domain"],
                jurisdiction=nd.get("jurisdiction", "DE"),
                semantic_keywords=nd.get("semantic_keywords", []),
                linked_concepts=nd.get("linked_concepts", []),
                aliases=nd.get("aliases", []),
            )
            self._store.add_node(node)

        print(f"[GraphBuilder] Stage 1 — seeding {len(SEED_EDGES)} edges …")
        for ed in SEED_EDGES:
            if self._store.get_node(ed["source"]) is None or \
               self._store.get_node(ed["target"]) is None:
                continue
            edge = NormEdge(
                source=ed["source"],
                target=ed["target"],
                edge_type=EdgeType(ed["edge_type"]),
                weight=ed["weight"],
                directional=EDGE_TYPE_META[EdgeType(ed["edge_type"])]["directional"],
                frequency=ed.get("frequency", 1),
                source_type=ed.get("source_type", "seed"),
                confidence=ed.get("confidence", 1.0),
            )
            self._store.add_edge(edge)
        print("[GraphBuilder] Stage 1 done.")

    # ── Stage 2: Cluster labels ───────────────────────────────────────────────

    def _stage_clusters(self) -> None:
        print("[GraphBuilder] Stage 2 — assigning cluster labels …")
        for cluster_id, node_ids in DOCTRINAL_CLUSTERS.items():
            for nid in node_ids:
                if self._store.get_node(nid) is not None:
                    self._store.set_cluster_id(nid, cluster_id)

        # Add SAME_CLUSTER edges within each cluster (undirected, low weight)
        meta = EDGE_TYPE_META[EdgeType.SAME_CLUSTER]
        for cluster_id, node_ids in DOCTRINAL_CLUSTERS.items():
            valid = [n for n in node_ids if self._store.get_node(n) is not None]
            for i, src in enumerate(valid):
                for tgt in valid[i + 1:]:
                    if self._store.get_edge_data(src, tgt) is None:
                        edge = NormEdge(
                            source=src, target=tgt,
                            edge_type=EdgeType.SAME_CLUSTER,
                            weight=meta["base_weight"],
                            directional=False,
                            source_type="seed",
                        )
                        self._store.add_edge(edge)
        print("[GraphBuilder] Stage 2 done.")

    # ── Stage 3: Embedding-based semantic neighbors ───────────────────────────

    def _stage_embedding_neighbors(self) -> None:
        print("[GraphBuilder] Stage 3 — computing semantic neighbors …")
        nodes = self._store.get_all_nodes()
        texts = [f"{n.citation} {n.title} {' '.join(n.semantic_keywords)}" for n in nodes]

        try:
            import numpy as np
            embeddings = self._emb.embed_texts(texts)    # (N, D) numpy array

            # Cosine similarity matrix
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            normed = embeddings / (norms + 1e-9)
            sim_matrix = normed @ normed.T

            added = 0
            meta = EDGE_TYPE_META[EdgeType.SEMANTICALLY_ADJACENT]
            for i, src_node in enumerate(nodes):
                # Get top-K similar nodes (exclude self)
                sims = sim_matrix[i].copy()
                sims[i] = -1.0
                top_indices = sims.argsort()[::-1][:_SEMANTIC_EDGE_LIMIT * 3]
                count = 0
                for j in top_indices:
                    if count >= _SEMANTIC_EDGE_LIMIT:
                        break
                    sim = float(sims[j])
                    if sim < _SIMILARITY_THRESHOLD:
                        break
                    tgt_node = nodes[j]
                    # Skip if a stronger typed edge already exists
                    existing = self._store.get_edge_data(src_node.node_id, tgt_node.node_id)
                    if existing and existing.get("weight", 0) >= sim:
                        count += 1
                        continue
                    if existing is None:
                        edge = NormEdge(
                            source=src_node.node_id,
                            target=tgt_node.node_id,
                            edge_type=EdgeType.SEMANTICALLY_ADJACENT,
                            weight=round(sim, 4),
                            directional=False,
                            source_type="embedding",
                            confidence=round(sim, 4),
                        )
                        self._store.add_edge(edge)
                        added += 1
                    count += 1
            print(f"[GraphBuilder] Stage 3 done — {added} semantic edges added.")
        except Exception as e:
            print(f"[GraphBuilder] Stage 3 warning: {e}")

    # ── Stage 4: Persist ──────────────────────────────────────────────────────

    def _stage_persist(self) -> None:
        print("[GraphBuilder] Stage 4 — persisting graph …")
        nodes = self._store.get_all_nodes()
        self._store.metadata = GraphMetadata(
            node_count=len(nodes),
            edge_count=self._store.edge_count(),
            statutes=sorted({n.statute for n in nodes}),
            domains=sorted({n.domain for n in nodes}),
            last_built=__import__("datetime").datetime.utcnow().isoformat(),
            centrality_computed=False,
        )
        ok = self._store.save()
        print(f"[GraphBuilder] Stage 4 done — saved={ok}.")
