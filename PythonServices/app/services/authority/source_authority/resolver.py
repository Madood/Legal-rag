"""
Source Authority Resolver - Determines authority rank of legal documents.
"""
from typing import Dict, List, Any
from datetime import datetime
from .classifier import DocumentClassifier
from .filters import apply_question_type_rules

class SourceAuthorityResolver:
    def __init__(self):
        # Authority hierarchy: 1 = highest authority, 100 = lowest
        self.authority_ranks = {
            # Primary sources
            'official_statute_de': 1,      # Official German statute text
            'official_statute_en': 2,      # Official English translation
            'official_eu_en': 1,           # Official EU English (GDPR)
            'official_eu_de': 2,           # Official EU German
            
            # Secondary sources
            'consolidated_translation': 3,  # Verified consolidated translation
            'annotated_version': 4,         # Statute with annotations
            'doctrine_commentary': 5,       # Legal commentary/doctrine
            
            # Tertiary sources
            'unofficial_translation': 6,    # Unofficial translation
            'summary_explanation': 7,       # Summary or explanation
            
            # Excluded sources
            'registry_boilerplate': 99,     # Commercial register notices
            'metadata_only': 98,            # Metadata without content
            'unknown': 100                  # Unknown source type
        }
        
        # Language priority by statute
        self.language_priority = {
            'BGB': ['de', 'en'],    # German Civil Code: German first
            'StGB': ['de', 'en'],   # German Criminal Code
            'HGB': ['de', 'en'],    # German Commercial Code
            'GG': ['de', 'en'],     # German Basic Law
            'EU-GDPR': ['en', 'de'] # EU Regulation: English first
        }
        
        self.classifier = DocumentClassifier()
        print('✅ SourceAuthorityResolver initialized')
    
    def resolve(self, question: str, statute: str, question_type: str, 
                all_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Main authority resolution method."""
        start_time = datetime.now()
        print(f'\n[Authority] Resolving sources for "{question[:50]}..."')
        print(f'  Statute: {statute}, Question Type: {question_type}')
        
        # Step 1: Filter by statute
        statute_docs = self._filter_by_statute(all_documents, statute)
        print(f'  Found {len(statute_docs)} documents for {statute}')
        
        if len(statute_docs) == 0:
            return self._handle_missing_statute(statute, question_type)
        
        # Step 2: Classify each document
        classified_docs = []
        for doc in statute_docs:
            classified = self.classifier.classify_document(doc, statute)
            classified_docs.append(classified)
        
        # Step 3: Apply question-type specific filtering
        filtered_docs = apply_question_type_rules(
            classified_docs, question_type, statute
        )
        
        # Step 4: Sort by authority rank
        sorted_docs = sorted(filtered_docs, 
                           key=lambda d: d['authority_metadata']['authority_rank'])
        
        end_time = datetime.now()
        
        # Create authority summary
        authority_summary = {
            'statute': statute,
            'question_type': question_type,
            'total_documents': len(statute_docs),
            'authoritative_documents': len([d for d in sorted_docs 
                                          if d['authority_metadata']['is_authoritative']]),
            'excluded_documents': len(statute_docs) - len(sorted_docs),
            'processing_time_ms': int((end_time - start_time).total_seconds() * 1000),
            'primary_source_type': sorted_docs[0]['authority_metadata']['source_type'] 
                                  if sorted_docs else 'none',
            'language_distribution': self._get_language_distribution(sorted_docs),
            'rank_distribution': self._get_rank_distribution(sorted_docs)
        }
        
        print(f'[Authority] Selected {len(sorted_docs)} authoritative sources')
        print(f'  Primary source: {authority_summary["primary_source_type"]}')
        print(f'  Authoritative: {authority_summary["authoritative_documents"]}/' +
              f'{authority_summary["total_documents"]}')
        
        return {
            'allowed_documents': sorted_docs,
            'authority_summary': authority_summary
        }
    
    def classify_chunk(self, content: str, statute: str, 
                      document: Dict[str, Any]) -> Dict[str, Any]:
        """Classify a single chunk of text."""
        # Inherit document's authority
        doc_authority = document.get('authority_metadata', {
            'source_type': 'unknown',
            'authority_rank': 100,
            'is_authoritative': False,
            'classification_reason': 'No document authority metadata'
        })
        
        # Check if this specific chunk has normative content
        has_normative_content = self.classifier.has_normative_content(content)
        paragraph_count = self.classifier.count_paragraphs(content)
        article_count = self.classifier.count_articles(content)
        language = self.classifier.detect_language(content)
        
        # Boost authority if chunk contains legal references
        authority_boost = 0
        if paragraph_count > 0 or article_count > 0:
            authority_boost = -5  # Lower number = higher authority
        
        if has_normative_content:
            authority_boost -= 3
        
        # Language preference based on statute
        preferred_languages = self.language_priority.get(statute, ['de', 'en'])
        language_match = -2 if language in preferred_languages else 0
        
        final_rank = max(1, min(100, 
            doc_authority['authority_rank'] + authority_boost + language_match))
        
        return {
            'authority_metadata': {
                **doc_authority,
                'authority_rank': final_rank,
                'chunk_analysis': {
                    'language': language,
                    'has_legal_references': paragraph_count > 0 or article_count > 0,
                    'has_normative_content': has_normative_content,
                    'paragraph_count': paragraph_count,
                    'article_count': article_count,
                    'word_count': len(content.split()),
                    'is_boilerplate': self.classifier.is_boilerplate_chunk(content)
                }
            }
        }
    
    def _filter_by_statute(self, documents: List[Dict[str, Any]], 
                          statute: str) -> List[Dict[str, Any]]:
        """Filter documents by statute."""
        filtered = []
        for doc in documents:
            doc_statute = (
                doc.get('metadata', {}).get('statute') or
                doc.get('statute') or
                self.classifier.infer_statute_from_content(doc.get('content', ''))
            )
            if doc_statute == statute:
                filtered.append(doc)
        return filtered
    
    def _handle_missing_statute(self, statute: str, question_type: str) -> Dict[str, Any]:
        """Handle case where no documents are found for a statute."""
        return {
            'allowed_documents': [],
            'authority_summary': {
                'statute': statute,
                'question_type': question_type,
                'error': 'NO_AUTHORITATIVE_SOURCES',
                'message': f'No authoritative sources available for {statute}. '
                          f'Please load official {statute} documents.',
                'timestamp': datetime.now().isoformat()
            }
        }
    
    def _get_language_distribution(self, documents: List[Dict[str, Any]]) -> Dict[str, int]:
        """Get language distribution of documents."""
        distribution = {}
        for doc in documents:
            lang = doc.get('authority_metadata', {}).get('language', 'unknown')
            distribution[lang] = distribution.get(lang, 0) + 1
        return distribution
    
    def _get_rank_distribution(self, documents: List[Dict[str, Any]]) -> Dict[int, int]:
        """Get authority rank distribution."""
        distribution = {}
        for doc in documents:
            rank = doc.get('authority_metadata', {}).get('authority_rank', 100)
            distribution[rank] = distribution.get(rank, 0) + 1
        return distribution
    
    def debug_classification(self, documents: List[Dict[str, Any]]):
        """Debug method to show authority classification."""
        print('\n🔍 AUTHORITY CLASSIFICATION DEBUG:')
        print('=' * 80)
        
        for i, doc in enumerate(documents, 1):
            meta = doc.get('authority_metadata', {})
            print(f'{i}. {doc.get("filename", doc.get("id", "unknown"))}')
            print(f'   Source Type: {meta.get("source_type", "unknown")}')
            print(f'   Authority Rank: {meta.get("authority_rank", 100)}')
            print(f'   Authoritative: {"✅" if meta.get("is_authoritative") else "❌"}')
            print(f'   Reason: {meta.get("classification_reason", "Unknown")}')
            print(f'   Language: {meta.get("language", "unknown")}')
            print(f'   Paragraphs: {meta.get("paragraph_count", 0)}, '
                  f'Articles: {meta.get("article_count", 0)}')
            print()