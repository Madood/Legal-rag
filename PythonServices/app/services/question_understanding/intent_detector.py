"""
Intent Detector

Determines what kind of legal question is being asked.
This controls authority filtering and reasoning depth.
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class IntentType(str, Enum):
    """Legal question intent types."""
    DEFINITION = "DEFINITION"
    NORMATIVE = "NORMATIVE"
    DOCTRINE = "DOCTRINE"
    CASE_ANALYSIS = "CASE_ANALYSIS"
    PROCEDURAL = "PROCEDURAL"
    SYSTEM = "SYSTEM"
    GENERAL_STATUTE = "GENERAL_STATUTE"
    COMPARISON = "COMPARISON"
    OFFENSE = "OFFENSE"


class DoctrinalStability(str, Enum):
    """Stability level of legal doctrines."""
    SETTLED = "SETTLED"      # Well-established, uncontested principles
    CONTESTED = "CONTESTED"  # Debated or evolving doctrines
    EMERGING = "EMERGING"    # New or developing principles
    UNKNOWN = "UNKNOWN"      # Stability cannot be determined


INTENT_TYPES = [intent.value for intent in IntentType]


@dataclass
class IntentResult:
    """Structured result of intent detection."""
    intent: IntentType
    confidence: float
    indicators: List[str]
    statute_context: Optional[str] = None
    reference: Optional[str] = None
    # ========== ADDED: Doctrine stability tagging ==========
    doctrinal_stability: Optional[DoctrinalStability] = None
    detected_doctrine: Optional[str] = None
    # ========== END ADDED ==========


class IntentDetector:
    """Core intent detection engine."""
    
    def __init__(self):
        # ========== ADDED: Settled doctrines registry ==========
        # Fundamental legal principles that are settled law
        self.SETTLED_DOCTRINES = {
            "schuldprinzip": DoctrinalStability.SETTLED,
            "nulla poena sine culpa": DoctrinalStability.SETTLED,
            "nulla poena sine lege": DoctrinalStability.SETTLED,
            "verhältnismäßigkeitsprinzip": DoctrinalStability.SETTLED,
            "rechtsstaatsprinzip": DoctrinalStability.SETTLED,
            "bestimmtheitsgrundsatz": DoctrinalStability.SETTLED,
            "vertrauensschutzprinzip": DoctrinalStability.SETTLED,
            "ne bis in idem": DoctrinalStability.SETTLED,
            "in dubio pro reo": DoctrinalStability.SETTLED,
            "unmittelbarkeitsgrundsatz": DoctrinalStability.SETTLED,
            "öffentlichkeitsgrundsatz": DoctrinalStability.SETTLED,
            "gesetzlicher richter": DoctrinalStability.SETTLED,
            "waffengleichheit": DoctrinalStability.SETTLED,
            "rechtliches gehör": DoctrinalStability.SETTLED,
            "fair trial": DoctrinalStability.SETTLED,
            "trennungsprinzip": DoctrinalStability.SETTLED,  # Civil law principle
            "abstraktionsprinzip": DoctrinalStability.SETTLED,  # Civil law principle
        }
        
        # Contested or evolving doctrines
        self.CONTESTED_DOCTRINES = {
            "drittwirkung": DoctrinalStability.CONTESTED,  # Third-party effect of fundamental rights
            "wirtschaftsverwaltungsrecht": DoctrinalStability.CONTESTED,  # Economic administrative law
            "mittelbare drittwirkung": DoctrinalStability.CONTESTED,  # Indirect third-party effect
        }
        
        # Emerging doctrines
        self.EMERGING_DOCTRINES = {
            "digital constitutionalism": DoctrinalStability.EMERGING,
            "algorithmic fairness": DoctrinalStability.EMERGING,
            "data sovereignty": DoctrinalStability.EMERGING,
        }
        
        # Doctrine keywords for detection
        self.doctrine_keywords = {
            "schuldprinzip": ["schuld", "guilt", "zurechnung", "haftung"],
            "nulla poena sine lege": ["nulla poena", "gesetzlich", "rückwirkung"],
            "verhältnismäßigkeitsprinzip": ["verhältnismäßig", "proportional", "geeignet"],
            "rechtsstaatsprinzip": ["rechtsstaat", "rule of law", "verfassung"],
            "bestimmtheitsgrundsatz": ["bestimmt", "klar", "vorhersehbar"],
            "vertrauensschutzprinzip": ["vertrauen", "schutz", "bestand"],
            "ne bis in idem": ["ne bis", "doppelbestrafung", "strafklageverbrauch"],
            "in dubio pro reo": ["in dubio", "zweifel", "zugunsten"],
            "trennungsprinzip": ["trennung", "verpflichtung", "verfügung"],
            "abstraktionsprinzip": ["abstraktion", "verpflichtungsgeschäft", "verfügungsgeschäft"],
        }
        # ========== END ADDED ==========
        
        # Intent patterns with weights
        self.intent_patterns = {
            IntentType.DEFINITION: [
                (r'\bwhat is\b|\bdefine\b|\bmeaning of\b|\bdefinition of\b', 0.9),
                (r'\bwas ist\b|\bdefiniere\b|\bbedeutung von\b', 0.9),
                (r'\bterm\b|\bconcept\b|\bbegriff\b', 0.6),
            ],
            IntentType.NORMATIVE: [
                (r'§\s*\d+[a-z]?\s*\w+', 1.0),  # § followed by number and words
                (r'artikel\s*\d+[a-z]?\s*\w+', 1.0),  # Artikel with number and words
                (r'article\s*\d+[a-z]?\s*\w+', 1.0),
                (r'paragraph\s*\d+[a-z]?\s*\w+', 0.9),
                (r'section\s*\d+[a-z]?\s*\w+', 0.9),
                (r'\bwhat does §\b|\bwas regelt §\b|\berklären sie §\b', 0.8),
                (r'\bmeaning of article\b|\bbedeutung von artikel\b', 0.8),
            ],
            IntentType.DOCTRINE: [
                (r'\bdoctrine\b|\bdoctrinal\b|\blegal principle\b', 0.9),
                (r'\brechtslehre\b|\brechtspri\b|\bgrundsatz\b', 0.9),
                (r'\bschuldprinzip\b|\bguilt principle\b', 0.95),
                (r'\bnulla poena sine culpa\b', 0.95),
                (r'\bnulla poena sine lege\b', 0.95),
                (r'\bverhältnismäßigkeitsprinzip\b|\bproportionality principle\b', 0.95),
                (r'\brechtsstaatsprinzip\b|\brule of law principle\b', 0.95),
                (r'\bbestimmtheitsgrundsatz\b|\bdeterminacy principle\b', 0.95),
                (r'\bvertrauensschutzprinzip\b|\bprotection of legitimate expectations\b', 0.95),
                (r'\bne bis in idem\b|\bdouble jeopardy\b', 0.95),
                (r'\bin dubio pro reo\b|\bbenefit of the doubt\b', 0.95),
                (r'\btrennungsprinzip\b|\bseparation principle\b', 0.95),
                (r'\babstraktionsprinzip\b|\babstraction principle\b', 0.95),
                (r'\binterpret\b|\bcommentary\b|\binterpretation\b', 0.7),
                (r'\bprinciple\b|\bgrundsätze\b|\bprinzipien\b', 0.8),
                (r'\blegal theory\b|\brechtstheorie\b', 0.7),
            ],
            IntentType.CASE_ANALYSIS: [
                (r'\bif\b|\bin case\b|\bhypothetical\b|\bscenario\b', 0.8),
                (r'\bfalls\b|\bin einem fall\b|\bhypothese\b', 0.8),
                (r'\bsuppose\b|\bimagine\b|\bannahme\b', 0.7),
                (r'\bapply to\b|\banwenden auf\b|\banwendung\b', 0.8),
            ],
            IntentType.PROCEDURAL: [
                (r'\bhow do i\b|\bprocedure\b|\bsteps\b|\bprocess\b', 0.9),
                (r'\bwie wird\b|\bverfahren\b|\bschritte\b|\bablauf\b', 0.9),
                (r'\brequirements\b|\bvoraussetzungen\b', 0.7),
                (r'\bhow to\b|\bwie mache ich\b', 0.8),
            ],
            IntentType.SYSTEM: [
                (r'\blegal system\b|\bcommon law system\b|\bcivil law system\b', 0.9),
                (r'\brechtssystem\b|\bcommon law\b|\bcivil law\b', 0.9),
                (r'\bgerman legal system\b|\bclassification of legal system\b', 0.85),
                (r'\brechtskreis\b|\brechtsfamilie\b', 0.9),
                (r'\bhow does the system work\b|\bwie funktioniert das system\b', 0.8),
            ],
            IntentType.GENERAL_STATUTE: [
                (r'\blaws related to\b|\bregulations regarding\b', 0.8),
                (r'\blegal framework for\b|\bstatutes concerning\b', 0.8),
                (r'\bwhat laws cover\b|\bwhich laws apply to\b', 0.8),
                (r'\boverview of laws\b|\blegal provisions for\b', 0.8),
                (r'\bgesetze zu\b|\brechtliche grundlagen für\b', 0.8),
            ],
            IntentType.COMPARISON: [
                (r'\bdifference between\b|\bunterschied zwischen\b', 0.9),
                (r'\bcompare\b|\bvergleichen\b|\bim vergleich zu\b', 0.8),
                (r'\bsimilar to\b|\bähnlich wie\b', 0.7),
                (r'\bversus\b|\bvs\b|\bim gegensatz zu\b', 0.8),
            ],
            IntentType.OFFENSE: [
                (r'\bespionage\b|\bspionage\b', 0.9),
                (r'\bfraud\b|\bbetrug\b', 0.9),
                (r'\btheft\b|\bdiebstahl\b', 0.9),
                (r'\bmurder\b|\bmord\b', 0.9),
                (r'\bwhich crime\b|\bwelche straftat\b', 0.8),
                (r'\bstrafrecht\b|\bcriminal law\b', 0.7),
            ]
        }
        
        # Statute detection patterns
        self.statute_patterns = {
            r'\bstgb\b': 'StGB',
            r'\bbgb\b': 'BGB',
            r'\bhgb\b': 'HGB',
            r'\bgg\b': 'GG',
            r'\bgdpr\b': 'GDPR',
            r'\bzsg\b': 'ZPO',
            r'\bstpo\b': 'StPO',
            r'\bao\b': 'AO',
        }
    
    # ========== ADDED: Doctrine detection methods ==========
    def _detect_doctrine_and_stability(self, question: str) -> Tuple[Optional[str], Optional[DoctrinalStability]]:
        """
        Detect which doctrine is being asked about and determine its stability.
        
        Returns:
            Tuple of (doctrine_name, doctrinal_stability)
        """
        q_lower = question.lower()
        
        # First, check for exact doctrine matches
        for doctrine_name, stability in self.SETTLED_DOCTRINES.items():
            if doctrine_name in q_lower:
                return doctrine_name, stability
        
        for doctrine_name, stability in self.CONTESTED_DOCTRINES.items():
            if doctrine_name in q_lower:
                return doctrine_name, stability
        
        for doctrine_name, stability in self.EMERGING_DOCTRINES.items():
            if doctrine_name in q_lower:
                return doctrine_name, stability
        
        # Then, check for keyword matches
        for doctrine_name, keywords in self.doctrine_keywords.items():
            for keyword in keywords:
                if keyword in q_lower:
                    # Find the stability level
                    if doctrine_name in self.SETTLED_DOCTRINES:
                        return doctrine_name, self.SETTLED_DOCTRINES[doctrine_name]
                    elif doctrine_name in self.CONTESTED_DOCTRINES:
                        return doctrine_name, self.CONTESTED_DOCTRINES[doctrine_name]
                    elif doctrine_name in self.EMERGING_DOCTRINES:
                        return doctrine_name, self.EMERGING_DOCTRINES[doctrine_name]
        
        # If we detect doctrinal language but can't identify specific doctrine
        doctrinal_patterns = [
            r'\bgrundsatz\b',
            r'\bprinzip\b',
            r'\bdoctrine\b',
            r'\brechtslehre\b',
            r'\blegal principle\b',
        ]
        
        if any(re.search(pattern, q_lower) for pattern in doctrinal_patterns):
            # Generic doctrinal question
            return "general_doctrine", DoctrinalStability.UNKNOWN
        
        return None, None
    
    def _determine_doctrine_stability(self, doctrine_name: str) -> DoctrinalStability:
        """Determine the stability level of a doctrine."""
        if doctrine_name in self.SETTLED_DOCTRINES:
            return DoctrinalStability.SETTLED
        elif doctrine_name in self.CONTESTED_DOCTRINES:
            return DoctrinalStability.CONTESTED
        elif doctrine_name in self.EMERGING_DOCTRINES:
            return DoctrinalStability.EMERGING
        else:
            return DoctrinalStability.UNKNOWN
    # ========== END ADDED ==========
    
    def _extract_statute(self, text: str) -> Optional[str]:
        """Extract statute reference from text."""
        lower_text = text.lower()
        for pattern, statute in self.statute_patterns.items():
            if re.search(pattern, lower_text):
                return statute
        return None
    
    def _extract_reference(self, text: str) -> Optional[str]:
        """Extract legal reference (paragraph/article number)."""
        patterns = [
            r'(?:§|§§)\s*(\d+[a-z]?)',
            r'(?:artikel|article|art\.)\s*(\d+[a-z]?)',
            r'paragraph\s*(\d+[a-z]?)',
            r'section\s*(\d+[a-z]?)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        return None
    
    def detect_intent(self, question: str) -> IntentResult:
        """
        Determine the intent of a legal question.
        
        Args:
            question: The legal question text
            
        Returns:
            IntentResult containing intent type, confidence, and metadata
        """
        q = question.lower().strip()
        scores = {}
        indicators = {}
        
        # Calculate scores for each intent type
        for intent_type, patterns in self.intent_patterns.items():
            scores[intent_type] = 0.0
            indicators[intent_type] = []
            
            for pattern, weight in patterns:
                if re.search(pattern, q, re.IGNORECASE):
                    scores[intent_type] += weight
                    indicators[intent_type].append(pattern)
        
        # Check for statute-specific contexts
        statute = self._extract_statute(q)
        reference = self._extract_reference(question)  # Use original case for reference
        
        # ========== MODIFIED: Enhanced doctrine detection ==========
        # Detect doctrine and its stability
        detected_doctrine, doctrinal_stability = self._detect_doctrine_and_stability(question)
        
        # If we detected a doctrine, boost DOCTRINE intent score
        if detected_doctrine:
            scores[IntentType.DOCTRINE] += 0.5  # Significant boost for detected doctrine
            # Also add to indicators
            indicators[IntentType.DOCTRINE].append(f"detected_doctrine:{detected_doctrine}")
        # ========== END MODIFIED ==========
        
        # Boost certain intents based on context
        if statute:
            # If there's a statute but no specific intent is strong, assume GENERAL_STATUTE
            if max(scores.values()) < 0.5:
                scores[IntentType.GENERAL_STATUTE] = 0.7
        
        # Determine winning intent
        if not scores:
            intent = IntentType.GENERAL_STATUTE
            confidence = 0.5
        else:
            intent = max(scores, key=scores.get)
            max_score = scores[intent]
            
            # Normalize confidence
            total_score = sum(scores.values())
            if total_score > 0:
                confidence = min(max_score / total_score * 1.5, 1.0)
            else:
                confidence = 0.5
        
        # ========== ADDED: Determine doctrinal stability for DOCTRINE intent ==========
        doctrinal_result = None
        detected_doctrine_name = None
        
        if intent == IntentType.DOCTRINE:
            if not doctrinal_stability:  # If not already detected above
                detected_doctrine_name, doctrinal_stability = self._detect_doctrine_and_stability(question)
            else:
                detected_doctrine_name = detected_doctrine
            
            # If still no stability determined, try to infer from indicators
            if not doctrinal_stability or doctrinal_stability == DoctrinalStability.UNKNOWN:
                # Check if it's likely a settled doctrine based on keywords
                settled_keywords = ["grundgesetz", "constitution", "verfassung", "european convention"]
                if any(keyword in q for keyword in settled_keywords):
                    doctrinal_stability = DoctrinalStability.SETTLED
                else:
                    doctrinal_stability = DoctrinalStability.UNKNOWN
        # ========== END ADDED ==========
        
        return IntentResult(
            intent=intent,
            confidence=round(confidence, 2),
            indicators=indicators.get(intent, []),
            statute_context=statute,
            reference=reference,
            # ========== ADDED: Doctrine stability information ==========
            doctrinal_stability=doctrinal_stability if intent == IntentType.DOCTRINE else None,
            detected_doctrine=detected_doctrine_name if intent == IntentType.DOCTRINE else None,
            # ========== END ADDED ==========
        )


# Global detector instance
_detector = IntentDetector()


def detect_intent(question: str) -> IntentResult:
    """
    Public interface for intent detection.
    
    Args:
        question: The legal question text
        
    Returns:
        IntentResult with intent type and metadata
    """
    return _detector.detect_intent(question)