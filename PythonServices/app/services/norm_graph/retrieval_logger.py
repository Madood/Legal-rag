"""
RetrievalLogger — event sink for co-occurrence tracking and learning signals.

Events logged:
  - query_resolved:   (statute, paragraphs, question_type, domain)
  - results_returned: (ranked node_ids, scores)
  - user_interaction: (clicked_node_id) — future web hook

Co-occurrence matrix: maps (node_a, node_b) → count.
Flushed to retrieval_log.json periodically; read by GraphLearner.
"""

from __future__ import annotations
import json
import os
import threading
import time
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

_LOG_DIR  = os.path.join(os.path.dirname(__file__), "data")
_LOG_FILE = os.path.join(_LOG_DIR, "retrieval_log.json")
_FLUSH_INTERVAL = 60          # seconds between auto-flushes
_MAX_BUFFER     = 500         # flush when buffer exceeds this


class RetrievalLogger:

    def __init__(self):
        self._lock       = threading.RLock()
        self._cooccur:   Dict[Tuple[str, str], int] = defaultdict(int)
        self._event_buf: List[Dict] = []
        self._last_flush = time.time()
        self._load()

    # ── Logging API ───────────────────────────────────────────────────────────

    def log_query(
        self,
        statute: str,
        paragraphs: List[str],
        question_type: str,
        domain: str,
        result_node_ids: List[str],
    ) -> None:
        with self._lock:
            stat = statute.upper()
            node_ids = [f"{stat}_{p}" for p in paragraphs] + result_node_ids
            # Record all co-occurring pairs (order-independent)
            for i, a in enumerate(node_ids):
                for b in node_ids[i + 1:]:
                    key = (min(a, b), max(a, b))
                    self._cooccur[key] += 1
            self._event_buf.append({
                "ts": time.time(),
                "statute": stat,
                "paragraphs": paragraphs,
                "question_type": question_type,
                "domain": domain,
                "results": result_node_ids[:5],
            })
            if (len(self._event_buf) >= _MAX_BUFFER or
                    time.time() - self._last_flush > _FLUSH_INTERVAL):
                self._flush_locked()

    def log_click(self, node_id: str, result_node_ids: List[str]) -> None:
        with self._lock:
            for other in result_node_ids:
                if other != node_id:
                    key = (min(node_id, other), max(node_id, other))
                    self._cooccur[key] += 2   # clicks count double

    def get_cooccurrence(self) -> Dict[Tuple[str, str], int]:
        with self._lock:
            return dict(self._cooccur)

    def flush(self) -> None:
        with self._lock:
            self._flush_locked()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _flush_locked(self) -> None:
        os.makedirs(_LOG_DIR, exist_ok=True)
        payload = {
            "cooccurrence": {f"{a}|{b}": cnt for (a, b), cnt in self._cooccur.items()},
            "events": self._event_buf[-200:],   # keep last 200 events
        }
        try:
            with open(_LOG_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
        except Exception as e:
            print(f"[RetrievalLogger] Flush error: {e}")
        self._event_buf.clear()
        self._last_flush = time.time()

    def _load(self) -> None:
        if not os.path.exists(_LOG_FILE):
            return
        try:
            with open(_LOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for k, v in data.get("cooccurrence", {}).items():
                a, b = k.split("|", 1)
                self._cooccur[(a, b)] = v
        except Exception as e:
            print(f"[RetrievalLogger] Load error: {e}")
