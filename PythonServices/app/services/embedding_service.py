import numpy as np
from sentence_transformers import SentenceTransformer
import hashlib
import pickle
import os
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"):
        """
        Initialize embedding service with multilingual model
        """
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.cache_dir = os.getenv("EMBEDDING_CACHE_DIR", "./data/cache/embeddings")
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Legal domain specific settings
        self.legal_languages = ["de", "en"]  # German and English
        logger.info(f"EmbeddingService initialized with model: {model_name}")
    
    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text"""
        return hashlib.md5(text.encode()).hexdigest()
    
    def _load_from_cache(self, cache_key: str) -> Optional[np.ndarray]:
        """Load embedding from cache"""
        cache_path = os.path.join(self.cache_dir, f"{cache_key}.pkl")
        if os.path.exists(cache_path):
            with open(cache_path, 'rb') as f:
                return pickle.load(f)
        return None
    
    def _save_to_cache(self, cache_key: str, embedding: np.ndarray):
        """Save embedding to cache"""
        cache_path = os.path.join(self.cache_dir, f"{cache_key}.pkl")
        with open(cache_path, 'wb') as f:
            pickle.dump(embedding, f)
    
    def embed_text(self, text: str, use_cache: bool = True) -> np.ndarray:
        """
        Generate embedding for a single text
        """
        if not text or not text.strip():
            return np.zeros(self.model.get_sentence_embedding_dimension())
        
        text = text.strip()
        
        # Check cache
        if use_cache:
            cache_key = self._get_cache_key(text)
            cached = self._load_from_cache(cache_key)
            if cached is not None:
                return cached
        
        # Generate embedding
        try:
            embedding = self.model.encode(text)
            
            # Normalize
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            # Cache if requested
            if use_cache:
                cache_key = self._get_cache_key(text)
                self._save_to_cache(cache_key, embedding)
            
            return embedding
            
        except Exception as e:
            logger.error(f"Error embedding text: {e}")
            return np.zeros(self.model.get_sentence_embedding_dimension())
    
    def embed_batch(self, texts: List[str], batch_size: int = 32, use_cache: bool = True) -> List[np.ndarray]:
        """
        Generate embeddings for batch of texts
        """
        embeddings = []
        uncached_texts = []
        uncached_indices = []
        
        if use_cache:
            for i, text in enumerate(texts):
                if not text or not text.strip():
                    embeddings.append(np.zeros(self.model.get_sentence_embedding_dimension()))
                else:
                    cache_key = self._get_cache_key(text.strip())
                    cached = self._load_from_cache(cache_key)
                    if cached is not None:
                        embeddings.append(cached)
                    else:
                        uncached_texts.append(text.strip())
                        uncached_indices.append(i)
                        embeddings.append(None)  # Placeholder
        else:
            uncached_texts = [t.strip() for t in texts if t and t.strip()]
            uncached_indices = list(range(len(uncached_texts)))
            embeddings = [None] * len(texts)
        
        # Process uncached texts
        if uncached_texts:
            try:
                batch_embeddings = self.model.encode(
                    uncached_texts,
                    batch_size=batch_size,
                    show_progress_bar=False
                )
                
                # Normalize and cache
                for idx, embedding in zip(uncached_indices, batch_embeddings):
                    norm = np.linalg.norm(embedding)
                    if norm > 0:
                        embedding = embedding / norm
                    
                    embeddings[idx] = embedding
                    
                    if use_cache:
                        text = uncached_texts[uncached_indices.index(idx)]
                        cache_key = self._get_cache_key(text)
                        self._save_to_cache(cache_key, embedding)
                        
            except Exception as e:
                logger.error(f"Error batch embedding: {e}")
                # Fill with zeros
                for idx in uncached_indices:
                    embeddings[idx] = np.zeros(self.model.get_sentence_embedding_dimension())
        
        # Replace any remaining None with zeros
        for i in range(len(embeddings)):
            if embeddings[i] is None:
                embeddings[i] = np.zeros(self.model.get_sentence_embedding_dimension())
        
        return embeddings
    
    def embed_query(self, query: str, statute: Optional[str] = None) -> np.ndarray:
        """
        Special embedding for queries with legal context enhancement
        """
        base_embedding = self.embed_text(query)
        
        # Boost for legal terms
        legal_terms = ["gesetz", "recht", "norm", "paragraph", "artikel", 
                      "statute", "law", "code", "article", "section"]
        
        # Enhance with statute context if provided
        if statute:
            statute_embedding = self.embed_text(statute)
            # Weighted combination
            enhanced = 0.7 * base_embedding + 0.3 * statute_embedding
            norm = np.linalg.norm(enhanced)
            if norm > 0:
                enhanced = enhanced / norm
            return enhanced
        
        return base_embedding
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_name": self.model_name,
            "embedding_dimension": self.model.get_sentence_embedding_dimension(),
            "max_seq_length": self.model.max_seq_length,
            "languages": self.legal_languages
        }

# Singleton instance
embedding_service = EmbeddingService()