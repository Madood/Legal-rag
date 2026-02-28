import json
import os
from typing import Dict, List, Optional


class DocumentStore:
    """
    Persistent document registry for statutes and user documents.
    This is NOT vector search. It is structural storage.
    """

    def __init__(self, path: str):
        self.path = path
        self.documents: Dict[str, Dict] = {}

    def load(self):
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                self.documents = json.load(f)
        else:
            self.documents = {}

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.documents, f, indent=2, ensure_ascii=False)

    def add_document(self, doc: Dict) -> bool:
        doc_id = doc.get("id")
        if not doc_id:
            return False
        self.documents[doc_id] = doc
        self.save()
        return True

    def add_documents_batch(self, docs: List[Dict]) -> bool:
        for doc in docs:
            if "id" in doc:
                self.documents[doc["id"]] = doc
        self.save()
        return True

    def get_document(self, doc_id: str) -> Optional[Dict]:
        return self.documents.get(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        if doc_id in self.documents:
            del self.documents[doc_id]
            self.save()
            return True
        return False

    def get_all(self) -> List[Dict]:
        return list(self.documents.values())

    def get_by_statute(self, statute: str) -> List[Dict]:
        return [
            doc for doc in self.documents.values()
            if doc.get("statute") == statute
        ]

    def search(self, query: str, limit: int = 10) -> List[Dict]:
        q = query.lower()
        results = []
        for doc in self.documents.values():
            text = json.dumps(doc, ensure_ascii=False).lower()
            if q in text:
                results.append(doc)
            if len(results) >= limit:
                break
        return results

    def get_stats(self) -> Dict:
        statutes = {}
        for doc in self.documents.values():
            s = doc.get("statute", "UNKNOWN")
            statutes[s] = statutes.get(s, 0) + 1

        return {
            "total_documents": len(self.documents),
            "by_statute": statutes,
            "path": self.path
        }
