"""
GraphStore — NetworkX DiGraph wrapper with persistence.

Responsibilities:
- Node/edge CRUD
- JSON serialization/deserialization
- Thread-safe updates
- Cached adjacency lists for O(1) neighbor lookups
"""

from __future__ import annotations
import json
import os
import threading
import time
from typing import Dict, List, Optional, Set, Tuple, Any
import datetime

import networkx as nx

from .graph_schema import NormNode, NormEdge, EdgeType, GraphMetadata, EDGE_TYPE_META

_GRAPH_DIR = os.path.join(os.path.dirname(__file__), "data")
_GRAPH_JSON = os.path.join(_GRAPH_DIR, "norm_graph.json")


class GraphStore:
    """
    Thread-safe NetworkX DiGraph with adjacency cache and JSON persistence.
    All public methods are safe to call from async context.
    """

    def __init__(self):
        self._graph: nx.DiGraph = nx.DiGraph()
        self._lock = threading.RLock()
        self._nodes: Dict[str, NormNode] = {}         # node_id → NormNode
        self._adj_cache: Dict[str, List[str]] = {}   # node_id → [neighbor_ids]
        self._cluster_index: Dict[str, str] = {}      # node_id → cluster_id
        self._domain_index: Dict[str, List[str]] = {} # domain → [node_ids]
        self.metadata = GraphMetadata()
        self._loaded = False

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def load(self, path: str = _GRAPH_JSON) -> bool:
        if not os.path.exists(path):
            return False
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            with self._lock:
                self._graph = nx.DiGraph()
                self._nodes = {}
                for nd in data.get("nodes", []):
                    node = NormNode.from_dict(nd)
                    self._nodes[node.node_id] = node
                    self._graph.add_node(node.node_id, **nd)
                for ed in data.get("edges", []):
                    edge = NormEdge.from_dict(ed)
                    self._graph.add_edge(
                        edge.source, edge.target,
                        edge_type=edge.edge_type.value,
                        weight=edge.weight,
                        directional=edge.directional,
                        frequency=edge.frequency,
                        source_type=edge.source_type,
                        confidence=edge.confidence,
                    )
                    # Undirected edges: also add reverse
                    if not edge.directional:
                        self._graph.add_edge(
                            edge.target, edge.source,
                            edge_type=edge.edge_type.value,
                            weight=edge.weight,
                            directional=False,
                            frequency=edge.frequency,
                            source_type=edge.source_type,
                            confidence=edge.confidence,
                        )
                if "metadata" in data:
                    self.metadata = GraphMetadata(**data["metadata"])
                self._rebuild_caches()
                self._loaded = True
            print(f"✅ [GraphStore] Loaded {len(self._nodes)} nodes, "
                  f"{self._graph.number_of_edges()} edges from {path}")
            return True
        except Exception as e:
            print(f"⚠️  [GraphStore] Load failed: {e}")
            return False

    def save(self, path: str = _GRAPH_JSON) -> bool:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            with self._lock:
                # Collect unique edges (avoid duplicate reverse edges)
                seen: Set[Tuple] = set()
                edge_list = []
                for u, v, data in self._graph.edges(data=True):
                    key = (min(u, v), max(u, v), data.get("edge_type"))
                    if key in seen and not data.get("directional", True):
                        continue
                    seen.add(key)
                    edge_list.append({
                        "source": u, "target": v,
                        "edge_type": data.get("edge_type", "cites"),
                        "weight": data.get("weight", 0.5),
                        "directional": data.get("directional", True),
                        "frequency": data.get("frequency", 1),
                        "source_type": data.get("source_type", "seed"),
                        "confidence": data.get("confidence", 1.0),
                        "metadata": data.get("metadata", {}),
                    })
                payload = {
                    "nodes": [n.to_dict() for n in self._nodes.values()],
                    "edges": edge_list,
                    "metadata": self.metadata.to_dict(),
                }
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"⚠️  [GraphStore] Save failed: {e}")
            return False

    # ── Node operations ──────────────────────────────────────────────────────

    def add_node(self, node: NormNode) -> None:
        with self._lock:
            self._nodes[node.node_id] = node
            self._graph.add_node(node.node_id, **node.to_dict())
            self._update_node_indices(node)

    def get_node(self, node_id: str) -> Optional[NormNode]:
        return self._nodes.get(node_id)

    def get_nodes_by_domain(self, domain: str) -> List[NormNode]:
        ids = self._domain_index.get(domain, [])
        return [self._nodes[i] for i in ids if i in self._nodes]

    def get_all_nodes(self) -> List[NormNode]:
        return list(self._nodes.values())

    def update_node_centrality(self, node_id: str, **scores: float) -> None:
        with self._lock:
            node = self._nodes.get(node_id)
            if node:
                for field, val in scores.items():
                    if hasattr(node, field):
                        setattr(node, field, val)
                self._graph.nodes[node_id].update(scores)

    # ── Edge operations ──────────────────────────────────────────────────────

    def add_edge(self, edge: NormEdge) -> None:
        with self._lock:
            if edge.source not in self._graph or edge.target not in self._graph:
                return
            edata = dict(
                edge_type=edge.edge_type.value,
                weight=edge.weight,
                directional=edge.directional,
                frequency=edge.frequency,
                source_type=edge.source_type,
                confidence=edge.confidence,
            )
            self._graph.add_edge(edge.source, edge.target, **edata)
            if not edge.directional:
                self._graph.add_edge(edge.target, edge.source, **edata)
            self._invalidate_adj_cache(edge.source)
            self._invalidate_adj_cache(edge.target)

    def get_edges(self, node_id: str, edge_types: Optional[List[EdgeType]] = None,
                  min_weight: float = 0.0) -> List[Tuple[str, Dict]]:
        """Return (neighbor_id, edge_data) pairs."""
        edges = []
        for _, nbr, data in self._graph.out_edges(node_id, data=True):
            if min_weight and data.get("weight", 0) < min_weight:
                continue
            if edge_types:
                et = EdgeType(data.get("edge_type", "cites"))
                if et not in edge_types:
                    continue
            edges.append((nbr, data))
        return sorted(edges, key=lambda x: x[1].get("weight", 0), reverse=True)

    def get_edge_data(self, source: str, target: str) -> Optional[Dict]:
        return self._graph.get_edge_data(source, target)

    def update_edge_weight(self, source: str, target: str, new_weight: float) -> None:
        with self._lock:
            if self._graph.has_edge(source, target):
                self._graph[source][target]["weight"] = min(1.0, max(0.0, new_weight))

    # ── Graph queries ────────────────────────────────────────────────────────

    def neighbors(self, node_id: str, min_weight: float = 0.25) -> List[str]:
        """Cached neighbors above weight threshold."""
        cache_key = f"{node_id}:{min_weight:.2f}"
        if cache_key in self._adj_cache:
            return self._adj_cache[cache_key]
        if node_id not in self._graph:
            return []
        nbrs = [
            nbr for nbr, data in self._graph[node_id].items()
            if data.get("weight", 0) >= min_weight
        ]
        self._adj_cache[cache_key] = nbrs
        return nbrs

    def has_path(self, source: str, target: str) -> bool:
        try:
            return nx.has_path(self._graph, source, target)
        except Exception:
            return False

    def shortest_path(self, source: str, target: str) -> List[str]:
        try:
            return nx.shortest_path(self._graph, source, target, weight=None)
        except nx.NetworkXNoPath:
            return []
        except nx.NodeNotFound:
            return []

    def get_subgraph(self, node_ids: List[str]) -> nx.DiGraph:
        return self._graph.subgraph(node_ids).copy()

    def get_nx_graph(self) -> nx.DiGraph:
        return self._graph

    def get_cluster_id(self, node_id: str) -> str:
        return self._cluster_index.get(node_id, "")

    def set_cluster_id(self, node_id: str, cluster_id: str) -> None:
        with self._lock:
            self._cluster_index[node_id] = cluster_id
            node = self._nodes.get(node_id)
            if node:
                node.cluster_id = cluster_id

    def node_count(self) -> int:
        return len(self._nodes)

    def edge_count(self) -> int:
        return self._graph.number_of_edges()

    def is_loaded(self) -> bool:
        return self._loaded

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _rebuild_caches(self) -> None:
        self._adj_cache.clear()
        self._cluster_index.clear()
        self._domain_index.clear()
        for node in self._nodes.values():
            self._update_node_indices(node)

    def _update_node_indices(self, node: NormNode) -> None:
        if node.cluster_id:
            self._cluster_index[node.node_id] = node.cluster_id
        domain = node.domain
        if domain not in self._domain_index:
            self._domain_index[domain] = []
        if node.node_id not in self._domain_index[domain]:
            self._domain_index[domain].append(node.node_id)

    def _invalidate_adj_cache(self, node_id: str) -> None:
        keys_to_delete = [k for k in self._adj_cache if k.startswith(f"{node_id}:")]
        for k in keys_to_delete:
            del self._adj_cache[k]
