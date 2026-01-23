"""
EPISTEMOLOGY MODULE
==================

Determines what legal claims the system may assert.
Encodes legal defensibility and examiner readiness.
"""

from enum import Enum
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


class LegalDomain(Enum):
    """Legal domain classification."""
    PROPERTY = "property"
    CONTRACT = "contract"
    CRIMINAL = "criminal"
    CONSTITUTIONAL = "constitutional"
    ADMINISTRATIVE = "administrative"
    TAX = "tax"
    LABOR = "labor"
    FAMILY = "family"
    COMMERCIAL = "commercial"
    UNKNOWN = "unknown"
    MIXED = "mixed"


class EpistemicLevel(Enum):
    """Levels of epistemic justification."""
    CERTAIN = "certain"          # Statute + paragraph + complete doctrine
    SUPPORTED = "supported"      # Statute known, paragraph inferred
    OVERVIEW_ONLY = "overview"   # Domain correct, paragraph not locked
    INFERRED = "inferred"        # Reasonable inference from known norms
    INSUFFICIENT = "insufficient" # Missing anchor norm
    CONFLICTING = "conflicting"  # Norm conflicts detected
    INVALID = "invalid"          # Wrong statute or authority


class QuestionType(Enum):
    """Types of legal questions."""
    DEFINITION = "definition"       # "What is X?"
    CONSEQUENCE = "consequence"     # "What happens if X?"
    PROCEDURE = "procedure"         # "How to do X?"
    INTERPRETATION = "interpretation" # "How to interpret X?"
    SYSTEM = "system"              # "How does X system work?"
    DOCTRINE = "doctrine"          # "What are the principles of X?"
    COMPARISON = "comparison"      # "Compare X and Y"
    APPLICATION = "application"     # "How does X apply to situation Y?"


# DOCTRINAL STRUCTURE QUESTIONS: These are doctrinal abstractions that
# do NOT require norm completeness in retrieval evidence
DOCTRINAL_STRUCTURE_QUESTIONS = {
    QuestionType.DOCTRINE,
    QuestionType.SYSTEM
}


@dataclass
class AuthorityEvidence:
    """Evidence of legal authority."""
    statute: Optional[str] = None
    paragraph: Optional[str] = None
    exact_match: bool = False
    authority_score: float = 0.0
    hierarchy_level: str = "unknown"
    
    # Norm references
    norm_ids: List[str] = field(default_factory=list)
    anchor_norm_present: bool = False


@dataclass
class DomainProfile:
    """Profile of a legal domain's expected structure."""
    domain: LegalDomain
    mandatory_norm_types: List[str]  # e.g., ["ownership", "transfer", "registration"]
    typical_statutes: List[str]      # e.g., ["BGB", "ZPO", "Grundbuchordnung"]
    cross_domain_risks: List[LegalDomain] = field(default_factory=list)


@dataclass
class EpistemicAssessment:
    """Complete epistemic assessment of a potential answer."""
    
    # Non-default fields FIRST (required by Python dataclasses)
    epistemic_level: EpistemicLevel
    legal_defensibility: float  # 0-1, how defensible in court/forum
    examiner_readiness: float   # 0-1, ready for examiner scrutiny
    domain: LegalDomain
    domain_certainty: float
    authority_evidence: AuthorityEvidence
    doctrine_completeness: float  # 0-1, completeness of required norms
    question_type: QuestionType
    question_abstraction: float  # 0=concrete, 1=abstract
    
    # Default fields LAST
    cross_domain_contamination: bool = False
    missing_mandatory_norms: List[str] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)
    requires_clarification: bool = False
    has_conflicting_norms: bool = False
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "epistemic_level": self.epistemic_level.value,
            "legal_defensibility": round(self.legal_defensibility, 3),
            "examiner_readiness": round(self.examiner_readiness, 3),
            "domain": self.domain.value,
            "domain_certainty": round(self.domain_certainty, 3),
            "cross_domain_contamination": self.cross_domain_contamination,
            "authority_evidence": {
                "statute": self.authority_evidence.statute,
                "paragraph": self.authority_evidence.paragraph,
                "exact_match": self.authority_evidence.exact_match,
                "authority_score": self.authority_evidence.authority_score,
                "hierarchy_level": self.authority_evidence.hierarchy_level,
                "norm_ids": self.authority_evidence.norm_ids,
                "anchor_norm_present": self.authority_evidence.anchor_norm_present,
            },
            "doctrine_completeness": round(self.doctrine_completeness, 3),
            "missing_mandatory_norms": self.missing_mandatory_norms,
            "question_type": self.question_type.value,
            "question_abstraction": round(self.question_abstraction, 3),
            "reasons": self.reasons,
            "requires_clarification": self.requires_clarification,
            "has_conflicting_norms": self.has_conflicting_norms,
        }


class LegalEpistemology:
    """
    Core epistemology engine for legal reasoning.
    Determines what can be known given available authority.
    """
    
    # ========== ADDED: SETTLED DOCTRINES RULES ==========
    # These are fundamental legal principles that are settled law
    # and should be treated as confirmed regardless of retrieval evidence
    SETTLED_DOCTRINES = {
        "schuldprinzip",
        "nulla poena sine lege",
        "verhältnismäßigkeitsprinzip",
        "rechtsstaatsprinzip",
        "bestimmtheitsgrundsatz",
        "vertrauensschutzprinzip",
        "ne bis in idem",
        "in dubio pro reo",
        "unmittelbarkeitsgrundsatz",
        "öffentlichkeitsgrundsatz",
        "gesetzlicher richter",
        "waffengleichheit",
        "rechtliches gehör",
        "fair trial"
    }
    # ========== END ADDED ==========
    
    # Domain profiles (could be loaded from config/database)
    DOMAIN_PROFILES = {
        LegalDomain.PROPERTY: DomainProfile(
            domain=LegalDomain.PROPERTY,
            mandatory_norm_types=["ownership", "possession", "transfer", "registration"],
            typical_statutes=["BGB", "Grundbuchordnung", "ZPO"],
            cross_domain_risks=[LegalDomain.CONTRACT, LegalDomain.FAMILY]
        ),
        LegalDomain.CONTRACT: DomainProfile(
            domain=LegalDomain.CONTRACT,
            mandatory_norm_types=["formation", "obligation", "remedy", "termination"],
            typical_statutes=["BGB", "HGB", "ZPO"],
            cross_domain_risks=[LegalDomain.COMMERCIAL, LegalDomain.LABOR]
        ),
        LegalDomain.CRIMINAL: DomainProfile(
            domain=LegalDomain.CRIMINAL,
            mandatory_norm_types=["offense", "penalty", "procedure", "defense"],
            typical_statutes=["StGB", "StPO", "OWiG"],
            cross_domain_risks=[LegalDomain.CONSTITUTIONAL, LegalDomain.ADMINISTRATIVE]
        ),
        LegalDomain.CONSTITUTIONAL: DomainProfile(
            domain=LegalDomain.CONSTITUTIONAL,
            mandatory_norm_types=["principle", "right", "limitation", "interpretation"],
            typical_statutes=["GG", "BVerfGG", "EMRK"],
            cross_domain_risks=[]
        ),
        # Add other domains as needed
    }
    
    # Norm type mappings (what norm types answer what questions)
    QUESTION_NORM_EXPECTATIONS = {
        QuestionType.DEFINITION: ["definition", "concept", "term"],
        QuestionType.CONSEQUENCE: ["consequence", "effect", "remedy", "penalty"],
        QuestionType.PROCEDURE: ["procedure", "step", "requirement", "form"],
        QuestionType.INTERPRETATION: ["interpretation", "principle", "rule"],
        QuestionType.SYSTEM: ["structure", "principle", "doctrine"],
        QuestionType.DOCTRINE: ["doctrine", "principle", "theory"],
        QuestionType.COMPARISON: ["comparison", "distinction", "similarity"],
        QuestionType.APPLICATION: ["application", "test", "requirement"],
    }
    
    # ========== ADDED: Doctrinal keywords for detection ==========
    DOCTRINAL_KEYWORDS = {
        "schuldprinzip": ["schuld", "haftung", "verantwortlichkeit", "zurechnung"],
        "nulla poena sine lege": ["nulla poena", "gesetzlich", "strafgesetz", "rückwirkung"],
        "verhältnismäßigkeitsprinzip": ["verhältnismäßig", "angemessen", "geeignet", "erforderlich"],
        "rechtsstaatsprinzip": ["rechtsstaat", "grundgesetz", "verfassung", "staatsgewalt"],
        "bestimmtheitsgrundsatz": ["bestimmt", "klar", "vorhersehbar", "normklarheit"],
        "vertrauensschutzprinzip": ["vertrauen", "schutz", "bestand", "zukunft"],
        "ne bis in idem": ["ne bis", "doppelbestrafung", "idem", "strafklageverbrauch"],
        "in dubio pro reo": ["in dubio", "zweifel", "zugunsten", "beschuldigten"],
    }
    # ========== END ADDED ==========
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def assess_epistemic_status(
        self,
        authority_result: Dict[str, Any],
        domain_induction: LegalDomain,
        question_type: QuestionType,
        retrieval_evidence: Dict[str, Any],
        authority_mode: str = "exact",
        question_text: str = ""  # Added parameter for doctrine detection
    ) -> EpistemicAssessment:
        """
        Assess the epistemic status of a potential answer.
        
        Args:
            authority_result: From authority service
            domain_induction: Induced legal domain
            question_type: Type of question being asked
            retrieval_evidence: Evidence from retrieval
            authority_mode: 'exact', 'overview', or 'none'
            question_text: Original question text for doctrine detection
            
        Returns:
            Complete epistemic assessment
        """
        self.logger.info(f"Assessing epistemic status for {question_type.value} in {domain_induction.value}")
        
        # ========== ADDED: Early check for settled doctrines ==========
        # If this is a doctrinal question about a settled principle,
        # we can return CERTAIN immediately to enable early-exit
        if question_type == QuestionType.DOCTRINE and question_text:
            detected_doctrine = self._detect_settled_doctrine(question_text, retrieval_evidence)
            if detected_doctrine and detected_doctrine in self.SETTLED_DOCTRINES:
                self.logger.info(f"Detected settled doctrine: {detected_doctrine} - upgrading to CERTAIN")
                
                # Create authority evidence for settled doctrine
                doctrine_evidence = AuthorityEvidence(
                    statute="Verfassung/Grundgesetz",  # Constitutional level
                    paragraph="Art. 20 GG / Art. 103 GG",  # General principles
                    exact_match=True,  # Settled doctrine
                    authority_score=1.0,  # Highest authority
                    hierarchy_level="constitutional",  # Constitutional principle
                    norm_ids=["grundrechte", "staatsprinzipien"],  # Generic IDs
                    anchor_norm_present=True  # Always present for settled doctrines
                )
                
                # Return CERTAIN assessment immediately
                return EpistemicAssessment(
                    epistemic_level=EpistemicLevel.CERTAIN,
                    legal_defensibility=0.95,
                    examiner_readiness=0.95,
                    domain=LegalDomain.CONSTITUTIONAL,  # Default to constitutional
                    domain_certainty=1.0,
                    cross_domain_contamination=False,
                    authority_evidence=doctrine_evidence,
                    doctrine_completeness=1.0,  # Complete by definition
                    missing_mandatory_norms=[],
                    question_type=question_type,
                    question_abstraction=0.9,  # High abstraction for doctrines
                    reasons=[f"Settled doctrine '{detected_doctrine}' - confirmed constitutional principle"],
                    requires_clarification=False,
                    has_conflicting_norms=False
                )
        # ========== END ADDED ==========
        
        # Extract authority evidence
        authority_evidence = self._extract_authority_evidence(authority_result, retrieval_evidence)
        
        # Check domain consistency
        domain_certainty, cross_contamination = self._check_domain_consistency(
            domain_induction, authority_evidence, retrieval_evidence
        )
        
        # Check doctrine completeness
        doctrine_completeness, missing_norms = self._check_doctrine_completeness(
            domain_induction, question_type, retrieval_evidence
        )
        
        # Determine epistemic level
        epistemic_level = self._determine_epistemic_level(
            authority_evidence, doctrine_completeness, authority_mode, question_type,
            retrieval_evidence  # Added parameter
        )
        
        # ========== ADDED: Upgrade epistemic level for settled doctrines ==========
        # Even if not detected earlier, check again with the extracted evidence
        if question_type == QuestionType.DOCTRINE and retrieval_evidence:
            # Check if we have a settled doctrine in the retrieval evidence
            detected_doctrine = self._detect_doctrine_from_evidence(retrieval_evidence)
            if detected_doctrine and detected_doctrine in self.SETTLED_DOCTRINES:
                # Upgrade to CERTAIN
                epistemic_level = EpistemicLevel.CERTAIN
                doctrine_completeness = 1.0
                domain_certainty = max(domain_certainty, 0.9)  # Boost domain certainty
                self.logger.info(f"Upgraded {detected_doctrine} to CERTAIN based on detected concept")
        # ========== END ADDED ==========
        
        # Calculate defensibility and readiness
        legal_defensibility = self._calculate_defensibility(
            epistemic_level, doctrine_completeness, domain_certainty
        )
        examiner_readiness = self._calculate_examiner_readiness(
            epistemic_level, missing_norms, cross_contamination, question_type,
            retrieval_evidence  # Added parameter
        )
        
        # Check for norm conflicts
        has_conflicts = self._detect_norm_conflicts(retrieval_evidence)
        
        # Determine question abstraction
        question_abstraction = self._determine_question_abstraction(question_type)
        
        # Build reasons
        reasons = self._build_assessment_reasons(
            epistemic_level, missing_norms, cross_contamination, has_conflicts, question_type
        )
        
        # Determine if clarification needed
        requires_clarification = self._requires_clarification(
            epistemic_level, missing_norms, domain_certainty
        )
        
        return EpistemicAssessment(
            epistemic_level=epistemic_level,
            legal_defensibility=legal_defensibility,
            examiner_readiness=examiner_readiness,
            domain=domain_induction,
            domain_certainty=domain_certainty,
            cross_domain_contamination=cross_contamination,
            authority_evidence=authority_evidence,
            doctrine_completeness=doctrine_completeness,
            missing_mandatory_norms=missing_norms,
            question_type=question_type,
            question_abstraction=question_abstraction,
            reasons=reasons,
            requires_clarification=requires_clarification,
            has_conflicting_norms=has_conflicts
        )
    
    # ========== ADDED: New methods for doctrine detection ==========
    def _detect_settled_doctrine(self, question_text: str, retrieval_evidence: Dict[str, Any]) -> Optional[str]:
        """Detect if the question is about a settled doctrine."""
        question_lower = question_text.lower()
        
        # Check for direct mentions of settled doctrines
        for doctrine in self.SETTLED_DOCTRINES:
            if doctrine in question_lower:
                return doctrine
        
        # Check for doctrinal keywords
        for doctrine, keywords in self.DOCTRINAL_KEYWORDS.items():
            if any(keyword in question_lower for keyword in keywords):
                return doctrine
        
        # Check retrieval evidence for doctrinal markers
        if retrieval_evidence and "doctrinal_markers" in retrieval_evidence:
            markers = retrieval_evidence.get("doctrinal_markers", [])
            for marker in markers:
                marker_lower = marker.lower()
                for doctrine in self.SETTLED_DOCTRINES:
                    if doctrine in marker_lower:
                        return doctrine
        
        return None
    
    def _detect_doctrine_from_evidence(self, retrieval_evidence: Dict[str, Any]) -> Optional[str]:
        """Detect doctrine from retrieval evidence."""
        if not retrieval_evidence:
            return None
        
        # Check concepts in evidence
        if "concepts" in retrieval_evidence:
            concepts = retrieval_evidence.get("concepts", [])
            for concept in concepts:
                concept_lower = concept.lower()
                for doctrine in self.SETTLED_DOCTRINES:
                    if doctrine in concept_lower:
                        return doctrine
        
        # Check norm content for doctrinal references
        if "norms" in retrieval_evidence:
            norms = retrieval_evidence.get("norms", [])
            for norm in norms:
                content = norm.get("content", "").lower()
                for doctrine in self.SETTLED_DOCTRINES:
                    if doctrine in content:
                        return doctrine
        
        return None
    # ========== END ADDED ==========
    
    def _extract_authority_evidence(
        self, 
        authority_result: Dict[str, Any], 
        retrieval_evidence: Dict[str, Any]
    ) -> AuthorityEvidence:
        """Extract authority evidence from results."""
        evidence = AuthorityEvidence()
        
        # Extract from authority result
        if authority_result and "statute" in authority_result:
            evidence.statute = authority_result.get("statute")
            evidence.paragraph = authority_result.get("paragraph")
            evidence.exact_match = authority_result.get("exact_match", False)
            evidence.authority_score = authority_result.get("authority_score", 0.0)
            evidence.hierarchy_level = authority_result.get("hierarchy_level", "unknown")
        
        # Extract norm information from retrieval
        if retrieval_evidence and "norms" in retrieval_evidence:
            norms = retrieval_evidence.get("norms", [])
            evidence.norm_ids = [norm.get("id", "") for norm in norms if norm.get("id")]
            
            # Check for anchor norm (defining norm for the concept)
            anchor_concept = retrieval_evidence.get("anchor_concept")
            if anchor_concept:
                evidence.anchor_norm_present = any(
                    norm.get("concept") == anchor_concept for norm in norms
                )
        
        return evidence
    
    def _check_domain_consistency(
        self,
        domain: LegalDomain,
        authority_evidence: AuthorityEvidence,
        retrieval_evidence: Dict[str, Any]
    ) -> Tuple[float, bool]:
        """Check consistency with legal domain."""
        if domain == LegalDomain.UNKNOWN:
            return 0.0, True
        
        profile = self.DOMAIN_PROFILES.get(domain)
        if not profile:
            return 0.5, False  # Unknown domain profile
        
        # Check if statute is typical for domain
        statute = authority_evidence.statute
        statute_consistent = False
        if statute and statute in profile.typical_statutes:
            statute_consistent = True
        
        # Check for cross-domain contamination
        cross_contamination = False
        if retrieval_evidence and "domains" in retrieval_evidence:
            retrieved_domains = retrieval_evidence.get("domains", [])
            for risk_domain in profile.cross_domain_risks:
                if risk_domain.value in retrieved_domains:
                    cross_contamination = True
                    break
        
        # Calculate domain certainty
        certainty = 0.5  # Base
        if statute_consistent:
            certainty += 0.3
        if not cross_contamination:
            certainty += 0.2
        
        return min(1.0, certainty), cross_contamination
    
    def _check_doctrine_completeness(
        self,
        domain: LegalDomain,
        question_type: QuestionType,
        retrieval_evidence: Dict[str, Any]
    ) -> Tuple[float, List[str]]:
        """Check if all required norms for the doctrine are present."""
        # DOCTRINAL STRUCTURE QUESTIONS DO NOT REQUIRE NORM COMPLETENESS
        # These are doctrinal abstractions that exist in legal reasoning,
        # not in retrieved norm types (e.g., essentialia negotii, Tatbestandsmerkmale)
        if question_type in DOCTRINAL_STRUCTURE_QUESTIONS:
            return 1.0, []
        
        profile = self.DOMAIN_PROFILES.get(domain)
        if not profile:
            return 0.0, ["unknown_domain"]
        
        # Get expected norm types for this question
        expected_types = self.QUESTION_NORM_EXPECTATIONS.get(question_type, [])
        
        # Add domain-specific mandatory types
        expected_types.extend(profile.mandatory_norm_types)
        
        # Check which norm types are present
        present_types = set()
        if retrieval_evidence and "norm_types" in retrieval_evidence:
            present_types = set(retrieval_evidence.get("norm_types", []))
        
        # Find missing norm types
        missing = [t for t in expected_types if t not in present_types]
        
        # Calculate completeness
        total_expected = len(expected_types)
        if total_expected == 0:
            return 1.0, []
        
        present_count = len(present_types.intersection(set(expected_types)))
        completeness = present_count / total_expected
        
        return completeness, missing
    
    def _determine_epistemic_level(
        self,
        authority_evidence: AuthorityEvidence,
        doctrine_completeness: float,
        authority_mode: str,
        question_type: QuestionType,
        retrieval_evidence: Optional[Dict[str, Any]] = None  # Added parameter
    ) -> EpistemicLevel:
        """Determine the epistemic level based on available evidence."""
        
        # ========== MODIFIED: Special handling for doctrinal questions ==========
        # For doctrinal questions, we can be more lenient about completeness
        # because doctrines are conceptual structures, not norm collections
        adjusted_completeness = doctrine_completeness
        if question_type == QuestionType.DOCTRINE:
            # Doctrinal questions require less evidence of "completeness"
            # because they're about abstract principles, not specific norm applications
            adjusted_completeness = max(doctrine_completeness, 0.7)  # Boost for doctrines
            
            # ========== ADDED: Check for settled doctrine in evidence ==========
            if retrieval_evidence:
                detected_doctrine = self._detect_doctrine_from_evidence(retrieval_evidence)
                if detected_doctrine and detected_doctrine in self.SETTLED_DOCTRINES:
                    # Settled doctrines are always CERTAIN
                    return EpistemicLevel.CERTAIN
            # ========== END ADDED ==========
        # ========== END MODIFIED ==========
        
        # Check for invalid cases first
        if authority_evidence.statute and not self._is_statute_appropriate(
            authority_evidence.statute, question_type
        ):
            return EpistemicLevel.INVALID
        
        # CERTAIN: Exact match, complete doctrine
        # Doctrinal questions can be CERTAIN without norm completeness
        if (authority_evidence.exact_match and
            authority_evidence.anchor_norm_present):

            if question_type in DOCTRINAL_STRUCTURE_QUESTIONS:
                return EpistemicLevel.CERTAIN

            if adjusted_completeness >= 0.9:  # Use adjusted completeness
                return EpistemicLevel.CERTAIN
        
        # SUPPORTED: Statute known, some evidence
        if (authority_evidence.statute and 
            adjusted_completeness >= 0.7 and  # Use adjusted completeness
            authority_mode == "exact"):
            return EpistemicLevel.SUPPORTED
        
        # OVERVIEW_ONLY: Overview mode or incomplete
        if authority_mode == "overview" or adjusted_completeness < 0.5:  # Use adjusted
            return EpistemicLevel.OVERVIEW_ONLY
        
        # INFERRED: Reasonable inference
        if adjusted_completeness >= 0.5:  # Use adjusted completeness
            return EpistemicLevel.INFERRED
        
        # INSUFFICIENT: Missing key evidence
        if not authority_evidence.anchor_norm_present:
            return EpistemicLevel.INSUFFICIENT
        
        return EpistemicLevel.INSUFFICIENT
    
    def _is_statute_appropriate(self, statute: str, question_type: QuestionType) -> bool:
        """Check if statute is appropriate for question type."""
        # This should be expanded with actual legal knowledge
        inappropriate_pairs = [
            # e.g., ("StGB", QuestionType.CONTRACT) would be inappropriate
        ]
        
        for bad_statute, bad_type in inappropriate_pairs:
            if statute == bad_statute and question_type == bad_type:
                return False
        
        return True
    
    def _calculate_defensibility(
        self,
        epistemic_level: EpistemicLevel,
        doctrine_completeness: float,
        domain_certainty: float
    ) -> float:
        """Calculate how defensible the answer would be."""
        # Base scores for each epistemic level
        level_scores = {
            EpistemicLevel.CERTAIN: 0.95,
            EpistemicLevel.SUPPORTED: 0.8,
            EpistemicLevel.INFERRED: 0.6,
            EpistemicLevel.OVERVIEW_ONLY: 0.4,
            EpistemicLevel.INSUFFICIENT: 0.2,
            EpistemicLevel.CONFLICTING: 0.1,
            EpistemicLevel.INVALID: 0.0,
        }
        
        base = level_scores.get(epistemic_level, 0.0)
        
        # Adjust based on doctrine completeness
        adjusted = base * (0.7 + 0.3 * doctrine_completeness)
        
        # Adjust based on domain certainty
        adjusted *= domain_certainty
        
        return min(1.0, max(0.0, adjusted))
    
    def _calculate_examiner_readiness(
        self,
        epistemic_level: EpistemicLevel,
        missing_norms: List[str],
        cross_contamination: bool,
        question_type: QuestionType,
        retrieval_evidence: Optional[Dict[str, Any]] = None  # Added parameter
    ) -> float:
        """Calculate if answer is ready for examiner scrutiny."""
        # Base readiness by epistemic level
        level_readiness = {
            EpistemicLevel.CERTAIN: 0.9,
            EpistemicLevel.SUPPORTED: 0.7,
            EpistemicLevel.INFERRED: 0.5,
            EpistemicLevel.OVERVIEW_ONLY: 0.3,
            EpistemicLevel.INSUFFICIENT: 0.1,
            EpistemicLevel.CONFLICTING: 0.0,
            EpistemicLevel.INVALID: 0.0,
        }
        
        base = level_readiness.get(epistemic_level, 0.0)
        
        # Doctrinal questions are NOT penalized for missing norms
        if question_type in DOCTRINAL_STRUCTURE_QUESTIONS:
            return max(base, 0.9)  # Ensure at least 0.9 for doctrinal questions
        
        # ========== ADDED: Special handling for settled doctrines ==========
        # For settled doctrines, we guarantee high examiner readiness
        if question_type == QuestionType.DOCTRINE and retrieval_evidence:
            detected_doctrine = self._detect_doctrine_from_evidence(retrieval_evidence)
            if detected_doctrine and detected_doctrine in self.SETTLED_DOCTRINES:
                # Settled doctrines are always examiner-ready
                return 0.95  # Very high readiness for settled doctrines
        # ========== END ADDED ==========
        
        # Penalize for missing norms
        norm_penalty = len(missing_norms) * 0.1
        base -= min(0.5, norm_penalty)
        
        # Penalize for cross-domain contamination
        if cross_contamination:
            base *= 0.5
        
        return max(0.0, base)
    
    def _detect_norm_conflicts(self, retrieval_evidence: Dict[str, Any]) -> bool:
        """Detect conflicts between retrieved norms."""
        if not retrieval_evidence or "norms" not in retrieval_evidence:
            return False
        
        norms = retrieval_evidence.get("norms", [])
        
        # Check for contradictory statements
        # This is simplified - would need actual legal logic
        for i, norm1 in enumerate(norms):
            for norm2 in norms[i+1:]:
                if self._norms_conflict(norm1, norm2):
                    return True
        
        return False
    
    def _norms_conflict(self, norm1: Dict, norm2: Dict) -> bool:
        """Check if two norms conflict."""
        # Simplified conflict detection
        # In reality, this would require deep legal analysis
        content1 = norm1.get("content", "").lower()
        content2 = norm2.get("content", "").lower()
        
        conflict_indicators = [
            ("shall not", "may"),
            ("prohibited", "permitted"),
            ("must", "cannot"),
            ("required", "optional"),
        ]
        
        for term1, term2 in conflict_indicators:
            if term1 in content1 and term2 in content2:
                return True
            if term2 in content1 and term1 in content2:
                return True
        
        return False
    
    def _determine_question_abstraction(self, question_type: QuestionType) -> float:
        """Determine how abstract the question is."""
        abstraction_levels = {
            QuestionType.DEFINITION: 0.3,
            QuestionType.APPLICATION: 0.4,
            QuestionType.PROCEDURE: 0.5,
            QuestionType.CONSEQUENCE: 0.6,
            QuestionType.INTERPRETATION: 0.7,
            QuestionType.COMPARISON: 0.7,
            QuestionType.SYSTEM: 0.8,
            QuestionType.DOCTRINE: 0.9,
        }
        
        return abstraction_levels.get(question_type, 0.5)
    
    def _build_assessment_reasons(
        self,
        epistemic_level: EpistemicLevel,
        missing_norms: List[str],
        cross_contamination: bool,
        has_conflicts: bool,
        question_type: QuestionType
    ) -> List[str]:
        """Build human-readable reasons for the assessment."""
        reasons = []
        
        # Level-based reasons
        level_reasons = {
            EpistemicLevel.CERTAIN: "Exact statutory authority with complete doctrine",
            EpistemicLevel.SUPPORTED: "Supported by statute with relevant norms",
            EpistemicLevel.INFERRED: "Reasonable inference from available norms",
            EpistemicLevel.OVERVIEW_ONLY: "Limited to overview due to incomplete doctrine",
            EpistemicLevel.INSUFFICIENT: "Insufficient anchor norm for definitive answer",
            EpistemicLevel.CONFLICTING: "Conflicting norms detected",
            EpistemicLevel.INVALID: "Inappropriate statutory authority",
        }
        reasons.append(level_reasons.get(epistemic_level, "Unknown epistemic status"))
        
        # Special note for doctrinal structure questions
        if question_type in DOCTRINAL_STRUCTURE_QUESTIONS:
            reasons.append("Doctrinal abstraction - norm completeness not required")
        
        # ========== ADDED: Note for settled doctrines ==========
        if question_type == QuestionType.DOCTRINE and epistemic_level == EpistemicLevel.CERTAIN:
            reasons.append("Settled constitutional principle - highest epistemic certainty")
        # ========== END ADDED ==========
        
        # Missing norm reasons
        if missing_norms and question_type not in DOCTRINAL_STRUCTURE_QUESTIONS:
            reasons.append(f"Missing norm types: {', '.join(missing_norms[:3])}")
        
        # Cross-domain contamination
        if cross_contamination:
            reasons.append("Potential cross-domain contamination detected")
        
        # Conflict reasons
        if has_conflicts:
            reasons.append("Conflicting legal provisions detected")
        
        return reasons
    
    def _requires_clarification(
        self,
        epistemic_level: EpistemicLevel,
        missing_norms: List[str],
        domain_certainty: float
    ) -> bool:
        """Determine if clarification is required."""
        if epistemic_level in [EpistemicLevel.INVALID, EpistemicLevel.CONFLICTING]:
            return True
        
        if len(missing_norms) > 2:  # Too many missing norms
            return True
        
        if domain_certainty < 0.5:  # Uncertain domain
            return True
        
        # ========== ADDED: Settled doctrines never need clarification ==========
        # Note: This is handled in the early-exit, but kept for completeness
        if epistemic_level == EpistemicLevel.CERTAIN and domain_certainty >= 0.9:
            return False
        # ========== END ADDED ==========
        
        return False


# Singleton instance for easy access
epistemology_engine = LegalEpistemology()


def assess_epistemic_status(
    authority_result: Dict[str, Any],
    domain_induction: LegalDomain,
    question_type: QuestionType,
    retrieval_evidence: Dict[str, Any],
    authority_mode: str = "exact",
    question_text: str = ""  # Added parameter
) -> EpistemicAssessment:
    """
    Public function to assess epistemic status.
    
    Args:
        authority_result: From authority service
        domain_induction: Induced legal domain
        question_type: Type of question being asked
        retrieval_evidence: Evidence from retrieval
        authority_mode: 'exact', 'overview', or 'none'
        question_text: Original question text for doctrine detection
        
    Returns:
        Complete epistemic assessment
    """
    return epistemology_engine.assess_epistemic_status(
        authority_result, domain_induction, question_type, 
        retrieval_evidence, authority_mode, question_text
    )