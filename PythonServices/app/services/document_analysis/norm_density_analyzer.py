"""
NORM DENSITY ANALYZER
====================

Measures how normative (binding) a document is.
Quantifies the density of obligatory, prohibitive, and permissive language.
"""

import re
from typing import Dict, List, Any, Tuple, Set
from dataclasses import dataclass
from enum import Enum
import logging
from collections import Counter

logger = logging.getLogger(__name__)


class NormType(Enum):
    """Types of normative language."""
    OBLIGATION = "obligation"      # Must, shall, required
    PROHIBITION = "prohibition"    # Shall not, prohibited
    PERMISSION = "permission"      # May, can, allowed
    RIGHT = "right"                # Has the right, is entitled
    CONDITION = "condition"        # If, provided that, subject to
    EXCEPTION = "exception"        # Except, unless, notwithstanding
    DEFINITION = "definition"      # Means, refers to, defined as
    DISCRETION = "discretion"      # In the discretion of, may decide
    PENALTY = "penalty"            # Shall be liable, subject to penalty


class NormStrength(Enum):
    """Strength levels of normative language."""
    MANDATORY = "mandatory"        # Strong obligation/prohibition
    STRONG = "strong"              # Clear requirement
    MODERATE = "moderate"          # Qualified requirement
    WEAK = "weak"                  # Permission or discretion
    DESCRIPTIVE = "descriptive"    # Non-binding language


@dataclass
class NormativeExpression:
    """A detected normative expression."""
    text: str
    norm_type: NormType
    strength: NormStrength
    confidence: float  # 0-1
    position: int      # Line number
    raw_line: str     # Full line
    context: str      # Surrounding context
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "text": self.text,
            "type": self.norm_type.value,
            "strength": self.strength.value,
            "confidence": round(self.confidence, 2),
            "position": self.position,
            "line_preview": self.raw_line[:100] + "..." if len(self.raw_line) > 100 else self.raw_line,
            "context": self.context[:150] + "..." if len(self.context) > 150 else self.context
        }


class NormDensityAnalyzer:
    """
    Analyzes normative density in legal documents.
    Multi-language support with confidence scoring.
    """
    
    # Comprehensive normative patterns database
    NORM_PATTERNS = {
        # English
        "en": {
            NormType.OBLIGATION: [
                (r"\bshall\b", 0.95, NormStrength.MANDATORY),
                (r"\bmust\b", 0.90, NormStrength.MANDATORY),
                (r"\bis required to\b", 0.85, NormStrength.STRONG),
                (r"\bshall be required to\b", 0.88, NormStrength.MANDATORY),
                (r"\bhas the obligation to\b", 0.82, NormStrength.STRONG),
                (r"\bis obliged to\b", 0.80, NormStrength.STRONG),
                (r"\bis bound to\b", 0.78, NormStrength.STRONG),
                (r"\bhas a duty to\b", 0.85, NormStrength.STRONG),
                (r"\bit shall be the duty of\b", 0.90, NormStrength.MANDATORY),
            ],
            NormType.PROHIBITION: [
                (r"\bshall not\b", 0.96, NormStrength.MANDATORY),
                (r"\bmust not\b", 0.92, NormStrength.MANDATORY),
                (r"\bmay not\b", 0.88, NormStrength.STRONG),
                (r"\bcannot\b", 0.85, NormStrength.STRONG),
                (r"\bis prohibited from\b", 0.90, NormStrength.STRONG),
                (r"\bis forbidden to\b", 0.88, NormStrength.STRONG),
                (r"\bshall in no case\b", 0.94, NormStrength.MANDATORY),
                (r"\bno person shall\b", 0.92, NormStrength.MANDATORY),
                (r"\bit is unlawful to\b", 0.87, NormStrength.STRONG),
            ],
            NormType.PERMISSION: [
                (r"\bmay\b", 0.75, NormStrength.MODERATE),
                (r"\bcan\b", 0.65, NormStrength.WEAK),
                (r"\bis permitted to\b", 0.80, NormStrength.MODERATE),
                (r"\bis allowed to\b", 0.78, NormStrength.MODERATE),
                (r"\bis authorized to\b", 0.82, NormStrength.MODERATE),
                (r"\bhas the power to\b", 0.79, NormStrength.MODERATE),
                (r"\bis empowered to\b", 0.81, NormStrength.MODERATE),
                (r"\bshall be entitled to\b", 0.85, NormStrength.STRONG),  # Borderline
            ],
            NormType.RIGHT: [
                (r"\bhas the right to\b", 0.85, NormStrength.STRONG),
                (r"\bis entitled to\b", 0.88, NormStrength.STRONG),
                (r"\bshall have the right\b", 0.90, NormStrength.MANDATORY),
                (r"\benjoys the right\b", 0.83, NormStrength.STRONG),
                (r"\bmay exercise the right\b", 0.80, NormStrength.MODERATE),
                (r"\bis conferred the right\b", 0.86, NormStrength.STRONG),
            ],
            NormType.CONDITION: [
                (r"\bif\b.*?\bthen\b", 0.70, NormStrength.MODERATE),
                (r"\bprovided that\b", 0.75, NormStrength.MODERATE),
                (r"\bsubject to\b", 0.78, NormStrength.MODERATE),
                (r"\bconditional upon\b", 0.72, NormStrength.MODERATE),
                (r"\bin the event that\b", 0.68, NormStrength.MODERATE),
                (r"\bwhere\b.*?\bshall\b", 0.73, NormStrength.MODERATE),
            ],
            NormType.EXCEPTION: [
                (r"\bexcept\b", 0.80, NormStrength.STRONG),
                (r"\bunless\b", 0.82, NormStrength.STRONG),
                (r"\bnotwithstanding\b", 0.90, NormStrength.MANDATORY),
                (r"\bsave as\b", 0.75, NormStrength.MODERATE),
                (r"\bother than\b", 0.70, NormStrength.MODERATE),
                (r"\bwith the exception of\b", 0.78, NormStrength.STRONG),
            ],
            NormType.DEFINITION: [
                (r"\bmeans\b", 0.60, NormStrength.DESCRIPTIVE),
                (r"\bshall mean\b", 0.85, NormStrength.MANDATORY),
                (r"\brefers to\b", 0.55, NormStrength.DESCRIPTIVE),
                (r"\bdefined as\b", 0.65, NormStrength.DESCRIPTIVE),
                (r"\bin this [Aa]ct\b.*?\bmeans\b", 0.88, NormStrength.MANDATORY),
                (r"\bfor the purposes of\b", 0.70, NormStrength.MODERATE),
            ],
            NormType.DISCRETION: [
                (r"\bin the discretion of\b", 0.80, NormStrength.MODERATE),
                (r"\bmay in its discretion\b", 0.75, NormStrength.WEAK),
                (r"\bshall have discretion\b", 0.82, NormStrength.MODERATE),
                (r"\bat the discretion of\b", 0.78, NormStrength.MODERATE),
                (r"\bas it deems appropriate\b", 0.72, NormStrength.WEAK),
            ],
            NormType.PENALTY: [
                (r"\bshall be liable\b", 0.88, NormStrength.MANDATORY),
                (r"\bsubject to penalty\b", 0.85, NormStrength.STRONG),
                (r"\bshall be punished\b", 0.90, NormStrength.MANDATORY),
                (r"\bis guilty of an offense\b", 0.92, NormStrength.MANDATORY),
                (r"\bshall be fined\b", 0.87, NormStrength.MANDATORY),
                (r"\bshall be subject to sanctions\b", 0.84, NormStrength.STRONG),
            ]
        },
        
        # German
        "de": {
            NormType.OBLIGATION: [
                (r"\bmuss\b", 0.95, NormStrength.MANDATORY),
                (r"\bhat zu\b", 0.90, NormStrength.MANDATORY),
                (r"\bist verpflichtet\b", 0.88, NormStrength.STRONG),
                (r"\bist gehalten\b", 0.85, NormStrength.STRONG),
                (r"\bhat die Pflicht\b", 0.87, NormStrength.STRONG),
            ],
            NormType.PROHIBITION: [
                (r"\bdarf nicht\b", 0.92, NormStrength.MANDATORY),
                (r"\bist verboten\b", 0.90, NormStrength.STRONG),
                (r"\bist nicht zulässig\b", 0.88, NormStrength.STRONG),
                (r"\buntersagt\b", 0.86, NormStrength.STRONG),
            ],
            NormType.PERMISSION: [
                (r"\bdarf\b", 0.78, NormStrength.MODERATE),
                (r"\bkann\b", 0.70, NormStrength.WEAK),
                (r"\bist berechtigt\b", 0.82, NormStrength.MODERATE),
                (r"\bist zulässig\b", 0.80, NormStrength.MODERATE),
            ],
        },
        
        # French
        "fr": {
            NormType.OBLIGATION: [
                (r"\bdoit\b", 0.93, NormStrength.MANDATORY),
                (r"\best tenu de\b", 0.88, NormStrength.STRONG),
                (r"\ba l'obligation de\b", 0.85, NormStrength.STRONG),
            ],
            NormType.PROHIBITION: [
                (r"\bne doit pas\b", 0.94, NormStrength.MANDATORY),
                (r"\best interdit de\b", 0.90, NormStrength.STRONG),
                (r"\best prohibé\b", 0.88, NormStrength.STRONG),
            ],
            NormType.PERMISSION: [
                (r"\bpeut\b", 0.77, NormStrength.MODERATE),
                (r"\ba le droit de\b", 0.83, NormStrength.MODERATE),
                (r"\best autorisé à\b", 0.81, NormStrength.MODERATE),
            ],
        },
        
        # Spanish
        "es": {
            NormType.OBLIGATION: [
                (r"\bdeberá\b", 0.92, NormStrength.MANDATORY),
                (r"\bestá obligado a\b", 0.87, NormStrength.STRONG),
                (r"\btiene la obligación de\b", 0.85, NormStrength.STRONG),
            ],
            NormType.PROHIBITION: [
                (r"\bno deberá\b", 0.94, NormStrength.MANDATORY),
                (r"\bestá prohibido\b", 0.91, NormStrength.STRONG),
                (r"\bse prohíbe\b", 0.89, NormStrength.STRONG),
            ],
            NormType.PERMISSION: [
                (r"\bpuede\b", 0.76, NormStrength.MODERATE),
                (r"\btiene derecho a\b", 0.84, NormStrength.MODERATE),
                (r"\bestá autorizado a\b", 0.82, NormStrength.MODERATE),
            ],
        }
    }
    
    # Context boosters (increase confidence in certain contexts)
    CONTEXT_BOOSTERS = {
        "penalty_context": [
            r"\bfailure to\b",
            r"\bviolation of\b",
            r"\bnon-compliance\b",
            r"\bbreach of\b",
            r"\bcontravention of\b",
        ],
        "enforcement_context": [
            r"\benforce\b",
            r"\bcomply with\b",
            r"\badherence to\b",
            r"\bimplementation of\b",
            r"\bmonitoring of\b",
        ],
        "mandatory_context": [
            r"\bmandatory\b",
            r"\bcompulsory\b",
            r"\bobligatory\b",
            r"\bindispensable\b",
            r"\bessential\b",
        ],
        "definitive_context": [
            r"\bshall be deemed\b",
            r"\bshall be considered\b",
            r"\bshall be construed\b",
            r"\bshall be interpreted\b",
        ]
    }
    
    # Weak normative indicators (reduce strength)
    WEAK_INDICATORS = [
        r"\bshould\b",
        r"\bought to\b",
        r"\bit is recommended\b",
        r"\bit is advisable\b",
        r"\bit is suggested\b",
        r"\bpreferably\b",
        r"\bdesirably\b",
    ]
    
    def __init__(self, languages: List[str] = None):
        """
        Initialize norm density analyzer.
        
        Args:
            languages: List of language codes to analyze (['en', 'de', 'fr', 'es'])
        """
        self.languages = languages or ['en']
        self.compiled_patterns = self._compile_patterns()
        self.compiled_boosters = self._compile_boosters()
        
    def _compile_patterns(self) -> Dict[str, Dict[NormType, List[Tuple[re.Pattern, float, NormStrength]]]]:
        """Compile regex patterns for all languages."""
        compiled = {}
        
        for lang in self.languages:
            if lang not in self.NORM_PATTERNS:
                logger.warning(f"Language '{lang}' not supported, skipping")
                continue
            
            lang_patterns = {}
            for norm_type, patterns in self.NORM_PATTERNS[lang].items():
                compiled_patterns = []
                for pattern_str, confidence, strength in patterns:
                    try:
                        pattern = re.compile(pattern_str, re.IGNORECASE | re.MULTILINE)
                        compiled_patterns.append((pattern, confidence, strength))
                    except re.error as e:
                        logger.warning(f"Invalid pattern for {lang}.{norm_type}: {pattern_str} - {e}")
                
                if compiled_patterns:
                    lang_patterns[norm_type] = compiled_patterns
            
            if lang_patterns:
                compiled[lang] = lang_patterns
        
        return compiled
    
    def _compile_boosters(self) -> Dict[str, List[re.Pattern]]:
        """Compile context booster patterns."""
        compiled = {}
        
        for context_type, patterns in self.CONTEXT_BOOSTERS.items():
            compiled_patterns = []
            for pattern_str in patterns:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE)
                    compiled_patterns.append(pattern)
                except re.error as e:
                    logger.warning(f"Invalid booster pattern for {context_type}: {pattern_str} - {e}")
            
            if compiled_patterns:
                compiled[context_type] = compiled_patterns
        
        return compiled
    
    def analyze(self, text: str, detailed: bool = False) -> Dict[str, Any]:
        """
        Analyze normative density of text.
        
        Args:
            text: Document text
            detailed: Whether to return detailed findings
            
        Returns:
            Normative analysis results
        """
        if not text or len(text.strip()) < 100:
            return self._empty_result("Text too short")
        
        # Basic text statistics
        stats = self._calculate_text_statistics(text)
        
        # Detect normative expressions
        expressions = self._detect_normative_expressions(text)
        
        # Calculate metrics
        metrics = self._calculate_metrics(expressions, stats)
        
        # Build result
        result = {
            "statistics": stats,
            "metrics": metrics,
            "classification": self._classify_normative_density(metrics),
            "detected_languages": list(set([e.get("language", "en") for e in expressions])),
        }
        
        if detailed:
            result["expressions"] = expressions
            result["type_distribution"] = self._calculate_type_distribution(expressions)
            result["strength_distribution"] = self._calculate_strength_distribution(expressions)
            result["context_analysis"] = self._analyze_context(text)
        
        return result
    
    def _calculate_text_statistics(self, text: str) -> Dict[str, Any]:
        """Calculate basic text statistics."""
        lines = text.split('\n')
        words = re.findall(r'\b\w+\b', text)
        sentences = re.split(r'[.!?]+', text)
        
        return {
            "line_count": len(lines),
            "word_count": len(words),
            "sentence_count": len([s for s in sentences if s.strip()]),
            "avg_words_per_line": len(words) / max(len(lines), 1),
            "avg_words_per_sentence": len(words) / max(len(sentences), 1),
            "char_count": len(text),
            "non_whitespace_chars": len(text.replace(' ', '').replace('\n', '').replace('\t', '')),
        }
    
    def _detect_normative_expressions(self, text: str) -> List[Dict]:
        """Detect all normative expressions in text."""
        expressions = []
        lines = text.split('\n')
        
        for line_num, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # Check each language
            for lang, lang_patterns in self.compiled_patterns.items():
                for norm_type, patterns in lang_patterns.items():
                    for pattern, base_confidence, strength in patterns:
                        matches = list(pattern.finditer(line_stripped))
                        
                        for match in matches:
                            # Get context (3 lines before and after)
                            context_start = max(0, line_num - 3)
                            context_end = min(len(lines), line_num + 4)
                            context = "\n".join(lines[context_start:context_end])
                            
                            # Adjust confidence based on context
                            confidence = self._adjust_confidence(
                                base_confidence, line_stripped, context
                            )
                            
                            # Skip if confidence too low
                            if confidence < 0.5:
                                continue
                            
                            expr = NormativeExpression(
                                text=match.group(),
                                norm_type=norm_type,
                                strength=strength,
                                confidence=confidence,
                                position=line_num + 1,
                                raw_line=line_stripped,
                                context=context
                            )
                            
                            expressions.append({
                                **expr.to_dict(),
                                "language": lang
                            })
        
        # Sort by confidence (highest first)
        expressions.sort(key=lambda x: x["confidence"], reverse=True)
        return expressions
    
    def _adjust_confidence(self, base_confidence: float, line: str, context: str) -> float:
        """Adjust confidence based on context."""
        confidence = base_confidence
        line_lower = line.lower()
        context_lower = context.lower()
        
        # Boost for context
        for context_type, patterns in self.compiled_boosters.items():
            for pattern in patterns:
                if pattern.search(context_lower):
                    if context_type == "penalty_context":
                        confidence = min(1.0, confidence + 0.15)
                    elif context_type == "enforcement_context":
                        confidence = min(1.0, confidence + 0.10)
                    elif context_type == "mandatory_context":
                        confidence = min(1.0, confidence + 0.12)
                    elif context_type == "definitive_context":
                        confidence = min(1.0, confidence + 0.08)
        
        # Reduce for weak indicators
        for weak_indicator in self.WEAK_INDICATORS:
            if re.search(weak_indicator, line_lower, re.IGNORECASE):
                confidence = max(0.0, confidence - 0.20)
        
        # Boost for proximity to structural markers
        structural_markers = ["article", "section", "clause", "paragraph", "subsection"]
        if any(marker in line_lower for marker in structural_markers):
            confidence = min(1.0, confidence + 0.05)
        
        # Penalize for negations that change meaning
        negation_indicators = ["not", "no", "never", "none", "neither", "nor"]
        negation_count = sum(1 for neg in negation_indicators if f" {neg} " in f" {line_lower} ")
        if negation_count > 1:
            confidence = max(0.0, confidence - (negation_count * 0.05))
        
        return round(max(0.0, min(1.0, confidence)), 3)
    
    def _calculate_metrics(self, expressions: List[Dict], stats: Dict) -> Dict[str, float]:
        """Calculate normative density metrics."""
        total_words = stats["word_count"]
        total_sentences = stats["sentence_count"]
        
        if total_words == 0:
            return self._empty_metrics()
        
        # Basic counts
        total_norms = len(expressions)
        strong_norms = len([e for e in expressions if e["strength"] in ["mandatory", "strong"]])
        weak_norms = len([e for e in expressions if e["strength"] in ["weak", "descriptive"]])
        
        # Density metrics
        norm_density_per_100_words = (total_norms / total_words) * 100
        norm_density_per_sentence = total_norms / max(total_sentences, 1)
        strong_norm_ratio = strong_norms / max(total_norms, 1)
        
        # Calculate average confidence and strength score
        if total_norms > 0:
            avg_confidence = sum(e["confidence"] for e in expressions) / total_norms
            # Convert strength to numeric score
            strength_scores = {
                "mandatory": 1.0,
                "strong": 0.8,
                "moderate": 0.6,
                "weak": 0.4,
                "descriptive": 0.2
            }
            avg_strength_score = sum(strength_scores.get(e["strength"], 0.5) for e in expressions) / total_norms
        else:
            avg_confidence = 0.0
            avg_strength_score = 0.0
        
        # Overall normative score (0-100)
        overall_score = self._calculate_overall_score(
            norm_density_per_100_words,
            strong_norm_ratio,
            avg_strength_score,
            avg_confidence
        )
        
        return {
            "total_normative_expressions": total_norms,
            "strong_normative_expressions": strong_norms,
            "weak_normative_expressions": weak_norms,
            "norm_density_per_100_words": round(norm_density_per_100_words, 3),
            "norm_density_per_sentence": round(norm_density_per_sentence, 3),
            "strong_norm_ratio": round(strong_norm_ratio, 3),
            "average_confidence": round(avg_confidence, 3),
            "average_strength_score": round(avg_strength_score, 3),
            "overall_normative_score": round(overall_score, 1),
            "has_normative_content": total_norms > 0,
        }
    
    def _calculate_overall_score(self, density: float, strong_ratio: float, 
                                strength_score: float, confidence: float) -> float:
        """Calculate overall normative score (0-100)."""
        # Density contributes up to 40 points
        density_score = min(40, density * 10)
        
        # Strong norm ratio contributes up to 30 points
        strength_score_points = strong_ratio * 30
        
        # Average strength contributes up to 20 points
        strength_avg_points = strength_score * 20
        
        # Confidence contributes up to 10 points
        confidence_points = confidence * 10
        
        total = density_score + strength_score_points + strength_avg_points + confidence_points
        
        # Penalize for very low density
        if density < 0.1:
            total *= 0.5
        
        return min(100, total)
    
    def _classify_normative_density(self, metrics: Dict) -> Dict[str, Any]:
        """Classify the normative density."""
        score = metrics["overall_normative_score"]
        density = metrics["norm_density_per_100_words"]
        
        if score >= 70:
            category = "highly_normative"
            description = "Strongly binding document (legislation, regulations)"
        elif score >= 45:
            category = "moderately_normative"
            description = "Binding document with some flexibility (contracts, bylaws)"
        elif score >= 25:
            category = "lightly_normative"
            description = "Mostly descriptive with some norms (guidelines, policies)"
        elif score >= 10:
            category = "descriptive_with_norms"
            description = "Primarily descriptive with occasional normative language"
        else:
            category = "non_normative"
            description = "Descriptive or analytical document"
        
        # Sub-classification based on density
        if density > 5:
            density_class = "very_dense"
        elif density > 2:
            density_class = "dense"
        elif density > 0.5:
            density_class = "moderate"
        elif density > 0.1:
            density_class = "sparse"
        else:
            density_class = "very_sparse"
        
        return {
            "category": category,
            "density_class": density_class,
            "description": description,
            "score_range": self._get_score_range(score),
        }
    
    def _get_score_range(self, score: float) -> str:
        """Get textual score range."""
        if score >= 90:
            return "excellent"
        elif score >= 75:
            return "very_high"
        elif score >= 60:
            return "high"
        elif score >= 40:
            return "moderate"
        elif score >= 20:
            return "low"
        else:
            return "very_low"
    
    def _calculate_type_distribution(self, expressions: List[Dict]) -> Dict[str, float]:
        """Calculate distribution of norm types."""
        if not expressions:
            return {}
        
        type_counts = Counter()
        for expr in expressions:
            type_counts[expr["type"]] += 1
        
        total = len(expressions)
        distribution = {}
        for norm_type, count in type_counts.most_common():
            percentage = (count / total) * 100
            distribution[norm_type] = round(percentage, 1)
        
        return distribution
    
    def _calculate_strength_distribution(self, expressions: List[Dict]) -> Dict[str, float]:
        """Calculate distribution of strength levels."""
        if not expressions:
            return {}
        
        strength_counts = Counter()
        for expr in expressions:
            strength_counts[expr["strength"]] += 1
        
        total = len(expressions)
        distribution = {}
        for strength, count in strength_counts.most_common():
            percentage = (count / total) * 100
            distribution[strength] = round(percentage, 1)
        
        return distribution
    
    def _analyze_context(self, text: str) -> Dict[str, bool]:
        """Analyze contextual factors."""
        text_lower = text.lower()
        
        analysis = {}
        
        # Check for key legal document features
        analysis["has_definitions_section"] = any(
            re.search(pattern, text_lower) 
            for pattern in [r"\bdefinitions?\b", r"\binterpretation\b", r"\bconstruction\b"]
        )
        
        analysis["has_penalty_provisions"] = any(
            re.search(pattern, text_lower)
            for pattern in [r"\bpenalty\b", r"\bfine\b", r"\bsanction\b", r"\boffense\b"]
        )
        
        analysis["has_enforcement_mechanisms"] = any(
            re.search(pattern, text_lower)
            for pattern in [r"\benforcement\b", r"\bcompliance\b", r"\bmonitoring\b", r"\baudit\b"]
        )
        
        analysis["has_amendment_provisions"] = any(
            re.search(pattern, text_lower)
            for pattern in [r"\bamendment\b", r"\bmodification\b", r"\brevision\b"]
        )
        
        analysis["has_severability"] = "severability" in text_lower or "severable" in text_lower
        
        analysis["has_governing_law"] = "governing law" in text_lower or "applicable law" in text_lower
        
        analysis["has_dispute_resolution"] = "dispute resolution" in text_lower or "arbitration" in text_lower
        
        return analysis
    
    def _empty_result(self, reason: str = "") -> Dict:
        """Return empty result structure."""
        return {
            "statistics": self._empty_statistics(),
            "metrics": self._empty_metrics(),
            "classification": {
                "category": "non_normative",
                "density_class": "very_sparse",
                "description": "Text too short or invalid",
                "score_range": "very_low",
            },
            "detected_languages": [],
            "error": reason if reason else "No text provided",
        }
    
    def _empty_statistics(self) -> Dict:
        """Return empty statistics."""
        return {
            "line_count": 0,
            "word_count": 0,
            "sentence_count": 0,
            "avg_words_per_line": 0.0,
            "avg_words_per_sentence": 0.0,
            "char_count": 0,
            "non_whitespace_chars": 0,
        }
    
    def _empty_metrics(self) -> Dict:
        """Return empty metrics."""
        return {
            "total_normative_expressions": 0,
            "strong_normative_expressions": 0,
            "weak_normative_expressions": 0,
            "norm_density_per_100_words": 0.0,
            "norm_density_per_sentence": 0.0,
            "strong_norm_ratio": 0.0,
            "average_confidence": 0.0,
            "average_strength_score": 0.0,
            "overall_normative_score": 0.0,
            "has_normative_content": False,
        }
    
    def get_normative_heatmap(self, text: str, window_size: int = 10) -> List[Dict]:
        """
        Create a heatmap of normative density throughout the document.
        
        Args:
            text: Document text
            window_size: Number of lines per window
            
        Returns:
            List of density measurements per window
        """
        lines = text.split('\n')
        heatmap = []
        
        for i in range(0, len(lines), window_size):
            window_end = min(i + window_size, len(lines))
            window_text = "\n".join(lines[i:window_end])
            
            # Analyze this window
            window_stats = self._calculate_text_statistics(window_text)
            window_expr = self._detect_normative_expressions(window_text)
            
            # Calculate density for this window
            density = (len(window_expr) / max(window_stats["word_count"], 1)) * 100
            
            # Calculate average strength
            if window_expr:
                strength_scores = {
                    "mandatory": 1.0, "strong": 0.8, "moderate": 0.6, 
                    "weak": 0.4, "descriptive": 0.2
                }
                avg_strength = sum(strength_scores.get(e["strength"], 0.5) for e in window_expr) / len(window_expr)
            else:
                avg_strength = 0.0
            
            heatmap.append({
                "window_start": i + 1,
                "window_end": window_end,
                "line_count": window_end - i,
                "normative_expressions": len(window_expr),
                "density_per_100_words": round(density, 3),
                "average_strength": round(avg_strength, 2),
                "has_normative_content": len(window_expr) > 0,
                "sample_text": window_text[:200] + "..." if len(window_text) > 200 else window_text,
            })
        
        return heatmap