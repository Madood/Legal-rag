"""
GraphLearner — incremental edge weight updates driven by retrieval co-occurrence.

Strategy:
  - For each (a, b) pair with co-occurrence count ≥ MIN_COOCCUR:
      * If edge exists:  nudge weight toward (weight + α * delta), clamped [0,1]
      * If no edge and count ≥ NEW_EDGE_THRESHOLD: add SEMANTICALLY_ADJACENT edge
  - Run after every N queries (triggered by RetrievalLogger flush count) or on demand
"""

from __future__ import annotations
import time
from typing import Dict, Optional, Tuple

from .graph_schema import NormEdge, EdgeType
from .graph_store import GraphStore
from .retrieval_logger import RetrievalLogger

_ALPHA             = 0.05    # learning rate for weight nudge
_MIN_COOCCUR       = 3       # minimum co-occurrences to adjust
_NEW_EDGE_THRESHOLD= 8       # co-occurrence count to create a new edge
_NEW_EDGE_WEIGHT   = 0.45    # initial weight for learned edges
_MAX_WEIGHT        = 0.95    # cap — seed edges can still beat learned ones


class GraphLearner:

    def __init__(self, store: GraphStore, logger: RetrievalLogger):
        self._store  = store
        self._logger = logger

    def run(self, dry_run: bool = False) -> Dict:
        t0 = time.time()
        cooccur = self._logger.get_cooccurrence()
        updated = 0
        created = 0

        for (a, b), count in cooccur.items():
            if count < _MIN_COOCCUR:
                continue
            if self._store.get_node(a) is None or self._store.get_node(b) is None:
                continue

            existing = self._store.get_edge_data(a, b)
            if existing:
                old_w = existing.get("weight", 0.5)
                delta = (1.0 - old_w) * count / (count + 10)  # diminishing return
                new_w = min(_MAX_WEIGHT, old_w + _ALPHA * delta)
                if not dry_run:
                    self._store.update_edge_weight(a, b, new_w)
                    if not existing.get("directional", True):
                        self._store.update_edge_weight(b, a, new_w)
                updated += 1
            elif count >= _NEW_EDGE_THRESHOLD:
                weight = _NEW_EDGE_WEIGHT + _ALPHA * (count / (count + 20))
                if not dry_run:
                    edge = NormEdge(
                        source=a, target=b,
                        edge_type=EdgeType.SEMANTICALLY_ADJACENT,
                        weight=round(weight, 4),
                        directional=False,
                        frequency=count,
                        source_type="log",
                        confidence=round(weight, 4),
                    )
                    self._store.add_edge(edge)
                created += 1

        if not dry_run and (updated or created):
            self._store.save()

        elapsed = time.time() - t0
        report = {
            "updated": updated,
            "created": created,
            "elapsed_s": round(elapsed, 3),
            "dry_run": dry_run,
        }
        print(f"[GraphLearner] edges_updated={updated} edges_created={created} "
              f"dry_run={dry_run} ({elapsed:.2f}s)")
        return report
