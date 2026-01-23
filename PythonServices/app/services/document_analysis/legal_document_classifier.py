"""
LEGAL DOCUMENT CLASSIFIER
========================

Classifies unknown legal documents into categories.
No schema assumptions - pure heuristic classification.
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re
import logging
from collections import Counter

logger = logging.getLogger(__name__)


class DocumentCategory(Enum):
    """Legal document categories."""
    # Primary Legislation
    CONSTITUTION = "constitution"
    STATUTE = "statute"
    CODE = "code"
    ACT = "act"
    
    # Secondary Legislation
    REGULATION = "regulation"
    DIRECTIVE = "directive"
    DECREE = "decree"
    ORDER = "order"
    RULE = "rule"
    
    # Contracts & Agreements
    CONTRACT = "contract"
    TREATY = "treaty"
    CONVENTION = "convention"
    PROTOCOL = "protocol"
    AGREEMENT = "agreement"
    
    # Judicial Documents
    COURT_RULING = "court_ruling"
    JUDGMENT = "judgment"
    OPINION = "opinion"
    DECISION = "decision"
    ORDER_COURT = "order_court"  # Court order
    
    # Legal Opinions & Commentary
    LEGAL_OPINION = "legal_opinion"
    MEMORANDUM = "memorandum"
    BRIEF = "brief"
    COMMENTARY = "commentary"
    ARTICLE = "article"
    
    # Administrative Documents
    POLICY = "policy"
    GUIDELINE = "guideline"
    FORM = "form"
    SCHEDULE = "schedule"
    NOTICE = "notice"
    
    # Other
    BYLAW = "bylaw"
    CHARTER = "charter"
    RESOLUTION = "resolution"
    UNKNOWN = "unknown"


class LegalSystem(Enum):
    """Legal system classifications."""
    COMMON_LAW = "common_law"
    CIVIL_LAW = "civil_law"
    MIXED = "mixed"
    INTERNATIONAL = "international"
    RELIGIOUS = "religious"
    CUSTOMARY = "customary"
    SOCIALIST = "socialist"
    UNKNOWN = "unknown"


class JurisdictionHint(Enum):
    """Jurisdiction hints."""
    # National
    UNITED_STATES = "united_states"
    UNITED_KINGDOM = "united_kingdom"
    CANADA = "canada"
    AUSTRALIA = "australia"
    GERMANY = "germany"
    FRANCE = "france"
    SPAIN = "spain"
    ITALY = "italy"
    CHINA = "china"
    JAPAN = "japan"
    
    # Supranational
    EUROPEAN_UNION = "european_union"
    UNITED_NATIONS = "united_nations"
    WTO = "wto"
    ICC = "icc"  # International Criminal Court
    
    # Regional
    US_STATE = "us_state"
    CANADIAN_PROVINCE = "canadian_province"
    GERMAN_STATE = "german_state"
    
    # General
    FEDERAL = "federal"
    STATE = "state"
    LOCAL = "local"
    MUNICIPAL = "municipal"


@dataclass
class ClassificationResult:
    """Result of document classification."""
    primary_category: DocumentCategory
    secondary_categories: List[DocumentCategory] = field(default_factory=list)
    legal_system: LegalSystem = LegalSystem.UNKNOWN
    confidence: float = 0.0  # 0-100
    jurisdiction_hints: List[JurisdictionHint] = field(default_factory=list)
    features: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "primary_category": self.primary_category.value,
            "secondary_categories": [c.value for c in self.secondary_categories],
            "legal_system": self.legal_system.value,
            "confidence": round(self.confidence, 1),
            "jurisdiction_hints": [h.value for h in self.jurisdiction_hints],
            "features": self.features,
            "metadata": self.metadata,
        }


class LegalDocumentClassifier:
    """
    Classifies legal documents using multi-heuristic approach.
    """
    
    # Document category signatures
    CATEGORY_SIGNATURES = {
        DocumentCategory.CONSTITUTION: {
            "keywords": ["constitution", "charter", "grundgesetz", "constitution", "constitución"],
            "structural": ["preamble", "article", "chapter"],
            "phrases": ["we the people", "established by", "supreme law"],
            "exclusions": ["regulation", "directive", "contract"],
            "min_length": 5000,
            "confidence_boost": 1.2,
        },
        DocumentCategory.STATUTE: {
            "keywords": ["act", "statute", "law", "gesetz", "loi", "ley"],
            "structural": ["section", "subsection", "schedule"],
            "phrases": ["be it enacted", "parliament enacts", "is hereby enacted"],
            "exclusions": ["contract", "treaty", "regulation"],
            "min_length": 1000,
            "confidence_boost": 1.1,
        },
        DocumentCategory.CODE: {
            "keywords": ["code", "codice", "código", "kodeks"],
            "structural": ["title", "chapter", "article", "section"],
            "phrases": ["civil code", "penal code", "code of", "title"],
            "exclusions": ["contract", "regulation"],
            "min_length": 5000,
            "confidence_boost": 1.15,
        },
        DocumentCategory.REGULATION: {
            "keywords": ["regulation", "verordnung", "règlement", "reglamento"],
            "structural": ["article", "recital", "annex"],
            "phrases": ["commission regulation", "implementing regulation", "delegated regulation"],
            "exclusions": ["act", "statute", "contract"],
            "min_length": 500,
            "confidence_boost": 1.0,
        },
        DocumentCategory.DIRECTIVE: {
            "keywords": ["directive", "richtlinie", "directive", "directiva"],
            "structural": ["article", "recital"],
            "phrases": ["directive of the european", "member states shall"],
            "exclusions": ["regulation", "act"],
            "min_length": 1000,
            "confidence_boost": 1.0,
        },
        DocumentCategory.CONTRACT: {
            "keywords": ["contract", "agreement", "vertrag", "contrat", "contrato"],
            "structural": ["clause", "schedule", "annex", "party"],
            "phrases": ["between the parties", "hereby agree", "terms and conditions"],
            "exclusions": ["act", "regulation", "directive"],
            "min_length": 500,
            "confidence_boost": 1.0,
        },
        DocumentCategory.TREATY: {
            "keywords": ["treaty", "convention", "protocol", "tratado", "traité"],
            "structural": ["article", "preamble", "annex"],
            "phrases": ["states parties", "entered into force", "ratified by"],
            "exclusions": ["act", "regulation", "contract"],
            "min_length": 1000,
            "confidence_boost": 1.1,
        },
        DocumentCategory.COURT_RULING: {
            "keywords": ["court", "judgment", "decision", "ruling", "urteil"],
            "structural": ["case", "plaintiff", "defendant", "opinion"],
            "phrases": ["in the court of", "case number", "it is ordered"],
            "exclusions": ["shall", "article", "section"],
            "min_length": 500,
            "confidence_boost": 0.9,
        },
        DocumentCategory.LEGAL_OPINION: {
            "keywords": ["opinion", "memorandum", "brief", "advice", "gutachten"],
            "structural": [],
            "phrases": ["legal opinion", "this memorandum", "advises that"],
            "exclusions": ["shall", "enacted", "ordered"],
            "min_length": 300,
            "confidence_boost": 0.8,
        },
        DocumentCategory.POLICY: {
            "keywords": ["policy", "guideline", "procedure", "richtlinie", "politique"],
            "structural": ["section", "paragraph"],
            "phrases": ["policy on", "guidelines for", "procedures to"],
            "exclusions": ["shall", "must", "required"],
            "min_length": 300,
            "confidence_boost": 0.7,
        },
        DocumentCategory.BYLAW: {
            "keywords": ["bylaw", "bylaw", "satzung", "règlement intérieur"],
            "structural": ["article", "section"],
            "phrases": ["board of directors", "membership", "annual meeting"],
            "exclusions": ["act", "statute"],
            "min_length": 500,
            "confidence_boost": 0.8,
        },
    }
    
    # Legal system indicators
    LEGAL_SYSTEM_INDICATORS = {
        LegalSystem.COMMON_LAW: {
            "keywords": ["common law", "equity", "precedent", "case law"],
            "structural": ["section", "subsection", "schedule", "act"],
            "jurisdictions": ["united_states", "united_kingdom", "canada", "australia"],
            "exclusions": ["article", "code civil"],
        },
        LegalSystem.CIVIL_LAW: {
            "keywords": ["civil law", "code civil", "bgb", "codice civile"],
            "structural": ["article", "title", "chapter", "code"],
            "jurisdictions": ["germany", "france", "spain", "italy"],
            "exclusions": ["section", "act of parliament"],
        },
        LegalSystem.INTERNATIONAL: {
            "keywords": ["international", "united nations", "treaty", "convention"],
            "structural": ["article", "preamble", "annex"],
            "jurisdictions": ["united_nations", "european_union"],
            "exclusions": ["state", "municipal"],
        },
        LegalSystem.MIXED: {
            "keywords": ["mixed", "hybrid", "bijuridical"],
            "structural": [],  # No specific structure
            "jurisdictions": ["canada", "south_africa", "philippines"],
            "exclusions": [],
        },
        LegalSystem.RELIGIOUS: {
            "keywords": ["sharia", "islamic", "canon", "religious"],
            "structural": [],
            "jurisdictions": [],
            "exclusions": ["secular", "civil"],
        },
    }
    
    # Jurisdiction patterns
    JURISDICTION_PATTERNS = {
        JurisdictionHint.UNITED_STATES: [
            (r"\bUnited States\b", 1.0),
            (r"\bU\.S\.\b", 0.9),
            (r"\bUSC\b", 0.95),  # United States Code
            (r"\bCFR\b", 0.9),   # Code of Federal Regulations
            (r"\bCongress\b", 0.8),
            (r"\bFederal\b.*?\bRegister\b", 0.85),
        ],
        JurisdictionHint.UNITED_KINGDOM: [
            (r"\bUnited Kingdom\b", 1.0),
            (r"\bUK\b", 0.9),
            (r"\bU\.K\.\b", 0.9),
            (r"\bAct of Parliament\b", 0.95),
            (r"\bStatutory Instrument\b", 0.9),
            (r"\bHMSO\b", 0.8),  # Her Majesty's Stationery Office
        ],
        JurisdictionHint.CANADA: [
            (r"\bCanada\b", 1.0),
            (r"\bCanadian\b", 0.9),
            (r"\bRSC\b", 0.85),  # Revised Statutes of Canada
            (r"\bProvince of\b", 0.8),
        ],
        JurisdictionHint.AUSTRALIA: [
            (r"\bAustralia\b", 1.0),
            (r"\bCommonwealth of Australia\b", 0.95),
            (r"\bAct No\.\b", 0.8),
        ],
        JurisdictionHint.GERMANY: [
            (r"\bGermany\b", 1.0),
            (r"\bGerman\b", 0.9),
            (r"\bBGB\b", 0.95),  # Bürgerliches Gesetzbuch
            (r"\bStGB\b", 0.95),  # Strafgesetzbuch
            (r"\bGG\b", 0.9),    # Grundgesetz
            (r"\b§§\b", 0.85),
        ],
        JurisdictionHint.FRANCE: [
            (r"\bFrance\b", 1.0),
            (r"\bFrench\b", 0.9),
            (r"\bCode civil\b", 0.95),
            (r"\bCode pénal\b", 0.95),
            (r"\bLoi n°\b", 0.9),
            (r"\bDécret n°\b", 0.85),
        ],
        JurisdictionHint.EUROPEAN_UNION: [
            (r"\bEuropean Union\b", 1.0),
            (r"\bEU\b", 0.95),
            (r"\bE\.U\.\b", 0.95),
            (r"\bRegulation \(EU\)\b", 0.98),
            (r"\bDirective \d{4}/\d+/EU\b", 0.98),
            (r"\bEUR-Lex\b", 0.9),
        ],
        JurisdictionHint.UNITED_NATIONS: [
            (r"\bUnited Nations\b", 1.0),
            (r"\bUN\b", 0.95),
            (r"\bU\.N\.\b", 0.95),
            (r"\bSecurity Council\b", 0.9),
            (r"\bGeneral Assembly\b", 0.9),
        ],
        JurisdictionHint.CHINA: [
            (r"\bChina\b", 1.0),
            (r"\bChinese\b", 0.9),
            (r"\b中华人民共和国\b", 0.95),
            (r"\b法律\b", 0.85),
        ],
        JurisdictionHint.JAPAN: [
            (r"\bJapan\b", 1.0),
            (r"\bJapanese\b", 0.9),
            (r"\b法律\b", 0.85),  # Japanese law
            (r"\b第.*条\b", 0.8),  # Article pattern
        ],
        JurisdictionHint.US_STATE: [
            (r"\bState of\b", 0.8),
            (r"\bCalifornia\b", 0.9),
            (r"\bNew York\b", 0.9),
            (r"\bTexas\b", 0.9),
            (r"\bFlorida\b", 0.9),
            (r"\bChapter\b.*?\bRevised Code\b", 0.85),
        ],
        JurisdictionHint.FEDERAL: [
            (r"\bfederal\b", 0.8),
            (r"\bnational\b", 0.7),
            (r"\bcentral government\b", 0.8),
        ],
        JurisdictionHint.STATE: [
            (r"\bstate\b", 0.8),
            (r"\bprovincial\b", 0.8),
            (r"\bregional\b", 0.7),
        ],
        JurisdictionHint.LOCAL: [
            (r"\blocal\b", 0.8),
            (r"\bmunicipal\b", 0.9),
            (r"\bcity of\b", 0.85),
            (r"\bordinance\b", 0.8),
        ],
    }
    
    def __init__(self, config: Dict = None):
        """Initialize classifier."""
        self.config = config or {}
        self.compiled_jurisdiction_patterns = self._compile_jurisdiction_patterns()
        
    def _compile_jurisdiction_patterns(self) -> Dict[JurisdictionHint, List[Tuple[re.Pattern, float]]]:
        """Compile jurisdiction regex patterns."""
        compiled = {}
        
        for jurisdiction, patterns in self.JURISDICTION_PATTERNS.items():
            compiled_patterns = []
            for pattern_str, confidence in patterns:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE)
                    compiled_patterns.append((pattern, confidence))
                except re.error as e:
                    logger.warning(f"Invalid jurisdiction pattern for {jurisdiction}: {pattern_str} - {e}")
            
            if compiled_patterns:
                compiled[jurisdiction] = compiled_patterns
        
        return compiled
    
    def classify(self, text: str, include_features: bool = False) -> ClassificationResult:
        """
        Classify a legal document.
        
        Args:
            text: Document text
            include_features: Whether to include feature analysis
            
        Returns:
            Classification result
        """
        if not text or len(text.strip()) < 100:
            return self._unknown_result("Text too short")
        
        # Extract features
        features = self._extract_features(text)
        
        # Classify document category
        category_scores = self._score_categories(text, features)
        primary_category, category_confidence = self._select_primary_category(category_scores)
        secondary_categories = self._select_secondary_categories(category_scores, primary_category)
        
        # Determine legal system
        legal_system = self._determine_legal_system(text, features)
        
        # Extract jurisdiction hints
        jurisdiction_hints = self._extract_jurisdiction_hints(text)
        
        # Build metadata
        metadata = {
            "text_length": len(text),
            "word_count": features.get("word_count", 0),
            "detection_method": "multi_heuristic",
        }
        
        if include_features:
            metadata["feature_analysis"] = features
            metadata["category_scores"] = {
                cat.value: round(score, 1) 
                for cat, score in category_scores.items() 
                if score > 0
            }
        
        return ClassificationResult(
            primary_category=primary_category,
            secondary_categories=secondary_categories,
            legal_system=legal_system,
            confidence=category_confidence,
            jurisdiction_hints=jurisdiction_hints,
            features=features,
            metadata=metadata
        )
    
    def _extract_features(self, text: str) -> Dict[str, Any]:
        """Extract classification features from text."""
        lines = text.split('\n')
        words = re.findall(r'\b\w+\b', text)
        text_lower = text.lower()
        
        # Basic statistics
        features = {
            "line_count": len(lines),
            "word_count": len(words),
            "char_count": len(text),
            "avg_line_length": sum(len(line) for line in lines) / max(len(lines), 1),
            "avg_word_length": sum(len(word) for word in words) / max(len(words), 1),
        }
        
        # Structural analysis
        features["structural_markers"] = self._extract_structural_markers(text)
        
        # Keyword analysis
        features["keyword_frequencies"] = self._extract_keyword_frequencies(text_lower)
        
        # Signature detection
        features["signatures"] = self._detect_signatures(text)
        
        # Language detection (simplified)
        features["detected_languages"] = self._detect_languages(text)
        
        # Normative language analysis
        features["normative_density"] = self._estimate_normative_density(text)
        
        return features
    
    def _extract_structural_markers(self, text: str) -> Dict[str, int]:
        """Extract counts of structural markers."""
        markers = {
            "article": len(re.findall(r'\bArticle\b', text, re.IGNORECASE)),
            "section": len(re.findall(r'\bSection\b', text, re.IGNORECASE)),
            "chapter": len(re.findall(r'\bChapter\b', text, re.IGNORECASE)),
            "clause": len(re.findall(r'\bClause\b', text, re.IGNORECASE)),
            "paragraph": len(re.findall(r'\bParagraph\b', text, re.IGNORECASE)),
            "recital": len(re.findall(r'\bRecital\b', text, re.IGNORECASE)),
            "preamble": len(re.findall(r'\bPreamble\b', text, re.IGNORECASE)),
            "annex": len(re.findall(r'\bAnnex\b', text, re.IGNORECASE)),
            "schedule": len(re.findall(r'\bSchedule\b', text, re.IGNORECASE)),
            "appendix": len(re.findall(r'\bAppendix\b', text, re.IGNORECASE)),
            "form": len(re.findall(r'\bForm\b', text, re.IGNORECASE)),
        }
        
        # Also check for symbols
        markers["section_symbol"] = text.count('§')
        
        return {k: v for k, v in markers.items() if v > 0}
    
    def _extract_keyword_frequencies(self, text_lower: str) -> Dict[str, int]:
        """Extract frequencies of legal keywords."""
        # Collect all keywords from signatures
        all_keywords = set()
        for signature in self.CATEGORY_SIGNATURES.values():
            all_keywords.update(signature.get("keywords", []))
            all_keywords.update(signature.get("phrases", []))
        
        frequencies = {}
        for keyword in all_keywords:
            # For single words
            if ' ' not in keyword:
                pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
                count = len(re.findall(pattern, text_lower))
            else:
                # For phrases
                count = text_lower.count(keyword.lower())
            
            if count > 0:
                frequencies[keyword] = count
        
        return dict(sorted(frequencies.items(), key=lambda x: x[1], reverse=True)[:20])
    
    def _detect_signatures(self, text: str) -> Dict[str, bool]:
        """Detect document signatures."""
        signatures = {}
        text_lower = text.lower()
        
        # Common legal document signatures
        signature_patterns = {
            "enacting_clause": r"be it enacted|hereby enacted|is enacted as follows",
            "contract_parties": r"between\s+.+\s+and\s+.+\s+agreement",
            "treaty_preamble": r"states parties|convinced that|desiring to",
            "court_header": r"in the\s+.+\s+court\b",
            "citation_pattern": r"\d+\s+[A-Z]+\s+\d+|\d+\s+[A-Z]{2,}\.\s+\d+",
            "date_of_effect": r"comes into force|effective as of|enters into force",
            "legislative_history": r"as amended by|hereinafter referred to",
            "signature_block": r"in witness whereof|signed.*sealed.*delivered",
            "whereas_clauses": r"whereas,\s*[A-Z]",
            "definitions_section": r"definitions\s*$|interpretation\s*$",
            "table_of_contents": r"table of contents|contents\s*$",
            "index": r"index\s*$|schedule of",
        }
        
        for name, pattern in signature_patterns.items():
            signatures[name] = bool(re.search(pattern, text_lower, re.IGNORECASE | re.MULTILINE))
        
        return signatures
    
    def _detect_languages(self, text: str) -> List[str]:
        """Detect languages in text (simplified)."""
        languages = []
        text_lower = text.lower()
        
        # Check for language-specific patterns
        if re.search(r'\bthe\b', text_lower) and re.search(r'\band\b', text_lower):
            languages.append("en")
        
        if re.search(r'\bder\b', text_lower) and re.search(r'\bdie\b', text_lower) and re.search(r'\bdas\b', text_lower):
            languages.append("de")
        
        if re.search(r'\ble\b', text_lower) and re.search(r'\bla\b', text_lower) and re.search(r'\bles\b', text_lower):
            languages.append("fr")
        
        if re.search(r'\bel\b', text_lower) and re.search(r'\bla\b', text_lower) and re.search(r'\blos\b', text_lower):
            languages.append("es")
        
        if re.search(r'\bil\b', text_lower) and re.search(r'\bla\b', text_lower):
            languages.append("it")
        
        return languages
    
    def _estimate_normative_density(self, text: str) -> float:
        """Estimate normative language density (simplified)."""
        normative_terms = [
            "shall", "must", "required", "obliged", "prohibited",
            "may not", "shall not", "must not", "is entitled",
            "has the right", "duty", "obligation"
        ]
        
        text_lower = text.lower()
        total_words = len(re.findall(r'\b\w+\b', text_lower))
        
        if total_words == 0:
            return 0.0
        
        normative_count = 0
        for term in normative_terms:
            pattern = r'\b' + term.replace(' ', r'\s+') + r'\b'
            normative_count += len(re.findall(pattern, text_lower))
        
        density = (normative_count / total_words) * 100
        return round(density, 3)
    
    def _score_categories(self, text: str, features: Dict) -> Dict[DocumentCategory, float]:
        """Score each document category."""
        scores = {}
        text_lower = text.lower()
        structural_markers = features.get("structural_markers", {})
        signatures = features.get("signatures", {})
        keyword_freq = features.get("keyword_frequencies", {})
        
        for category, signature in self.CATEGORY_SIGNATURES.items():
            score = 0.0
            
            # 1. Length requirement (base score)
            if len(text) >= signature.get("min_length", 0):
                score += 10
            else:
                score -= 5
            
            # 2. Keyword matching (30 points max)
            keywords = signature.get("keywords", [])
            keyword_score = 0
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    keyword_score += 5
            score += min(30, keyword_score)
            
            # 3. Phrase matching (20 points max)
            phrases = signature.get("phrases", [])
            phrase_score = 0
            for phrase in phrases:
                if phrase.lower() in text_lower:
                    phrase_score += 10
            score += min(20, phrase_score)
            
            # 4. Structural markers (20 points max)
            required_structures = signature.get("structural", [])
            structure_score = 0
            for structure in required_structures:
                if structure in structural_markers and structural_markers[structure] > 0:
                    structure_score += 10
            score += min(20, structure_score)
            
            # 5. Signature detection (20 points max)
            signature_score = 0
            # Category-specific signature checks
            if category == DocumentCategory.STATUTE and signatures.get("enacting_clause", False):
                signature_score += 10
            if category == DocumentCategory.CONTRACT and signatures.get("contract_parties", False):
                signature_score += 10
            if category == DocumentCategory.TREATY and signatures.get("treaty_preamble", False):
                signature_score += 10
            if category == DocumentCategory.COURT_RULING and signatures.get("court_header", False):
                signature_score += 10
            score += signature_score
            
            # 6. Exclusion penalty (-30 points max)
            exclusions = signature.get("exclusions", [])
            exclusion_penalty = 0
            for exclusion in exclusions:
                if exclusion.lower() in text_lower:
                    exclusion_penalty += 10
            score -= min(30, exclusion_penalty)
            
            # Apply confidence boost
            score *= signature.get("confidence_boost", 1.0)
            
            # Ensure score is non-negative
            scores[category] = max(0.0, score)
        
        # Add default categories with lower scores
        for category in DocumentCategory:
            if category not in scores:
                scores[category] = 5.0
        
        return scores
    
    def _select_primary_category(self, scores: Dict[DocumentCategory, float]) -> Tuple[DocumentCategory, float]:
        """Select primary category from scores."""
        if not scores:
            return DocumentCategory.UNKNOWN, 0.0
        
        # Find best score
        best_category, best_score = max(scores.items(), key=lambda x: x[1])
        
        # Normalize to 0-100 scale
        max_possible = 100  # Based on our scoring system
        confidence = min(100, (best_score / max_possible) * 100)
        
        # Require minimum confidence
        if confidence < 20:
            return DocumentCategory.UNKNOWN, confidence
        
        return best_category, confidence
    
    def _select_secondary_categories(self, scores: Dict[DocumentCategory, float], 
                                   primary: DocumentCategory) -> List[DocumentCategory]:
        """Select secondary categories."""
        # Remove primary category
        filtered_scores = {k: v for k, v in scores.items() if k != primary}
        
        # Sort by score
        sorted_categories = sorted(filtered_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Select top 3 with score > 20
        secondary = []
        for category, score in sorted_categories[:3]:
            if score > 20:
                secondary.append(category)
        
        return secondary
    
    def _determine_legal_system(self, text: str, features: Dict) -> LegalSystem:
        """Determine legal system."""
        text_lower = text.lower()
        scores = {}
        
        for system, indicators in self.LEGAL_SYSTEM_INDICATORS.items():
            score = 0.0
            
            # Keyword matching
            for keyword in indicators.get("keywords", []):
                if keyword.lower() in text_lower:
                    score += 10
            
            # Structural indicators
            structural_markers = features.get("structural_markers", {})
            for structure in indicators.get("structural", []):
                if structure in structural_markers:
                    score += structural_markers[structure] * 5
            
            # Jurisdiction alignment
            jurisdiction_hints = self._extract_jurisdiction_hints(text)
            system_jurisdictions = indicators.get("jurisdictions", [])
            for hint in jurisdiction_hints:
                if hint.value in [j for j in system_jurisdictions]:
                    score += 15
            
            # Exclusion penalty
            for exclusion in indicators.get("exclusions", []):
                if exclusion.lower() in text_lower:
                    score -= 10
            
            scores[system] = max(0.0, score)
        
        # Find best match
        if not scores:
            return LegalSystem.UNKNOWN
        
        best_system, best_score = max(scores.items(), key=lambda x: x[1])
        
        # Require minimum score
        if best_score < 20:
            # Try to infer from jurisdiction hints
            jurisdiction_hints = self._extract_jurisdiction_hints(text)
            if JurisdictionHint.EUROPEAN_UNION in jurisdiction_hints:
                return LegalSystem.MIXED
            if JurisdictionHint.UNITED_NATIONS in jurisdiction_hints:
                return LegalSystem.INTERNATIONAL
            
            # Default based on structural patterns
            if "article" in text_lower and "section" not in text_lower:
                return LegalSystem.CIVIL_LAW
            if "section" in text_lower and "article" not in text_lower:
                return LegalSystem.COMMON_LAW
            
            return LegalSystem.UNKNOWN
        
        return best_system
    
    def _extract_jurisdiction_hints(self, text: str) -> List[JurisdictionHint]:
        """Extract jurisdiction hints from text."""
        hints = set()
        
        for jurisdiction, patterns in self.compiled_jurisdiction_patterns.items():
            for pattern, confidence in patterns:
                if pattern.search(text):
                    hints.add(jurisdiction)
                    break  # Only need one match per jurisdiction
        
        return list(hints)
    
    def _unknown_result(self, reason: str) -> ClassificationResult:
        """Return unknown result."""
        return ClassificationResult(
            primary_category=DocumentCategory.UNKNOWN,
            secondary_categories=[],
            legal_system=LegalSystem.UNKNOWN,
            confidence=0.0,
            jurisdiction_hints=[],
            features={},
            metadata={"reason": reason}
        )
    
    def classify_batch(self, texts: List[str], include_features: bool = False) -> List[ClassificationResult]:
        """Classify multiple documents."""
        return [self.classify(text, include_features) for text in texts]
    
    def get_classification_report(self, text: str) -> Dict[str, Any]:
        """Get detailed classification report."""
        result = self.classify(text, include_features=True)
        
        report = {
            "classification": result.to_dict(),
            "text_statistics": {
                "length": len(text),
                "word_count": result.features.get("word_count", 0),
                "line_count": result.features.get("line_count", 0),
            },
            "structural_analysis": {
                "markers": result.features.get("structural_markers", {}),
                "signatures": result.features.get("signatures", {}),
            },
            "keyword_analysis": {
                "top_keywords": list(result.features.get("keyword_frequencies", {}).items())[:10],
            },
            "detected_languages": result.features.get("detected_languages", []),
            "normative_estimate": result.features.get("normative_density", 0.0),
        }
        
        return report