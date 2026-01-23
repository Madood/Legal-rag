"""
Pure text normalization - no legal interpretation.
Direct port of cleanLegalText from Node.js.
"""
import re
import logging
from typing import List, Tuple, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class FormatNormalizer:
    """Normalizes text format - removes boilerplate, standardizes formatting"""
    
    def __init__(self):
        # Common boilerplate patterns (format only, no legal meaning)
        self.boilerplate_patterns = [
            # German legal boilerplate
            r'Ein Service des Bundesministerium.*',
            r'Service provided by the Federal Ministry.*',
            r'©.*',
            r'Copyright.*',
            r'CELEX.*',
            r'Official Journal.*',
            r'Amtsblatt.*',
            r'Bundesanzeiger.*',
            r'Stand:.*',
            r'Fassung vom.*',
            r'This publication as a fully accessible PDF.*',
            r'PDF generated on.*',
            r'BGBl\..*',
            r'Bundesgesetzblatt.*',
            r'gesetze-im-internet\.de.*',
            r'Juris.*',
            r'Bundesministerium.*Justiz.*',
            r'Federal Ministry.*Justice.*',
            r'Zurück zum Inhaltsverzeichnis.*',
            
            # Navigation/menu
            r'Navigation.*',
            r'Menü.*',
            r'Sitemap.*',
            r'Impressum.*',
            r'Datenschutz.*',
            r'Kontakt.*',
            r'Help.*',
            r'Hilfe.*',
            
            # Page numbers and formatting
            r'^\s*Seite\s*\d+\s*$',
            r'^\s*Page\s*\d+\s*$',
            r'^\s*\d+\s*/\s*\d+\s*$',
            r'\b\d{1,3}\s+von\s+\d{1,3}\b',
            
            # Common headers/footers
            r'^\s*-\s*\d+\s*-\s*$',
            r'^\s*•\s*$',
        ]
        
        # Compile patterns for efficiency
        self.compiled_patterns = [
            re.compile(pattern, re.IGNORECASE | re.MULTILINE) 
            for pattern in self.boilerplate_patterns
        ]
    
    def clean_text(self, content: str) -> Tuple[str, List[str]]:
        """
        Direct port of cleanLegalText from Node.js.
        Removes boilerplate without legal interpretation.
        
        Returns:
            (cleaned_text, removed_patterns)
        """
        if not content:
            return "", []
        
        original_length = len(content)
        removed_patterns = []
        
        # Initial cleanup
        cleaned = re.sub(r'\n{3,}', '\n\n', content)
        cleaned = re.sub(r'\r\n', '\n', cleaned)  # Normalize line endings
        cleaned = cleaned.strip()
        
        # Remove boilerplate patterns
        for pattern in self.compiled_patterns:
            try:
                matches = pattern.findall(cleaned)
                if matches:
                    cleaned = pattern.sub('', cleaned)
                    removed_patterns.extend(matches)
            except Exception as e:
                logger.debug(f"Pattern failed: {pattern.pattern} - {e}")
        
        # Clean up lines
        lines = cleaned.split('\n')
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            if line and len(line) > 5:  # Keep non-empty lines with some content
                cleaned_lines.append(line)
            elif line:
                removed_patterns.append(f"Short line: '{line}'")
        
        cleaned = '\n'.join(cleaned_lines)
        
        # Final whitespace cleanup
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        cleaned = cleaned.strip()
        
        # Log cleanup stats
        if original_length > 0:
            reduction_pct = ((original_length - len(cleaned)) / original_length) * 100
            logger.debug(f"Text cleaned: {original_length} → {len(cleaned)} chars ({reduction_pct:.1f}% reduction)")
        
        return cleaned, removed_patterns
    
    def normalize_whitespace(self, text: str) -> str:
        """Normalize all whitespace - pure formatting"""
        if not text:
            return ""
        
        # Replace multiple spaces with single space
        text = re.sub(r'[ \t]+', ' ', text)
        # Normalize newlines
        text = re.sub(r'\n\s*\n', '\n\n', text)
        # Remove trailing whitespace
        text = re.sub(r' +\n', '\n', text)
        return text.strip()
    
    def extract_clean_lines(self, content: str, min_length: int = 10) -> List[str]:
        """
        Extract clean lines - filtering based on format only.
        No semantic filtering.
        """
        if not content:
            return []
        
        lines = content.split('\n')
        clean_lines = []
        
        for line in lines:
            line = line.strip()
            if len(line) < min_length:
                continue
            
            # Format-based filtering only (no legal meaning)
            if line.upper() == line and len(line) > 30:  # ALL CAPS long lines
                continue
            if line.isdigit():  # Page numbers
                continue
            if re.match(r'^[0-9\s\.\-]+$', line):  # Number only lines
                continue
            if re.match(r'^[^a-zA-Z]*$', line):  # Lines without letters
                continue
            
            clean_lines.append(line)
        
        return clean_lines
    
    def split_into_paragraphs(self, content: str, min_paragraph_length: int = 50) -> List[str]:
        """
        Split text into paragraphs - format based only.
        For later chunking by other layers.
        """
        if not content:
            return []
        
        # Split by double newlines (common paragraph separator)
        paragraphs = re.split(r'\n\s*\n', content)
        
        # Clean each paragraph
        clean_paragraphs = []
        for para in paragraphs:
            cleaned = self.normalize_whitespace(para)
            if cleaned and len(cleaned) >= min_paragraph_length:
                clean_paragraphs.append(cleaned)
        
        return clean_paragraphs
    
    def preserve_special_formatting(self, content: str) -> str:
        """
        Preserve special formatting that might be important.
        Called by other layers if needed.
        """
        if not content:
            return ""
        
        # Preserve § symbols
        content = re.sub(r'§\s+', '§', content)
        # Preserve paragraph numbers
        content = re.sub(r'\((\d+)\)', r'(\1)', content)
        
        return content
    
    def extract_paragraph_headers(self, content: str) -> List[Dict[str, Any]]:
        """
        Extract paragraph headers based on format patterns only.
        No legal interpretation - pure document structure.
        
        Args:
            content: Cleaned text content
            
        Returns:
            List of {'paragraph': '1565', 'text': 'paragraph content...'}
        """
        if not content:
            return []
        
        # German paragraph patterns (format only)
        german_patterns = [
            r'(§\s*\d+[a-z]?)',  # §1565, § 1565a
            r'(Artikel\s+\d+)',  # Artikel 1
            r'(Art\.?\s*\d+)',   # Art. 1, Art. 1a
        ]
        
        # English paragraph patterns (format only)  
        english_patterns = [
            r'(Section\s+\d+)',   # Section 1565
            r'(§\s*\d+[a-z]?)',   # §1565 (also in English)
            r'(Article\s+\d+)',   # Article 1
        ]
        
        # Try to detect language from formatting
        has_german_marks = bool(re.search(r'§\s*\d+', content[:1000]))
        has_english_marks = bool(re.search(r'Section\s+\d+', content[:1000], re.IGNORECASE))
        
        patterns = []
        if has_german_marks or (not has_english_marks):
            patterns = german_patterns
        else:
            patterns = english_patterns
        
        paragraphs = []
        current_paragraph = None
        current_text = []
        
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if line contains a paragraph header
            is_header = False
            paragraph_id = None
            
            for pattern in patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    is_header = True
                    paragraph_id = match.group(1).strip()
                    
                    # Clean up paragraph ID
                    paragraph_id = re.sub(r'§\s*', '', paragraph_id)
                    paragraph_id = re.sub(r'(Artikel|Article|Art\.?|Section)\s+', '', paragraph_id, flags=re.IGNORECASE)
                    paragraph_id = paragraph_id.strip()
                    break
            
            if is_header and paragraph_id:
                # Save previous paragraph if exists
                if current_paragraph is not None and current_text:
                    paragraphs.append({
                        'paragraph': current_paragraph,
                        'text': ' '.join(current_text),
                        'word_count': len(' '.join(current_text).split())
                    })
                
                # Start new paragraph
                current_paragraph = paragraph_id
                current_text = []
                
                # Remove the header from line and keep rest
                for pattern in patterns:
                    line = re.sub(pattern, '', line, flags=re.IGNORECASE)
                line = line.strip()
                if line:
                    current_text.append(line)
            else:
                # Continue current paragraph
                if current_paragraph is not None:
                    current_text.append(line)
        
        # Add the last paragraph
        if current_paragraph is not None and current_text:
            paragraphs.append({
                'paragraph': current_paragraph,
                'text': ' '.join(current_text),
                'word_count': len(' '.join(current_text).split())
            })
        
        # Log what we found
        if paragraphs:
            logger.info(f"📑 Extracted {len(paragraphs)} paragraph headers: {[p['paragraph'] for p in paragraphs[:5]]}...")
        
        return paragraphs


# Singleton instance
format_normalizer = FormatNormalizer()