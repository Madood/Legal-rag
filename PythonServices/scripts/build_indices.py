#!/usr/bin/env python3
"""
Script to build vector indices from processed documents.
"""

import os
import sys
import json
import pickle
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from PythonServices.app.services.embeddings.embedding_service import EmbeddingService
from PythonServices.app.services.embeddings.vector_store import create_default_store

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IndexBuilder:
    """Build vector indices from processed documents"""
    
    def __init__(self, data_dir: str = "./data/processed"):
        self.data_dir = Path(data_dir)
        self.embedding_service = EmbeddingService()
        self.vector_store = create_default_store("legal_documents")
        
        # Ensure directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def load_processed_documents(self, statute: Optional[str] = None) -> List[Dict]:
        """Load processed documents from JSON files"""
        documents = []
        
        # Find all JSON files in data directory
        json_files = list(self.data_dir.glob("**/*.json"))
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    doc_data = json.load(f)
                
                # Filter by statute if specified
                if statute and doc_data.get("statute") != statute:
                    continue
                
                # Extract chunks
                chunks = doc_data.get("chunks", [])
                for i, chunk in enumerate(chunks):
                    document = {
                        "id": f"{doc_data['filename']}_{i}",
                        "filename": doc_data["filename"],
                        "content": chunk.get("content", ""),
                        "metadata": {
                            "filename": doc_data["filename"],
                            "statute": doc_data.get("statute", ""),
                            "language": doc_data.get("language", "de"),
                            "pages": doc_data.get("pages", 0),
                            "chunk_index": i,
                            "word_count": chunk.get("word_count", 0),
                            "has_paragraph": chunk.get("has_paragraph", False),
                            "has_article": chunk.get("has_article", False)
                        },
                        "statute": doc_data.get("statute", ""),
                        "chunk_index": i
                    }
                    documents.append(document)
                
                logger.info(f"Loaded {len(chunks)} chunks from {json_file.name}")
                
            except Exception as e:
                logger.error(f"Error loading {json_file}: {e}")
        
        return documents
    
    def build_statute_indices(self):
        """Build separate indices for each statute"""
        documents = self.load_processed_documents()
        
        # Group documents by statute
        statutes = {}
        for doc in documents:
            statute = doc.get("statute", "unknown")
            if statute not in statutes:
                statutes[statute] = []
            statutes[statute].append(doc)
        
        # Build index for each statute
        for statute, statute_docs in statutes.items():
            if statute == "unknown":
                continue
                
            logger.info(f"Building index for {statute} with {len(statute_docs)} documents")
            
            # Create statute-specific store
            store = create_default_store(f"legal_{statute.lower()}")
            store.create_collection()
            
            # Prepare documents and generate embeddings
            doc_contents = [doc["content"] for doc in statute_docs]
            embeddings = np.array(self.embedding_service.embed_batch(doc_contents))
            
            # Add to store
            store.add_documents(statute_docs, embeddings)
            
            # Save the index
            store.save()
            
            logger.info(f"Completed index for {statute}")
        
        logger.info(f"Built indices for {len(statutes)} statutes")
    
    def build_general_index(self):
        """Build general index with all documents"""
        documents = self.load_processed_documents()
        
        if not documents:
            logger.warning("No documents found to index")
            return
        
        logger.info(f"Building general index with {len(documents)} documents")
        
        # Create or clear general store
        self.vector_store.create_collection()
        
        # Prepare documents and generate embeddings
        doc_contents = [doc["content"] for doc in documents]
        embeddings = np.array(self.embedding_service.embed_batch(doc_contents))
        
        # Add to store
        self.vector_store.add_documents(documents, embeddings)
        
        # Save the index
        self.vector_store.save()
        
        # Get and log statistics
        stats = self.vector_store.get_stats()
        logger.info(f"General index built: {stats}")
    
    def rebuild_all_indices(self):
        """Rebuild all indices from scratch"""
        logger.info("Starting complete rebuild of all indices")
        
        # Rebuild general index
        self.build_general_index()
        
        # Rebuild statute indices
        self.build_statute_indices()
        
        logger.info("Completed rebuild of all indices")
    
    def get_index_stats(self) -> Dict[str, Any]:
        """Get statistics for all indices"""
        stats = {
            "general_index": self.vector_store.get_stats(),
            "statute_indices": {}
        }
        
        # Check for statute indices
        indices_dir = Path(os.getenv("INDICES_DIR", "./data/indices"))
        if indices_dir.exists():
            for subdir in indices_dir.iterdir():
                if subdir.is_dir() and subdir.name.startswith("legal_"):
                    statute = subdir.name.replace("legal_", "")
                    store = create_default_store(f"legal_{statute}")
                    if store.load(subdir):
                        stats["statute_indices"][statute.upper()] = store.get_stats()
        
        return stats
    
    def optimize_indices(self):
        """Optimize vector indices for better performance"""
        logger.info("Optimizing indices...")
        
        # Note: FAISS optimization would go here
        # For now, just re-save with compression if available
        
        stats = self.get_index_stats()
        logger.info(f"Optimization complete. Current stats: {stats}")

def main():
    """Main function for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Build vector indices for Legal RAG system")
    parser.add_argument("--data-dir", default="./data/processed", help="Directory with processed documents")
    parser.add_argument("--statute", help="Build index only for specific statute (e.g., BGB, HGB)")
    parser.add_argument("--general", action="store_true", help="Build general index")
    parser.add_argument("--all", action="store_true", help="Build all indices")
    parser.add_argument("--rebuild", action="store_true", help="Rebuild all indices from scratch")
    parser.add_argument("--stats", action="store_true", help="Show index statistics")
    parser.add_argument("--optimize", action="store_true", help="Optimize indices")
    
    args = parser.parse_args()
    
    builder = IndexBuilder(args.data_dir)
    
    if args.stats:
        stats = builder.get_index_stats()
        print(json.dumps(stats, indent=2))
    
    elif args.optimize:
        builder.optimize_indices()
    
    elif args.rebuild:
        builder.rebuild_all_indices()
    
    elif args.statute:
        documents = builder.load_processed_documents(args.statute)
        if documents:
            store = create_default_store(f"legal_{args.statute.lower()}")
            store.create_collection()
            
            doc_contents = [doc["content"] for doc in documents]
            embeddings = np.array(builder.embedding_service.embed_batch(doc_contents))
            
            store.add_documents(documents, embeddings)
            store.save()
            logger.info(f"Built index for {args.statute} with {len(documents)} documents")
        else:
            logger.warning(f"No documents found for statute {args.statute}")
    
    elif args.general:
        builder.build_general_index()
    
    elif args.all:
        builder.build_general_index()
        builder.build_statute_indices()
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()