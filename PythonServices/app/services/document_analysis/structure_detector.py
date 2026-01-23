"""
STRUCTURE DETECTOR
=================

Detects structural elements in legal documents.
Pure pattern recognition - no semantic understanding.
"""

import re
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import logging
__version__ = "0.1.0"


logger = logging.getLogger(__name__)


class StructuralElement(Enum):
    """Types of structural elements in legal documents."""
    TITLE = "title"
    CHAPTER = "chapter"
    PART = "part"
    DIVISION = "division"
    ARTICLE = "article"
    SECTION = "section"
    SUBSECTION = "subsection"
    PARAGRAPH = "paragraph"
    SUBPARAGRAPH = "subparagraph"
    CLAUSE = "clause"
    RECITAL = "recital"
    PREAMBLE = "preamble"
    DEFINITIONS = "definitions"
    SCHEDULE = "schedule"
    ANNEX = "annex"
    APPENDIX = "appendix"
    FORM = "form"


@dataclass
class StructuralMarker:
    """Represents a detected structural element."""
    element_type: StructuralElement
    marker: str
    raw_text: str
    position: int  # Line number
    level: int  # Hierarchical level (1 = highest)
    depth: int = 1  # Nesting depth
    parent: Optional[str] = None
    children: List[str] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "type": self.element_type.value,
            "marker": self.marker,
            "raw_text": self.raw_text[:100] + "..." if len(self.raw_text) > 100 else self.raw_text,
            "position": self.position,
            "level": self.level,
            "depth": self.depth,
            "parent": self.parent,
            "children": self.children
        }


class StructureDetector:
    """
    Detects structural elements of legal documents.
    Language-agnostic pattern matching.
    """
    
    # Comprehensive pattern database
    PATTERN_DATABASE = {
        # TITLES (highest level)
        StructuralElement.TITLE: [
            (r"^TITLE\s+[IVXLCDM]+\b", 1.0, "en_roman"),
            (r"^TITLE\s+\d+\b", 1.0, "en_number"),
            (r"^TITRE\s+[IVXLCDM]+\b", 1.0, "fr_roman"),
            (r"^TITOLO\s+[IVXLCDM]+\b", 1.0, "it_roman"),
            (r"^TÍTULO\s+[IVXLCDM]+\b", 1.0, "es_roman"),
        ],
        
        # CHAPTERS
        StructuralElement.CHAPTER: [
            (r"^CHAPTER\s+[IVXLCDM]+\b", 1.0, "en_roman"),
            (r"^CHAPTER\s+\d+\b", 1.0, "en_number"),
            (r"^CHAPITRE\s+\d+\b", 1.0, "fr_number"),
            (r"^KAPITEL\s+\d+\b", 1.0, "de_number"),
            (r"^CAPÍTULO\s+\d+\b", 1.0, "es_number"),
            (r"^CAPITOLO\s+\d+\b", 1.0, "it_number"),
        ],
        
        # PARTS
        StructuralElement.PART: [
            (r"^PART\s+[IVXLCDM]+\b", 1.0, "en_roman"),
            (r"^PART\s+[A-Z]\b", 0.9, "en_letter"),
            (r"^PARTIE\s+\d+\b", 1.0, "fr_number"),
            (r"^TEIL\s+\d+\b", 1.0, "de_number"),
            (r"^PARTE\s+\d+\b", 1.0, "es_number"),
        ],
        
        # DIVISIONS
        StructuralElement.DIVISION: [
            (r"^DIVISION\s+\d+\b", 1.0, "en_number"),
            (r"^DIVISION\s+[A-Z]\b", 0.9, "en_letter"),
            (r"^DIVISIÓN\s+\d+\b", 1.0, "es_number"),
        ],
        
        # ARTICLES (Civil Law)
        StructuralElement.ARTICLE: [
            (r"^\s*Article\s+\d+[\s\.:]", 1.0, "en_full"),
            (r"^\s*Art\.\s+\d+[\s\.:]", 0.95, "en_abbr"),
            (r"^\s*Art\s+\d+[\s\.:]", 0.9, "en_no_dot"),
            (r"^\s*Artikel\s+\d+[\s\.:]", 1.0, "de_full"),
            (r"^\s*Art\.\s+\d+[\s\.:]", 0.95, "de_abbr"),
            (r"^\s*Articolo\s+\d+[\s\.:]", 1.0, "it_full"),
            (r"^\s*Artículo\s+\d+[\s\.:]", 1.0, "es_full"),
            (r"^\s*Артикул\s+\d+[\s\.:]", 1.0, "ru_full"),
            (r"^\s*第\s*\d+\s*条", 1.0, "jp_full"),  # Japanese
        ],
        
        # SECTIONS (Common Law)
        StructuralElement.SECTION: [
            (r"^\s*Section\s+\d+", 1.0, "en_full"),
            (r"^\s*Sec\.\s+\d+", 0.95, "en_abbr"),
            (r"^\s*§\s*\d+[a-z]?", 1.0, "de_symbol"),
            (r"^\s*§§\s*\d+", 0.9, "de_double"),
            (r"^\s*Sección\s+\d+", 1.0, "es_full"),
            (r"^\s*Art\.\s+\d+\s*§", 0.8, "mixed"),  # Article with §
        ],
        
        # SUBSECTIONS
        StructuralElement.SUBSECTION: [
            (r"^\s*\([a-z]\)", 1.0, "en_lower"),
            (r"^\s*\(\d+\)", 1.0, "en_number"),
            (r"^\s*\([ivxlcdm]+\)", 1.0, "en_roman"),
            (r"^\s*[a-z]\)", 0.9, "en_lower_no_paren"),
            (r"^\s*\d+\.\d+", 0.8, "en_dotted"),
        ],
        
        # PARAGRAPHS
        StructuralElement.PARAGRAPH: [
            (r"^\s*\d+\.\s", 1.0, "en_number"),
            (r"^\s*\(\d+\)\s", 1.0, "en_paren"),
            (r"^\s*[a-z]\.\s", 0.9, "en_letter"),
            (r"^\s*[ivxlcdm]+\.\s", 0.8, "en_roman"),
            (r"^\s*\(\w+\)\s", 0.7, "en_word"),
        ],
        
        # CLAUSES (Contracts)
        StructuralElement.CLAUSE: [
            (r"^\s*Clause\s+\d+", 1.0, "en_full"),
            (r"^\s*Cl\.\s+\d+", 0.9, "en_abbr"),
            (r"^\s*Klausel\s+\d+", 1.0, "de_full"),
            (r"^\s*Cláusula\s+\d+", 1.0, "es_full"),
            (r"^\s*Clausola\s+\d+", 1.0, "it_full"),
        ],
        
        # RECITALS (EU/Treaties)
        StructuralElement.RECITAL: [
            (r"^\([A-Z]\)", 1.0, "eu_style"),
            (r"^\s*Whereas\b", 1.0, "en_whereas"),
            (r"^\s*CONSIDERING\b", 1.0, "en_caps"),
            (r"^\s*Vu\b", 1.0, "fr_vu"),
            (r"^\s*Visto\b", 1.0, "es_visto"),
            (r"^\s*In Erwägung\b", 1.0, "de_erwagung"),
        ],
        
        # PREAMBLE
        StructuralElement.PREAMBLE: [
            (r"^PREAMBLE", 1.0, "en_full"),
            (r"^PREÁMBULO", 1.0, "es_full"),
            (r"^PRÉAMBULE", 1.0, "fr_full"),
            (r"^PRÄAMBEL", 1.0, "de_full"),
        ],
        
        # DEFINITIONS
        StructuralElement.DEFINITIONS: [
            (r"^Definitions?\b", 1.0, "en_full"),
            (r"^Interpretation\b", 0.8, "en_interpretation"),
            (r"^Begriffsbestimmungen\b", 1.0, "de_full"),
            (r"^Définitions\b", 1.0, "fr_full"),
            (r"^Definiciones\b", 1.0, "es_full"),
            (r"^Definizioni\b", 1.0, "it_full"),
        ],
        
        # ANNEXES/APPENDICES
        StructuralElement.ANNEX: [
            (r"^ANNEX\s+[A-Z]", 1.0, "en_annex"),
            (r"^ANEXO\s+[A-Z]", 1.0, "es_annex"),
            (r"^ANHANG\s+\d+", 1.0, "de_annex"),
            (r"^ANNEXE\s+[A-Z]", 1.0, "fr_annex"),
        ],
        
        StructuralElement.APPENDIX: [
            (r"^APPENDIX\s+\d+", 1.0, "en_appendix"),
            (r"^APÉNDICE\s+\d+", 1.0, "es_appendix"),
        ],
        
        StructuralElement.SCHEDULE: [
            (r"^SCHEDULE\s+\d+", 1.0, "en_schedule"),
            (r"^SCHED\.\s+\d+", 0.9, "en_abbr"),
            (r"^ANLAGE\s+\d+", 1.0, "de_schedule"),
        ],
        
        StructuralElement.FORM: [
            (r"^FORM\s+[A-Z]\d*", 1.0, "en_form"),
            (r"^FORMULAR\s+\d+", 1.0, "de_form"),
            (r"^FORMULARIO\s+\d+", 1.0, "es_form"),
        ]
    }
    
    # Hierarchy levels (lower = higher authority)
    ELEMENT_LEVELS = {
        StructuralElement.TITLE: 1,
        StructuralElement.CHAPTER: 2,
        StructuralElement.PART: 3,
        StructuralElement.DIVISION: 4,
        StructuralElement.ARTICLE: 5,
        StructuralElement.SECTION: 6,
        StructuralElement.SUBSECTION: 7,
        StructuralElement.PARAGRAPH: 8,
        StructuralElement.SUBPARAGRAPH: 9,
        StructuralElement.CLAUSE: 10,
        StructuralElement.RECITAL: 11,
        StructuralElement.PREAMBLE: 12,
        StructuralElement.DEFINITIONS: 13,
        StructuralElement.SCHEDULE: 14,
        StructuralElement.ANNEX: 15,
        StructuralElement.APPENDIX: 16,
        StructuralElement.FORM: 17,
    }
    
    # Legal tradition signatures
    LEGAL_TRADITION_SIGNATURES = {
        "civil_law": {
            "primary_elements": ["article", "title", "chapter"],
            "secondary_elements": ["section", "paragraph"],
            "indicators": ["article", "titre", "chapitre", "artículo"],
            "exclude": ["§", "section", "schedule"]
        },
        "common_law": {
            "primary_elements": ["section", "schedule", "part"],
            "secondary_elements": ["subsection", "paragraph"],
            "indicators": ["section", "§", "schedule", "act"],
            "exclude": ["article", "titre"]
        },
        "eu_law": {
            "primary_elements": ["article", "recital", "annex"],
            "secondary_elements": ["paragraph", "point"],
            "indicators": ["regulation", "directive", "recital", "whereas"],
            "exclude": ["§", "section"]
        },
        "international": {
            "primary_elements": ["article", "preamble", "annex"],
            "secondary_elements": ["paragraph", "clause"],
            "indicators": ["treaty", "convention", "protocol", "charter"],
            "exclude": ["§", "section"]
        }
    }
    
    def __init__(self, config: Dict = None):
        """Initialize structure detector."""
        self.config = config or {}
        self.compiled_patterns = self._compile_patterns()
        
    def _compile_patterns(self) -> Dict[StructuralElement, List[Tuple[re.Pattern, float, str]]]:
        """Compile all regex patterns."""
        compiled = {}
        for element_type, patterns in self.PATTERN_DATABASE.items():
            compiled[element_type] = []
            for pattern, confidence, pattern_id in patterns:
                try:
                    compiled_pattern = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
                    compiled[element_type].append((compiled_pattern, confidence, pattern_id))
                except re.error as e:
                    logger.warning(f"Invalid pattern for {element_type}: {pattern} - {e}")
        return compiled
    
    def detect(self, text: str, include_raw: bool = False) -> Dict[str, Any]:
        """
        Detect all structural elements in the document.
        
        Args:
            text: Document text
            include_raw: Include raw line content
            
        Returns:
            Dictionary with detected structures
        """
        if not text or len(text.strip()) < 50:
            return self._empty_result()
        
        lines = text.split('\n')
        detected_elements = []
        element_map = {}  # For quick lookup
        
        # First pass: detect all elements
        for line_num, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # Check each element type
            for element_type, patterns in self.compiled_patterns.items():
                for pattern, confidence, pattern_id in patterns:
                    match = pattern.match(line_stripped)
                    if match:
                        # Extract marker
                        marker = match.group(0).strip()
                        
                        # Get raw text context (next 2 lines for context)
                        raw_context = line_stripped
                        if include_raw and line_num + 2 < len(lines):
                            next_lines = [lines[i].strip() for i in range(line_num + 1, min(line_num + 3, len(lines)))]
                            raw_context = line_stripped + " | " + " | ".join(filter(None, next_lines[:2]))
                        
                        element = StructuralMarker(
                            element_type=element_type,
                            marker=marker,
                            raw_text=raw_context[:200] if include_raw else "",
                            position=line_num,
                            level=self.ELEMENT_LEVELS.get(element_type, 99),
                            depth=1
                        )
                        
                        detected_elements.append(element)
                        element_map[line_num] = element
                        break  # Only first match per line
        
        # Second pass: determine hierarchy relationships
        self._determine_hierarchy(detected_elements, element_map)
        
        # Sort by position
        detected_elements.sort(key=lambda x: x.position)
        
        # Build results
        return self._build_results(detected_elements, text)
    
    def _determine_hierarchy(self, elements: List[StructuralMarker], element_map: Dict):
        """Determine parent-child relationships between elements."""
        if not elements:
            return
        
        # Sort by position and level
        sorted_elements = sorted(elements, key=lambda x: (x.position, x.level))
        
        # Stack to track current hierarchy
        stack = []
        
        for element in sorted_elements:
            # Pop from stack while current element is not a child of stack top
            while stack and not self._is_child_of(stack[-1], element):
                stack.pop()
            
            # Set parent if stack not empty
            if stack:
                element.parent = f"{stack[-1].element_type.value}_{stack[-1].position}"
                element.depth = stack[-1].depth + 1
                stack[-1].children.append(f"{element.element_type.value}_{element.position}")
            
            # Push to stack
            stack.append(element)
    
    def _is_child_of(self, parent: StructuralMarker, child: StructuralMarker) -> bool:
        """Check if child is hierarchically under parent."""
        # Child must be after parent
        if child.position <= parent.position:
            return False
        
        # Child must be at deeper level
        if child.level <= parent.level:
            return False
        
        # Additional logic: same marker family?
        if parent.element_type == StructuralElement.ARTICLE and child.element_type == StructuralElement.PARAGRAPH:
            return True
        if parent.element_type == StructuralElement.SECTION and child.element_type == StructuralElement.SUBSECTION:
            return True
        
        return True
    
    def _build_results(self, elements: List[StructuralMarker], text: str) -> Dict[str, Any]:
        """Build structured results from detected elements."""
        # Element counts by type
        type_counts = {}
        for element in elements:
            type_name = element.element_type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1
        
        # Build hierarchy tree
        hierarchy_tree = self._build_hierarchy_tree(elements)
        
        # Determine legal tradition
        legal_tradition = self._identify_legal_tradition(type_counts, text)
        
        # Document structure classification
        structure_type = self._classify_structure_type(type_counts, text)
        
        # Statistics
        total_lines = len(text.split('\n'))
        coverage = len(elements) / max(total_lines, 1)
        
        return {
            "elements": [element.to_dict() for element in elements],
            "summary": {
                "total_elements": len(elements),
                "type_counts": type_counts,
                "line_coverage": round(coverage, 3),
                "hierarchy_depth": max([e.depth for e in elements], default=0),
            },
            "hierarchy": hierarchy_tree,
            "classification": {
                "legal_tradition": legal_tradition,
                "structure_type": structure_type,
                "confidence": self._calculate_confidence(type_counts, text),
            },
            "metadata": {
                "detection_time": "now",  # Would be datetime in production
                "version": __version__ if '__version__' in globals() else "1.0.0",
            }
        }
    
    def _build_hierarchy_tree(self, elements: List[StructuralMarker]) -> List[Dict]:
        """Build hierarchical tree representation."""
        # Find root elements (no parent)
        roots = [e for e in elements if e.parent is None]
        
        def build_tree(node_element: StructuralMarker) -> Dict:
            """Recursively build tree from element."""
            node = {
                "id": f"{node_element.element_type.value}_{node_element.position}",
                "type": node_element.element_type.value,
                "marker": node_element.marker,
                "position": node_element.position,
                "level": node_element.level,
                "depth": node_element.depth,
                "children": []
            }
            
            # Find children
            child_ids = node_element.children
            for child_id in child_ids:
                # Extract position from id
                try:
                    child_pos = int(child_id.split('_')[-1])
                    for elem in elements:
                        if elem.position == child_pos:
                            node["children"].append(build_tree(elem))
                            break
                except (ValueError, IndexError):
                    continue
            
            return node
        
        return [build_tree(root) for root in roots]
    
    def _identify_legal_tradition(self, type_counts: Dict, text: str) -> str:
        """Identify the legal tradition based on structural patterns."""
        scores = {}
        text_lower = text.lower()
        
        for tradition, signature in self.LEGAL_TRADITION_SIGNATURES.items():
            score = 0
            
            # Primary elements present
            for element in signature["primary_elements"]:
                if element in type_counts:
                    score += type_counts[element] * 3
            
            # Secondary elements present
            for element in signature["secondary_elements"]:
                if element in type_counts:
                    score += type_counts[element] * 1
            
            # Keyword indicators
            for indicator in signature["indicators"]:
                if indicator.lower() in text_lower:
                    score += 5
            
            # Exclusion penalties
            for exclude in signature["exclude"]:
                if exclude in text_lower:
                    score -= 10
            
            scores[tradition] = max(0, score)
        
        # Normalize scores
        total = sum(scores.values())
        if total == 0:
            return "unknown"
        
        # Get best match
        best_tradition = max(scores.items(), key=lambda x: x[1])[0]
        
        # Only return if confident
        if scores[best_tradition] / total > 0.4:
            return best_tradition
        return "mixed"
    
    def _classify_structure_type(self, type_counts: Dict, text: str) -> str:
        """Classify the overall structure type."""
        text_lower = text.lower()
        
        # Code/Statute
        if "article" in type_counts and type_counts["article"] > 10:
            return "civil_law_code"
        if "section" in type_counts and type_counts["section"] > 10:
            return "common_law_statute"
        
        # Regulation/Directive
        if "recital" in type_counts and type_counts["recital"] > 0:
            if "annex" in type_counts:
                return "eu_regulation"
            return "eu_directive"
        
        # Contract
        if "clause" in type_counts and type_counts["clause"] > 5:
            return "contract"
        if "party" in text_lower and ("agree" in text_lower or "agreement" in text_lower):
            return "contract"
        
        # Treaty
        if "preamble" in type_counts and "article" in type_counts:
            if "treaty" in text_lower or "convention" in text_lower:
                return "treaty"
        
        # Court document
        if "court" in text_lower or "judgment" in text_lower or "opinion" in text_lower:
            return "court_document"
        
        # Form
        if "form" in type_counts or "schedule" in type_counts:
            return "legal_form"
        
        return "unstructured"
    
    def _calculate_confidence(self, type_counts: Dict, text: str) -> float:
        """Calculate detection confidence (0-1)."""
        if not type_counts:
            return 0.0
        
        # Base confidence from number of elements
        total_elements = sum(type_counts.values())
        element_confidence = min(1.0, total_elements / 50)
        
        # Confidence from clear hierarchy markers
        hierarchy_markers = {"title", "chapter", "article", "section", "subsection"}
        hierarchy_count = sum(count for elem, count in type_counts.items() if elem in hierarchy_markers)
        hierarchy_confidence = min(1.0, hierarchy_count / 10)
        
        # Confidence from consistency
        consistency = 1.0 if len(type_counts) >= 2 else 0.5
        
        # Weighted average
        confidence = (element_confidence * 0.4 + hierarchy_confidence * 0.4 + consistency * 0.2)
        return round(min(1.0, confidence), 2)
    
    def _empty_result(self) -> Dict:
        """Return empty result structure."""
        return {
            "elements": [],
            "summary": {
                "total_elements": 0,
                "type_counts": {},
                "line_coverage": 0.0,
                "hierarchy_depth": 0,
            },
            "hierarchy": [],
            "classification": {
                "legal_tradition": "unknown",
                "structure_type": "unstructured",
                "confidence": 0.0,
            },
            "metadata": {
                "detection_time": "now",
                "version": "1.0.0",
            }
        }
    
    def extract_section(self, text: str, marker: str) -> Optional[Dict]:
        """Extract a specific section by marker."""
        elements = self.detect(text)["elements"]
        
        for element in elements:
            if element["marker"] == marker:
                lines = text.split('\n')
                start_line = element["position"]
                
                # Find end of section (next element or end of document)
                end_line = len(lines)
                for other in elements:
                    if other["position"] > start_line and other["position"] < end_line:
                        end_line = other["position"]
                        break
                
                # Extract section content
                section_lines = lines[start_line:end_line]
                content = '\n'.join(section_lines).strip()
                
                return {
                    "marker": marker,
                    "type": element["type"],
                    "content": content,
                    "start_line": start_line,
                    "end_line": end_line,
                    "line_count": end_line - start_line,
                }
        
        return None