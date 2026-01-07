import re
import numpy as np
import faiss
import chromadb
import pickle
import os
from typing import List, Dict, Any, Optional, Tuple
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class StatuteFirstIndexer:
    """Specialized indexer for German statutes that preserves legal authority"""
    
    @staticmethod
    def extract_stgb_paragraphs(text: str, statute: str = "StGB") -> List[Dict]:
        """
        Extract individual paragraphs from StGB text with proper authority metadata
        Returns: List of documents with paragraph, statute, and content
        """
        documents = []
        
        # Pattern for German law paragraphs with optional letters
        paragraph_pattern = r'(?:§|Artikel)\s*(\d+[a-z]?)'
        
        # Split by paragraph markers while keeping them
        lines = text.split('\n')
        current_paragraph = None
        current_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if this line starts a new paragraph
            match = re.match(paragraph_pattern, line)
            if match:
                # Save previous paragraph if exists
                if current_paragraph and current_content:
                    doc = {
                        "content": ' '.join(current_content),
                        "statute": statute,
                        "paragraph": current_paragraph,
                        "norm_type": "criminal_offense",
                        "is_normative": True,
                        "authority_level": "statutory"
                    }
                    documents.append(doc)
                
                # Start new paragraph
                current_paragraph = match.group(1)
                current_content = [line]
            elif current_paragraph:
                # Continue current paragraph
                current_content.append(line)
        
        # Don't forget the last paragraph
        if current_paragraph and current_content:
            doc = {
                "content": ' '.join(current_content),
                "statute": statute,
                "paragraph": current_paragraph,
                "norm_type": "criminal_offense",
                "is_normative": True,
                "authority_level": "statutory"
            }
            documents.append(doc)
        
        return documents
    
    @staticmethod
    def extract_bgb_paragraphs(text: str, statute: str = "BGB") -> List[Dict]:
        """Extract BGB paragraphs (civil code)"""
        documents = []
        
        # BGB uses § for paragraphs
        lines = text.split('\n')
        current_paragraph = None
        current_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # BGB paragraph pattern
            if line.startswith('§'):
                # Extract paragraph number
                parts = line.split()
                if parts and parts[0] == '§' and len(parts) > 1:
                    # Save previous
                    if current_paragraph and current_content:
                        doc = {
                            "content": ' '.join(current_content),
                            "statute": statute,
                            "paragraph": current_paragraph,
                            "norm_type": "civil_norm",
                            "is_normative": True,
                            "authority_level": "statutory"
                        }
                        documents.append(doc)
                    
                    # Start new
                    current_paragraph = parts[1].rstrip('.')
                    current_content = [line]
            elif current_paragraph:
                current_content.append(line)
        
        if current_paragraph and current_content:
            doc = {
                "content": ' '.join(current_content),
                "statute": statute,
                "paragraph": current_paragraph,
                "norm_type": "civil_norm",
                "is_normative": True,
                "authority_level": "statutory"
            }
            documents.append(doc)
        
        return documents

class StatuteFirstValidator:
    """Validate that responses have proper statutory authority"""
    
    @staticmethod
    def validate_response(response_text: str, statute: str, paragraph: str) -> Dict:
        """
        Validate that response cites the correct statute and paragraph
        Returns validation result with score
        """
        validation = {
            "is_valid": False,
            "statute_found": False,
            "paragraph_found": False,
            "security_score": 0,
            "issues": []
        }
        
        # Check for statute
        if statute.upper() in response_text.upper():
            validation["statute_found"] = True
        
        # Check for paragraph (with various formats)
        paragraph_patterns = [
            f"§{paragraph}",
            f"§ {paragraph}",
            f"§{paragraph} ",
            f"paragraph {paragraph}",
            f"art.{paragraph}"  # For articles
        ]
        
        for pattern in paragraph_patterns:
            if pattern in response_text:
                validation["paragraph_found"] = True
                break
        
        # Determine validity
        validation["is_valid"] = validation["statute_found"] and validation["paragraph_found"]
        
        # Calculate security score
        if validation["is_valid"]:
            validation["security_score"] = 95
        elif validation["statute_found"] and not validation["paragraph_found"]:
            validation["security_score"] = 40
            validation["issues"].append("Paragraph not cited")
        elif not validation["statute_found"] and validation["paragraph_found"]:
            validation["security_score"] = 30
            validation["issues"].append("Statute not cited")
        else:
            validation["security_score"] = 0
            validation["issues"].append("No statutory authority cited")
        
        return validation

class VectorStore:
    """Base class for vector store implementations"""
    
    def __init__(self, store_type: str = "faiss"):
        self.store_type = store_type
        self.dimension = 768  # Default for multilingual MPNet
        self.index = None
        self.metadata = {}
        self.indices_dir = os.getenv("INDICES_DIR", "./data/indices")
        os.makedirs(self.indices_dir, exist_ok=True)
    
    def create_index(self, dimension: int):
        """Create empty index"""
        raise NotImplementedError
    
    def add_vectors(self, vectors: np.ndarray, metadatas: List[Dict]):
        """Add vectors to index"""
        raise NotImplementedError
    
    def search(self, query_vector: np.ndarray, k: int = 5, filter_dict: Optional[Dict] = None) -> List[Dict]:
        """Search for similar vectors"""
        raise NotImplementedError
    
    def save(self, index_name: str):
        """Save index to disk"""
        raise NotImplementedError
    
    def load(self, index_name: str):
        """Load index from disk"""
        raise NotImplementedError

class FAISSStore(VectorStore):
    """FAISS vector store implementation"""
    
    def __init__(self):
        super().__init__("faiss")
        self.ids = []
    
    def create_index(self, dimension: int = 768):
        """Create FAISS index - SIMPLE VERSION for Windows compatibility"""
        self.dimension = dimension
        # ⭐⭐ FIX: Use IndexFlatIP (not IndexIDMap) for Windows compatibility
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        self.metadata = {}
        self.ids = []
        logger.info(f"Created FAISS index with dimension {dimension}")
    
    def add_vectors(self, vectors: np.ndarray, metadatas: List[Dict]):
        """Add vectors to FAISS index"""
        if self.index is None:
            self.create_index(vectors.shape[1])
        
        # Convert to float32 for FAISS
        vectors_f32 = vectors.astype('float32')
        
        # Add to index
        start_id = len(self.ids)
        
        # ⭐⭐ FIX: Direct add for Windows compatibility
        if self.index.ntotal == 0:
            self.index.add(vectors_f32)
        else:
            # For additional vectors
            self.index.add(vectors_f32)
        
        # Store metadata
        for i, metadata in enumerate(metadatas):
            vector_id = start_id + i
            self.ids.append(vector_id)
            self.metadata[vector_id] = metadata
    
    def search(self, query_vector: np.ndarray, k: int = 5, filter_dict: Optional[Dict] = None) -> List[Dict]:
        """Search in FAISS index"""
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # Convert query to float32
        query_f32 = query_vector.astype('float32').reshape(1, -1)
        
        # Search
        distances, indices = self.index.search(query_f32, min(k, self.index.ntotal))
        
        results = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx >= 0 and idx in self.metadata:
                metadata = self.metadata[idx]
                results.append({
                    "id": idx,
                    "score": float(distance),
                    "metadata": metadata,
                    "content": metadata.get("content", ""),
                    "statute": metadata.get("statute", ""),
                    "paragraph": metadata.get("paragraph", ""),
                    "document_id": metadata.get("document_id", ""),
                    "is_normative": metadata.get("is_normative", False)
                })
        
        return results
    
    def save(self, index_name: str):
        """Save FAISS index - SIMPLE VERSION for Windows"""
        try:
            save_path = os.path.join(self.indices_dir, f"{index_name}.faiss")
            metadata_path = os.path.join(self.indices_dir, f"{index_name}_meta.pkl")
            
            # ⭐⭐ FIX: Check if index can be saved
            if self.index is None or self.index.ntotal == 0:
                print(f"⚠️ No vectors to save for {index_name}")
                return
            
            # Save FAISS index
            faiss.write_index(self.index, save_path)
            
            # Save metadata
            with open(metadata_path, 'wb') as f:
                pickle.dump({
                    "metadata": self.metadata,
                    "ids": self.ids,
                    "dimension": self.dimension
                }, f)
            
            logger.info(f"Saved FAISS index to {save_path}")
            return True
            
        except Exception as e:
            print(f"⚠️ Could not save FAISS index {index_name}: {e}")
            print("   Using in-memory index only (Windows FAISS limitation)")
            return False
    
    def load(self, index_name: str):
        """Load FAISS index - SIMPLE VERSION for Windows"""
        try:
            save_path = os.path.join(self.indices_dir, f"{index_name}.faiss")
            metadata_path = os.path.join(self.indices_dir, f"{index_name}_meta.pkl")
            
            if not os.path.exists(save_path) or not os.path.exists(metadata_path):
                print(f"ℹ️ No existing index found: {index_name}")
                return False
            
            # Load FAISS index
            self.index = faiss.read_index(save_path)
            
            # Load metadata
            with open(metadata_path, 'rb') as f:
                data = pickle.load(f)
                self.metadata = data["metadata"]
                self.ids = data["ids"]
                self.dimension = data["dimension"]
            
            logger.info(f"Loaded FAISS index from {save_path}")
            return True
            
        except Exception as e:
            print(f"⚠️ Could not load FAISS index {index_name}: {e}")
            print("   Creating new index instead")
            return False

class RetrievalService:
    """Main retrieval service with Authority-Contracted Retrieval"""
    
    def __init__(self, vector_store_type: str = "faiss"):
        self.vector_store_type = vector_store_type
        self.vector_store = self._create_vector_store(vector_store_type)
        self.statute_indices = {}  # Separate indices per statute
        self.validator = StatuteFirstValidator()
        
        # ===========================================================================
        # FIX: LAZY LOADING FOR AUTHORITY SERVICES (NO IMMEDIATE IMPORTS)
        # ===========================================================================
        self.authority_resolver = None
        self.source_authority_resolver = None
        self.authority_available = False
        print("⚖️  Authority services: Will load on-demand (fixes import timing)")
        
        # Don't auto-load on Windows, create test indices instead
        self._initialize_indices()
        
        logger.info(f"RetrievalService initialized with {vector_store_type}")
    
    def _load_authority_services(self):
        """
        Lazily load authority services when first needed
        This fixes the import timing issue
        """
        if self.authority_available:
            return True
            
        try:
            from app.services import resolve_authority, source_authority_resolver
            self.authority_resolver = resolve_authority
            self.source_authority_resolver = source_authority_resolver
            self.authority_available = True
            print("✅ Authority services loaded for retrieval contract")
            return True
        except ImportError as e:
            print(f"⚠️  Authority services not available: {e}")
            self.authority_available = False
            return False
    
    def _initialize_indices(self):
        """Initialize indices - simplified for Windows"""
        print("\n🔍 Initializing indices...")
        
        # Check if indices directory exists
        indices_dir = os.getenv("INDICES_DIR", "./data/indices")
        if not os.path.exists(indices_dir):
            print(f"📁 Creating indices directory: {indices_dir}")
            os.makedirs(indices_dir, exist_ok=True)
        
        # Create test indices (don't try to save on Windows initially)
        self.create_test_indices(save_to_disk=False)
    
    def _create_vector_store(self, store_type: str) -> VectorStore:
        """Create vector store instance"""
        if store_type == "faiss":
            return FAISSStore()
        elif store_type == "chroma":
            # ChromaDB implementation
            raise NotImplementedError("ChromaDB not implemented yet")
        elif store_type == "qdrant":
            # If you need Qdrant, install: pip install qdrant-client
            # Then uncomment and fix these imports:
            # from qdrant_client import QdrantClient
            # from qdrant_client.models import Distance, VectorParams
            raise NotImplementedError("Qdrant not implemented yet. Install qdrant-client package.")
        else:
            raise ValueError(f"Unknown vector store type: {store_type}")
    
    def create_test_indices(self, save_to_disk: bool = True):
        """Create test indices for debugging"""
        print("\n🔨 Creating test indices...")
        
        # Test documents for StGB (real German law content)
        test_documents = [
            {
                "id": "test_stgb_242",
                "content": "§ 242 StGB - Theft: Whoever takes movable property belonging to another with the intent of unlawfully appropriating it for himself or a third person shall be punished with imprisonment not exceeding five years or a fine.",
                "filename": "StGB_English.pdf",
                "statute": "StGB",
                "paragraph": "242",
                "is_normative": True,
                "authority_score": 1.0,  # Highest authority
                "document_type": "statutory"
            },
            {
                "id": "test_stgb_243",
                "content": "§ 243 StGB - Aggravated theft: Particularly serious cases include theft with weapons, burglary, or theft from protected areas.",
                "filename": "StGB_English.pdf", 
                "statute": "StGB",
                "paragraph": "243",
                "is_normative": True,
                "authority_score": 1.0,
                "document_type": "statutory"
            },
            {
                "id": "test_bgb_433",
                "content": "§ 433 BGB - Basic obligation under contract of sale: By the contract of sale the seller of a thing is obliged to deliver the thing to the buyer and to transfer ownership of the thing.",
                "filename": "BGB_English.pdf",
                "statute": "BGB",
                "paragraph": "433",
                "is_normative": True,
                "authority_score": 1.0,
                "document_type": "statutory"
            },
            {
                "id": "test_bgb_434",
                "content": "§ 434 BGB - Material defects: The thing is free from material defects if, at the time when the risk passes, it has the agreed quality.",
                "filename": "BGB_English.pdf",
                "statute": "BGB",
                "paragraph": "434",
                "is_normative": True,
                "authority_score": 1.0,
                "document_type": "statutory"
            },
            {
                "id": "test_bgb_311",
                "content": "§ 311 BGB - Obligations from contracts and similar legal transactions: To create an obligation by legal transaction and to alter the contents of an obligation, a contract between the parties is necessary, unless otherwise provided by statute.",
                "filename": "BGB_English.pdf",
                "statute": "BGB",
                "paragraph": "311",
                "is_normative": True,
                "authority_score": 1.0,
                "document_type": "statutory"
            },
            {
                "id": "test_bgb_823",
                "content": "§ 823 BGB - Duty to compensate for damage: A person who, intentionally or negligently, unlawfully injures the life, body, health, freedom, property or another right of another person is liable to compensate the other party for the damage arising therefrom.",
                "filename": "BGB_English.pdf",
                "statute": "BGB",
                "paragraph": "823",
                "is_normative": True,
                "authority_score": 1.0,
                "document_type": "statutory"
            },
            # Add some non-statutory documents to test authority filtering
            {
                "id": "test_commentary_1",
                "content": "Academic commentary on theft law: Some scholars argue that the definition of movable property should be expanded in the digital age.",
                "filename": "academic_commentary.pdf",
                "statute": "StGB",
                "paragraph": "",
                "is_normative": False,
                "authority_score": 0.3,
                "document_type": "academic"
            },
            {
                "id": "test_case_1",
                "content": "Court decision BGH 5 StR 320/19: The court interpreted § 242 StGB regarding digital assets.",
                "filename": "case_law.pdf",
                "statute": "StGB",
                "paragraph": "",
                "is_normative": False,
                "authority_score": 0.8,
                "document_type": "case_law"
            }
        ]
        
        # Group by statute
        by_statute = {}
        for doc in test_documents:
            statute = doc.get("statute")
            if statute not in by_statute:
                by_statute[statute] = []
            by_statute[statute].append(doc)
        
        # Index each statute
        for statute, docs in by_statute.items():
            print(f"📚 Indexing {len(docs)} test documents for {statute}")
            self.index_documents(docs, statute)
        
        # Only save to disk if requested
        if save_to_disk:
            try:
                self.save_indices("legal_index")
                print("✅ Test indices created and saved!")
            except Exception as e:
                print(f"⚠️ Could not save indices to disk: {e}")
                print("   Using in-memory indices only")
        else:
            print("✅ Test indices created in memory!")
    
    def index_documents(self, documents: List[Dict], statute: Optional[str] = None, 
                       embeddings: Optional[np.ndarray] = None):
        """
        Index documents with embeddings - STATUTE-FIRST VERSION
        """
        if not documents:
            return
        
        print(f"📝 Indexing {len(documents)} documents for {statute or 'general'}")
        
        # PARAGRAPH EXTRACTION FOR STATUTES
        if statute and statute.upper() in ["STGB", "BGB"]:
            # Extract structured norms from statute text
            all_norms = []
            for doc in documents:
                content = doc.get("content", "")
                if statute.upper() == "STGB":
                    norms = StatuteFirstIndexer.extract_stgb_paragraphs(content, statute)
                elif statute.upper() == "BGB":
                    norms = StatuteFirstIndexer.extract_bgb_paragraphs(content, statute)
                else:
                    norms = []
                
                if norms:
                    all_norms.extend(norms)
            
            if all_norms:
                # Use the extracted norms instead of raw chunks
                documents = all_norms
                print(f"📖 Extracted {len(all_norms)} legal norms from {statute}")
        
        # Prepare metadata - NOW WITH PARAGRAPH IDENTITY
        metadatas = []
        for doc in documents:
            # Check if this is already a structured norm
            paragraph = doc.get("paragraph", "")
            
            metadata = {
                "content": doc.get("content", ""),
                "document_id": doc.get("id", ""),
                "filename": doc.get("filename", ""),
                "statute": statute or doc.get("statute", ""),
                # CRITICAL: Store paragraph identity
                "paragraph": paragraph,
                # Determine if this is a true legal norm
                "is_normative": doc.get("is_normative", bool(paragraph)),
                "norm_type": doc.get("norm_type", ""),
                "authority_level": doc.get("authority_level", "unknown"),
                "authority_score": doc.get("authority_score", 1.0 if bool(paragraph) else 0.5),
                "document_type": doc.get("document_type", "statutory" if bool(paragraph) else "other"),
                "chunk_index": doc.get("chunk_index", 0),
                "page": doc.get("page", 0),
                # FIX: Use correct paragraph symbol
                "has_paragraph": "§" in doc.get("content", "") or bool(paragraph),
                "has_article": "Artikel" in doc.get("content", "") or 
                              "article" in doc.get("content", "").lower(),
                "timestamp": datetime.now().isoformat()
            }
            metadatas.append(metadata)
        
        # Use provided embeddings or generate them
        if embeddings is None:
            from app.services.embedding_service import embedding_service
            texts = [doc.get("content", "") for doc in documents]
            embeddings = np.array(embedding_service.embed_batch(texts))
            print(f"🔧 Generated embeddings: {embeddings.shape}")
        
        # Index by statute if specified
        if statute and statute not in self.statute_indices:
            self.statute_indices[statute] = self._create_vector_store(self.vector_store_type)
            self.statute_indices[statute].create_index(embeddings.shape[1])
        
        if statute:
            self.statute_indices[statute].add_vectors(embeddings, metadatas)
            print(f"✅ Indexed {len(documents)} normative documents for statute {statute}")
        else:
            self.vector_store.add_vectors(embeddings, metadatas)
            print(f"✅ Indexed {len(documents)} documents in general index")
    
    # ===========================================================================
    # AUTHORITY-DRIVEN RETRIEVAL CONTRACT METHODS
    # ===========================================================================
    
    def resolve_authority_and_retrieve(self, query: str, question_type: str = "GENERAL",
                                       available_documents: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        ENFORCE AUTHORITY → RETRIEVAL CONTRACT:
        1. First resolve legal authority (statute, paragraph)
        2. Apply source authority filtering
        3. Retrieve only authorized documents
        4. Rank by authority × similarity
        """
        print(f"\n⚖️  AUTHORITY-CONTRACTED RETRIEVAL for: '{query[:50]}...'")
        
        # ===========================================================================
        # FIX: LAZY LOAD AUTHORITY SERVICES HERE (IMPORT TIMING FIX)
        # ===========================================================================
        if not self.authority_available:
            if not self._load_authority_services():
                print("⚠️  Authority services not available - falling back to basic retrieval")
                return self._fallback_retrieval(query)
        
        # STEP 1: Resolve legal authority
        authority_result = self.authority_resolver(query)
        print(f"   Legal Authority Result: {authority_result}")
        
        if authority_result.get("requiresClarification"):
            return {
                "requires_clarification": True,
                "clarification": authority_result.get("clarification"),
                "statute": authority_result.get("statute"),
                "results": [],
                "authority_validation": {
                    "status": "requires_clarification",
                    "message": "Statute needs clarification before retrieval"
                }
            }
        
        statute = authority_result.get("statute")
        if not statute:
            return {
                "requires_clarification": True,
                "clarification": {
                    "english": "Could not identify applicable statute. Please specify which law you're asking about (e.g., StGB, BGB, GDPR).",
                    "german": "Anwendbare Rechtsnorm konnte nicht identifiziert werden. Bitte spezifizieren Sie, welches Gesetz Sie meinen (z.B. StGB, BGB, GDPR)."
                },
                "results": [],
                "authority_validation": {"status": "no_statute"}
            }
        
        # STEP 2: Apply source authority filtering if documents provided
        allowed_documents = []
        if available_documents:
            try:
                # Use source authority to filter documents
                source_auth_result = self.source_authority_resolver.resolve(
                    question=query,
                    statute=statute,
                    question_type=question_type,
                    all_documents=available_documents
                )
                allowed_documents = source_auth_result.get("allowed_documents", [])
                print(f"   Source Authority: Allowed {len(allowed_documents)}/{len(available_documents)} documents")
            except Exception as e:
                print(f"⚠️  Source authority filtering failed: {e}")
                allowed_documents = available_documents  # Fallback to all
        
        # STEP 3: Retrieve with statute lock
        from app.services.embedding_service import embedding_service
        query_embedding = np.array(embedding_service.embed(query))
        
        # First: Try to find exact paragraph matches
        paragraph = authority_result.get("paragraph")
        if paragraph:
            paragraph_results = self.search_by_paragraph(
                statute=statute,
                paragraph=paragraph,
                query_embedding=query_embedding,
                k=10
            )
        else:
            paragraph_results = []
        
        # Second: Get general statute results
        general_results = self.search(
            query_embedding=query_embedding,
            statute=statute,
            k=10
        )
        
        # STEP 4: Combine and apply authority filtering
        all_results = paragraph_results + general_results
        
        # Filter by source authority if applicable
        if allowed_documents:
            allowed_ids = {doc.get("id", "") for doc in allowed_documents}
            filtered_results = []
            for result in all_results:
                doc_id = result.get("metadata", {}).get("document_id", "")
                if not doc_id or doc_id in allowed_ids:
                    filtered_results.append(result)
            all_results = filtered_results
        
        # STEP 5: Apply authority scoring
        authority_enhanced_results = []
        for result in all_results:
            authority_score = self._calculate_authority_score(result, statute)
            similarity_score = result.get("score", 0.0)
            
            # Combined score: authority × similarity (authority prioritized)
            combined_score = authority_score * (0.6 + 0.4 * similarity_score)
            
            enhanced_result = {
                **result,
                "authority_score": authority_score,
                "combined_score": combined_score,
                "is_statutory": result.get("metadata", {}).get("is_normative", False),
                "document_type": result.get("metadata", {}).get("document_type", "unknown")
            }
            authority_enhanced_results.append(enhanced_result)
        
        # Sort by combined score (authority-weighted)
        authority_enhanced_results.sort(key=lambda x: x["combined_score"], reverse=True)
        
        # STEP 6: Validation
        validation_stats = self._validate_authority_results(
            authority_enhanced_results, 
            statute, 
            paragraph
        )
        
        return {
            "results": authority_enhanced_results[:10],
            "authority_metadata": {
                "statute": statute,
                "paragraph": paragraph,
                "paragraph_source": authority_result.get("paragraph_source", "explicit"),
                "confidence": authority_result.get("confidence", 1.0),
                "question_type": question_type,
                "total_documents_considered": len(all_results),
                "authority_filtered_count": len(authority_enhanced_results)
            },
            "authority_validation": validation_stats,
            "requires_clarification": False
        }
    
    def _calculate_authority_score(self, result: Dict, target_statute: str) -> float:
        """Calculate authority score based on document type and statute match"""
        metadata = result.get("metadata", {})
        
        base_score = metadata.get("authority_score", 0.5)
        is_normative = metadata.get("is_normative", False)
        statute_match = metadata.get("statute", "") == target_statute
        doc_type = metadata.get("document_type", "other")
        
        # Authority hierarchy
        if is_normative and statute_match:
            return 1.0  # Perfect match: statutory norm
        elif doc_type == "case_law" and statute_match:
            return 0.8  # Case law on point
        elif doc_type == "academic" and statute_match:
            return 0.5  # Academic commentary
        elif statute_match:
            return 0.7  # Other relevant documents
        else:
            return 0.3  # Wrong statute
    
    def _validate_authority_results(self, results: List[Dict], statute: str, paragraph: Optional[str]) -> Dict:
        """Validate that results meet authority requirements"""
        if not results:
            return {
                "status": "no_results",
                "message": "No documents found for the specified statute",
                "statute_compliance": 0.0,
                "has_statutory_norms": False
            }
        
        statutory_count = sum(1 for r in results if r.get("is_statutory", False))
        statute_compliance = sum(1 for r in results if r.get("metadata", {}).get("statute") == statute) / len(results)
        
        validation = {
            "status": "valid" if statute_compliance > 0.7 else "partial",
            "message": f"Found {statutory_count} statutory norms among {len(results)} results",
            "statute_compliance": statute_compliance,
            "has_statutory_norms": statutory_count > 0,
            "statutory_count": statutory_count,
            "total_results": len(results)
        }
        
        if paragraph:
            paragraph_found = any(
                f"§{paragraph}" in r.get("content", "") or 
                r.get("metadata", {}).get("paragraph") == paragraph 
                for r in results
            )
            validation["paragraph_found"] = paragraph_found
        
        return validation
    
    def _fallback_retrieval(self, query: str) -> Dict:
        """Fallback when authority services are unavailable"""
        from app.services.embedding_service import embedding_service
        query_embedding = np.array(embedding_service.embed(query))
        
        results = self.search(query_embedding, k=10)
        
        return {
            "results": results,
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "warning": "Authority services not available - using statute-unaware retrieval"
            },
            "authority_validation": {
                "status": "fallback",
                "message": "Authority contract not enforced"
            },
            "requires_clarification": False
        }
    
    # ===========================================================================
    # EXISTING METHODS (slightly modified for authority integration)
    # ===========================================================================
    
    def search_by_paragraph(self, statute: str, paragraph: str, 
                           query_embedding: Optional[np.ndarray] = None,
                           k: int = 5, paragraphSource: str = "explicit") -> List[Dict]:
        """
        Statute-First search: Find specific paragraph with authority guarantee
        Now includes paragraphSource parameter for confidence adjustment
        """
        if statute not in self.statute_indices:
            print(f"⚠️ No index found for statute: {statute}")
            return []
        
        # First: Try exact paragraph match (AUTHORITY SEARCH)
        all_metadata = list(self.statute_indices[statute].metadata.values())
        exact_matches = []
        
        for meta in all_metadata:
            if meta.get("paragraph") == paragraph and meta.get("statute") == statute:
                # This is the authoritative norm
                result = {
                    "id": -1,  # Special ID for authority match
                    "score": 1.0,  # Maximum confidence
                    "metadata": meta,
                    "content": meta.get("content", ""),
                    "statute": statute,
                    "paragraph": paragraph,
                    "document_id": meta.get("document_id", ""),
                    "is_authoritative": True,
                    "match_type": "exact_paragraph",
                    "legal_relevance": 1.0,
                    "confidence": 1.0,
                    "authority_score": 1.0
                }
                
                # CRITICAL SAFETY ADJUSTMENT: Down-weight inferred paragraphs
                if paragraphSource == "inferred":
                    result["confidence"] = 0.85
                    result["authority_note"] = "paragraph inferred, not explicitly cited"
                    result["legal_relevance"] = 0.85
                    result["authority_score"] = 0.85
                    print(f"⚠️ Down-weighted confidence for inferred paragraph: {statute} §{paragraph}")
                
                exact_matches.append(result)
        
        if exact_matches:
            print(f"✅ Found authoritative match for {statute} §{paragraph}")
            return exact_matches[:k]
        
        # Second: Fall back to semantic search if no exact match
        if query_embedding is not None:
            semantic_results = self.statute_indices[statute].search(query_embedding, k)
            
            # Enhance results with paragraph awareness
            for result in semantic_results:
                result["is_authoritative"] = False
                result["match_type"] = "semantic"
                result["legal_relevance"] = self._calculate_legal_relevance(result)
                result["confidence"] = result["score"]
                result["authority_score"] = self._calculate_authority_score(result, statute)
                
                # Apply paragraph source adjustment
                if paragraphSource == "inferred":
                    result["confidence"] = min(result["confidence"] * 0.85, 0.95)
                    result["authority_note"] = "search based on inferred paragraph"
                
                # Check if result contains the requested paragraph
                content = result.get("content", "")
                if f"§{paragraph}" in content or f"§ {paragraph}" in content:
                    result["is_authoritative"] = True
                    result["match_type"] = "paragraph_in_content"
                    result["score"] = max(result["score"], 0.9)  # Boost
                    result["legal_relevance"] = min(result["legal_relevance"] * 1.3, 1.0)
                    result["confidence"] = max(result["confidence"], 0.9)
                    result["authority_score"] = max(result["authority_score"], 0.9)
            
            return semantic_results[:k]
        
        return []
    
    def search_with_validation(self, query: str, statute: str, paragraph: str, 
                              k: int = 10, paragraphSource: str = "explicit") -> Dict:
        """
        Complete Statute-First search with validation
        Now includes paragraphSource parameter
        """
        from app.services.embedding_service import embedding_service
        
        # Get query embedding
        query_embedding = np.array(embedding_service.embed(query))
        
        # Search by paragraph first (with source information)
        paragraph_results = self.search_by_paragraph(statute, paragraph, query_embedding, k, paragraphSource)
        
        # If no paragraph results, fall back to general search
        if not paragraph_results:
            general_results = self.search(query_embedding, statute, k)
            paragraph_results = general_results
        
        # Validate results
        validation_results = []
        
        for result in paragraph_results:
            content = result.get("content", "")
            validation = self.validator.validate_response(content, statute, paragraph)
            
            # Adjust validation based on paragraph source
            if paragraphSource == "inferred":
                validation["security_score"] = max(validation["security_score"] - 15, 0)
                if not validation.get("issues"):
                    validation["issues"] = []
                validation["issues"].append("Paragraph was inferred from context")
            
            result["validation"] = validation
            validation_results.append(validation)
        
        # Determine overall validation
        overall_validation = {
            "statute": statute,
            "paragraph": paragraph,
            "paragraph_source": paragraphSource,
            "total_results": len(paragraph_results),
            "authoritative_results": sum(1 for r in paragraph_results 
                                       if r.get("is_authoritative", False)),
            "inferred_paragraph": paragraphSource == "inferred",
            "validation_summary": {
                "valid_count": sum(1 for v in validation_results if v["is_valid"]),
                "avg_security_score": np.mean([v["security_score"] for v in validation_results]) 
                                   if validation_results else 0
            }
        }
        
        return {
            "results": paragraph_results[:k],
            "validation": overall_validation,
            "query_info": {
                "statute": statute,
                "paragraph": paragraph,
                "paragraph_source": paragraphSource,
                "query": query
            }
        }
    
    def search(self, query_embedding: np.ndarray, statute: Optional[str] = None,
               k: int = 10, filters: Optional[Dict] = None) -> List[Dict]:
        """
        Search for similar documents
        """
        # Check if indices are empty
        if self.vector_store.index is None or self.vector_store.index.ntotal == 0:
            print(f"⚠️ Warning: Vector index is empty. Creating test indices...")
            self.create_test_indices(save_to_disk=False)
            if self.vector_store.index is None or self.vector_store.index.ntotal == 0:
                return []
        
        results = []
        
        # Search in statute-specific index if available
        if statute and statute in self.statute_indices:
            statute_results = self.statute_indices[statute].search(query_embedding, k, filters)
            results.extend(statute_results)
            logger.debug(f"Found {len(statute_results)} results in statute index {statute}")
        
        # Also search in general index
        general_results = self.vector_store.search(query_embedding, k, filters)
        
        # Filter out duplicates
        seen_ids = set(r["id"] for r in results)
        for result in general_results:
            if result["id"] not in seen_ids:
                results.append(result)
                seen_ids.add(result["id"])
        
        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Apply post-filtering if needed
        if filters:
            filtered_results = []
            for result in results:
                metadata = result["metadata"]
                match = True
                for key, value in filters.items():
                    if metadata.get(key) != value:
                        match = False
                        break
                if match:
                    filtered_results.append(result)
            results = filtered_results[:k]
        else:
            results = results[:k]
        
        # Enhance results with legal relevance scoring
        for result in results:
            result["legal_relevance"] = self._calculate_legal_relevance(result)
            result["is_authoritative"] = result.get("is_authoritative", False)
            result["match_type"] = result.get("match_type", "semantic")
            result["confidence"] = result.get("score", 0.0)
            # Add authority score if statute is specified
            if statute:
                result["authority_score"] = self._calculate_authority_score(result, statute)
        
        return results
    
    def _calculate_legal_relevance(self, result: Dict) -> float:
        """Calculate legal relevance score"""
        score = result["score"]
        metadata = result["metadata"]
        
        # CRITICAL FIX: Use boolean paragraph presence, not similarity
        is_normative = metadata.get("is_normative", False)
        has_paragraph = metadata.get("has_paragraph", False)
        
        if is_normative:
            score *= 1.5  # Major boost for actual norms
        elif has_paragraph:
            score *= 1.2  # Moderate boost for paragraph citations
        
        # Boost for statute match
        if metadata.get("statute"):
            score *= 1.05
        
        # Penalize very short content
        content = metadata.get("content", "")
        if len(content.split()) < 10:
            score *= 0.8
        
        return min(score, 1.0)  # Cap at 1.0
    
    def save_indices(self, base_name: str = "legal_index"):
        """Save all indices to disk"""
        # Save general index
        success = self.vector_store.save(base_name)
        
        # Save statute indices
        for statute, index in self.statute_indices.items():
            index.save(f"{base_name}_{statute}")
        
        if success:
            print(f"💾 Saved indices with base name: {base_name}")
        else:
            print(f"⚠️ Could not save indices to disk (Windows FAISS limitation)")
    
    def load_indices(self, base_name: str = "legal_index") -> bool:
        """Load indices from disk"""
        success = self.vector_store.load(base_name)
        
        # Try to load statute indices
        statute_files = [f for f in os.listdir(self.vector_store.indices_dir) 
                        if f.startswith(f"{base_name}_") and f.endswith(".faiss")]
        
        for file in statute_files:
            statute = file.replace(f"{base_name}_", "").replace(".faiss", "")
            if statute:
                store = self._create_vector_store(self.vector_store_type)
                if store.load(f"{base_name}_{statute}"):
                    self.statute_indices[statute] = store
        
        logger.info(f"Loaded {len(self.statute_indices)} statute indices")
        return success
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retrieval service statistics"""
        stats = {
            "vector_store_type": self.vector_store_type,
            "general_index": {
                "vectors": self.vector_store.index.ntotal if self.vector_store.index else 0,
                "dimension": self.vector_store.dimension if self.vector_store.index else 0
            },
            "statute_indices": {}
        }
        
        for statute, store in self.statute_indices.items():
            stats["statute_indices"][statute] = {
                "vectors": store.index.ntotal if store.index else 0,
                "dimension": store.dimension if store.index else 0
            }
        
        return stats

# Singleton instance
retrieval_service = RetrievalService()