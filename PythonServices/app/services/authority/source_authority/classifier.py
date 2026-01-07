"""
Document classifier - Classifies legal documents by authority type.
"""
import re
from typing import Dict, Any, Optional

class DocumentClassifier:
    """Classifies legal documents based on content and metadata."""
    
    def __init__(self):
        self.boilerplate_markers = [
            'Copyright', '©', 'All rights reserved',
            'Translated by', 'Übersetzt von', 'Translation provided by',
            'This is a translation', 'Dies ist eine Übersetzung',
            'Stand:', 'As of:', 'Version:', 'Last updated:',
            'Zuletzt aktualisiert:', 'Ein Service des Bundesministerium',
            'Service provided by', 'reproduced', 'PDF generated',
            'Samson Übersetzungen', 'Dr. Carmen', 'Michael Bohlander'
        ]
        
        self.official_sources = [
            'Federal Ministry of Justice',
            'Bundesministerium der Justiz',
            'Official translation',
            'Translation provided by',
            'Translated by the Federal Ministry'
        ]
        
        self.registry_markers = [
            'register notices', 'Commercial Register', 'Handelsregister',
            'Amtsgericht', 'HRB', 'HRA', 'Company registration',
            'Samson Übersetzungen', 'Dr. Carmen', 'Michael Bohlander',
            'Vollständige Überarbeitung', 'laufende Aktualisierung',
            'Eintragungen im Handelsregister'
        ]
    
    def classify_document(self, doc: Dict[str, Any], statute: str) -> Dict[str, Any]:
        """Classify a single document."""
        metadata = doc.get('metadata', {})
        content = doc.get('content', '')
        filename = doc.get('filename', '')
        
        # Determine source type
        source_type, classification_reason = self._determine_source_type(
            metadata, content, filename, statute
        )
        
        # Get authority rank
        authority_rank = self._get_authority_rank(source_type)
        
        # Analyze content
        has_normative = self.has_normative_content(content)
        paragraph_count = self.count_paragraphs(content)
        article_count = self.count_articles(content)
        language = self.detect_language(content)
        
        # Update document with authority metadata
        doc['authority_metadata'] = {
            'source_type': source_type,
            'authority_rank': authority_rank,
            'is_authoritative': authority_rank <= 5,
            'classification_reason': classification_reason,
            'language': metadata.get('language') or language,
            'has_normative_content': has_normative,
            'paragraph_count': paragraph_count,
            'article_count': article_count,
            'word_count': len(content.split())
        }
        
        return doc
    
    def _determine_source_type(self, metadata: Dict[str, Any], content: str,
                              filename: str, statute: str) -> tuple:
        """Determine the source type of a document."""
        # Check for official German statute
        if self._is_official_german_statute(metadata, content, filename):
            return 'official_statute_de', f'Official German {statute} text'
        
        # Check for official English translation
        if self._is_official_english_translation(metadata, content):
            return 'official_statute_en', f'Official English translation of {statute}'
        
        # Check for EU GDPR (English first)
        if statute == 'EU-GDPR' and self._is_official_eu_english(metadata, content):
            return 'official_eu_en', 'Official EU GDPR text (English)'
        
        # Check for consolidated translation
        if self._is_consolidated_translation(metadata, content):
            return 'consolidated_translation', f'Consolidated translation of {statute}'
        
        # Check for doctrine/commentary
        if self._is_doctrinal_commentary(metadata, content):
            return 'doctrine_commentary', f'Legal commentary on {statute}'
        
        # Check for registry boilerplate
        if self._is_registry_boilerplate(metadata, content):
            return 'registry_boilerplate', 'Commercial register notice or boilerplate'
        
        # Check for unofficial translation
        if self._is_unofficial_translation(metadata, content):
            return 'unofficial_translation', f'Unofficial translation of {statute}'
        
        return 'unknown', 'Could not determine source type'
    
    def _is_official_german_statute(self, metadata: Dict[str, Any], 
                                   content: str, filename: str) -> bool:
        """Check if document is an official German statute."""
        has_official_markers = any([
            'Bundesgesetzblatt' in content,
            'BGBl.' in content,
            'Vom' in content,
            'Der Bundestag hat das folgende Gesetz beschlossen' in content,
            '(StGB)' in content,
            '(BGB)' in content,
            '(HGB)' in content,
            '(GG)' in content
        ])
        
        is_german = any([
            metadata.get('language') == 'de',
            '§' in content,
            'Absatz' in content,
            'Artikel' in content
        ])
        
        not_translation = not any([
            'Translation' in content,
            'Übersetzung' in content,
            'translated by' in content.lower(),
            'übersetzt von' in content.lower()
        ])
        
        return has_official_markers and is_german and not_translation
    
    def _is_official_english_translation(self, metadata: Dict[str, Any], 
                                        content: str) -> bool:
        """Check if document is an official English translation."""
        for source in self.official_sources:
            if source in content or (metadata.get('source') and 
                                    source in metadata['source']):
                return True
        return False
    
    def _is_official_eu_english(self, metadata: Dict[str, Any], 
                               content: str) -> bool:
        """Check if document is official EU English text."""
        return any([
            'REGULATION (EU) 2016/679' in content,
            'Official Journal of the European Union' in content,
            'L 119/1' in content,
            'THE EUROPEAN PARLIAMENT AND THE COUNCIL OF THE EUROPEAN UNION' in content
        ])
    
    def _is_consolidated_translation(self, metadata: Dict[str, Any], 
                                    content: str) -> bool:
        """Check if document is a consolidated translation."""
        return any([
            'consolidated version' in content,
            'Consolidated text' in content,
            'consolidated translation' in content,
            (metadata.get('version') and 'consolidated' in metadata['version'])
        ])
    
    def _is_doctrinal_commentary(self, metadata: Dict[str, Any], 
                                content: str) -> bool:
        """Check if document is a doctrinal commentary."""
        doctrinal_terms = [
            'commentary', 'Kommentar', 'doctrine', 'Dogmatik', 
            'Rechtslehre', 'interpretation', 'Erläuterung'
        ]
        
        if any(term in content.lower() for term in doctrinal_terms):
            return True
        
        doc_type = metadata.get('documentType')
        if doc_type and any(term in doc_type.lower() for term in doctrinal_terms):
            return True
        
        return False
    
    def _is_registry_boilerplate(self, metadata: Dict[str, Any], 
                                content: str) -> bool:
        """Check if document is registry boilerplate (HGB-specific)."""
        content_lower = content.lower()
        return any(marker.lower() in content_lower 
                  for marker in self.registry_markers)
    
    def _is_unofficial_translation(self, metadata: Dict[str, Any], 
                                  content: str) -> bool:
        """Check if document is an unofficial translation."""
        has_translation = ('translation' in content.lower() or 
                          'übersetzt' in content.lower())
        not_official = not self._is_official_english_translation(metadata, content)
        not_consolidated = not self._is_consolidated_translation(metadata, content)
        
        return has_translation and not_official and not_consolidated
    
    def _get_authority_rank(self, source_type: str) -> int:
        """Get authority rank for source type."""
        authority_ranks = {
            'official_statute_de': 1,
            'official_statute_en': 2,
            'official_eu_en': 1,
            'official_eu_de': 2,
            'consolidated_translation': 3,
            'annotated_version': 4,
            'doctrine_commentary': 5,
            'unofficial_translation': 6,
            'summary_explanation': 7,
            'registry_boilerplate': 99,
            'metadata_only': 98,
            'unknown': 100
        }
        return authority_ranks.get(source_type, 100)
    
    def has_normative_content(self, content: str) -> bool:
        """Check if content has normative legal language."""
        if not content:
            return False
        
        normative_patterns = [
            r'§\s*\d+',
            r'(?:Artikel|Art\.|Article)\s*\d+',
            r'(?:ist|sind|hat|haben|gilt|gelten|muss|müssen|darf|dürfen|kann|können|soll|sollen)\s+[A-Z]',
            r'(?:bestimmt|regelt|vorsieht|sieht vor|legt fest)',
            r'(?:Ansprüche|Pflichten|Rechte|Verpflichtung|Haftung|Schaden)'
        ]
        
        return any(re.search(pattern, content, re.I) for pattern in normative_patterns)
    
    def count_paragraphs(self, content: str) -> int:
        """Count paragraph references in content."""
        if not content:
            return 0
        matches = re.findall(r'§\s*\d+', content)
        return len(matches)
    
    def count_articles(self, content: str) -> int:
        """Count article references in content."""
        if not content:
            return 0
        matches = re.findall(r'(?:Artikel|Art\.|Article)\s*\d+', content, re.I)
        return len(matches)
    
    def detect_language(self, content: str) -> str:
        """Detect language of content."""
        if not content:
            return 'unknown'
        
        sample = content[:1000].lower()
        
        german_indicators = ['der', 'die', 'das', 'und', 'für', 'mit', 'von', 'zu', 'auf', 'ist']
        english_indicators = ['the', 'and', 'for', 'with', 'from', 'to', 'in', 'of', 'on', 'is']
        
        de_count = sum(len(re.findall(rf'\b{word}\b', sample, re.I)) 
                      for word in german_indicators)
        en_count = sum(len(re.findall(rf'\b{word}\b', sample, re.I)) 
                      for word in english_indicators)
        
        return 'de' if de_count > en_count else 'en'
    
    def is_boilerplate_chunk(self, content: str) -> bool:
        """Check if chunk is boilerplate text."""
        content_lower = content.lower()
        return any(marker.lower() in content_lower 
                  for marker in self.boilerplate_markers)
    
    def infer_statute_from_content(self, content: str) -> Optional[str]:
        """Infer statute from content."""
        lower_content = content.lower()
        if 'strafgesetzbuch' in lower_content or 'stgb' in lower_content:
            return 'StGB'
        if 'bürgerliches gesetzbuch' in lower_content or 'bgb' in lower_content:
            return 'BGB'
        if 'handelsgesetzbuch' in lower_content or 'hgb' in lower_content:
            return 'HGB'
        if 'grundgesetz' in lower_content or 'gg' in lower_content:
            return 'GG'
        if 'datenschutz-grundverordnung' in lower_content or 'gdpr' in lower_content or 'dsgvo' in lower_content:
            return 'EU-GDPR'
        return None