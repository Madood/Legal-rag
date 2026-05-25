"""
Domain Confidence
================
Calculates and validates confidence in domain detection.
Separates confidence logic from detection logic.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import re

@dataclass
class ConfidenceMetrics:
    """Structured confidence metrics."""
    base_confidence: float = 0.0
    reinforcement_factor: float = 0.0
    conflict_penalty: float = 0.0
    final_confidence: float = 0.0
    factors: List[str] = None
    
    def __post_init__(self):
        if self.factors is None:
            self.factors = []


class DomainConfidence:
    """Calculate and validate domain detection confidence."""
    
    def __init__(self, profiles):
        """
        Args:
            profiles: DomainProfiles instance
        """
        self.profiles = profiles
        self.log_prefix = "[DomainConfidence]"
    
    def calculate_confidence(self, 
                           question: str, 
                           detected_domain: str,
                           detection_method: str,
                           detection_details: Dict[str, Any]) -> ConfidenceMetrics:
        """
        Calculate comprehensive confidence for domain detection.
        
        Args:
            question: Original question
            detected_domain: Detected domain
            detection_method: How domain was detected
            detection_details: Additional detection details
            
        Returns:
            ConfidenceMetrics with calculated confidence
        """
        metrics = ConfidenceMetrics()
        factors = []
        
        # 1. Base confidence from detection method
        base_confidence = self._get_base_confidence(detection_method)
        metrics.base_confidence = base_confidence
        factors.append(f"method_{detection_method}:{base_confidence:.2f}")
        
        # 2. Question complexity penalty
        complexity_factor = self._assess_question_complexity(question)
        if complexity_factor < 1.0:
            base_confidence *= complexity_factor
            factors.append(f"complexity_penalty:{complexity_factor:.2f}")
        
        # 3. Content reinforcement (if content available)
        if 'content' in detection_details:
            reinforcement = self._reinforce_from_content(
                detection_details['content'], 
                detected_domain
            )
            metrics.reinforcement_factor = reinforcement
            if reinforcement > 0:
                # Cap reinforcement boost at 0.2
                boost = min(reinforcement * 0.3, 0.2)
                base_confidence = min(base_confidence + boost, 1.0)
                factors.append(f"content_reinforcement:{reinforcement:.2f}")
        
        # 4. Multiple evidence boost
        if 'all_matches' in detection_details:
            match_count = detection_details['all_matches']
            if match_count > 1:
                boost = min((match_count - 1) * 0.05, 0.15)
                base_confidence = min(base_confidence + boost, 1.0)
                factors.append(f"multiple_evidence:{match_count}")
        
        # 5. Domain specificity boost
        domain_weight = self.profiles.domains.get(detected_domain, {}).get('weight', 1.0)
        if domain_weight > 1.0:
            base_confidence = min(base_confidence * 1.1, 1.0)
            factors.append("domain_specificity_boost")
        
        # 6. Check for conflicts
        conflict_penalty = self._check_domain_conflicts(question, detected_domain)
        metrics.conflict_penalty = conflict_penalty
        if conflict_penalty > 0:
            base_confidence *= (1.0 - conflict_penalty)
            factors.append(f"conflict_penalty:{conflict_penalty:.2f}")
        
        # 7. Validate against domain profiles
        if not self.profiles.validate_domain(detected_domain):
            base_confidence *= 0.7
            factors.append("invalid_domain_penalty")
        
        # 8. Final confidence with sanity checks
        final_confidence = max(0.0, min(1.0, base_confidence))
        metrics.final_confidence = final_confidence
        metrics.factors = factors
        
        print(f'[STAT] {self.log_prefix} Confidence: {final_confidence:.2f} for {detected_domain}')
        
        return metrics
    
    def validate_detection(self, 
                          question: str, 
                          domain_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate domain detection with comprehensive checks.
        
        Args:
            question: Original question
            domain_result: Domain detection result
            
        Returns:
            Validation result with confidence and warnings
        """
        detected_domain = domain_result.get('domain')
        confidence = domain_result.get('confidence', 0.0)
        
        validation = {
            'is_valid': False,
            'confidence': confidence,
            'warnings': [],
            'suggestions': [],
            'validation_score': 0.0
        }
        
        if not detected_domain:
            validation['warnings'].append('No domain detected')
            return validation
        
        # Domain exists in profiles
        if not self.profiles.validate_domain(detected_domain):
            validation['warnings'].append(f'Unknown domain: {detected_domain}')
            confidence *= 0.5
        
        # Check if statute suggestions align with domain
        candidate_statutes = domain_result.get('candidate_statutes', [])
        if candidate_statutes:
            primary_statute = self.profiles.get_primary_statute(detected_domain)
            if primary_statute and primary_statute not in candidate_statutes:
                validation['suggestions'].append(
                    f'Consider adding primary statute {primary_statute}'
                )
        
        # Check for mixed domains in question
        mixed_domains = self._detect_mixed_domains(question)
        if len(mixed_domains) > 1 and detected_domain in mixed_domains:
            validation['warnings'].append(
                f'Multiple domains detected: {", ".join(mixed_domains)}'
            )
            # If we have a primary detection but multiple domains exist
            if len(mixed_domains) > 1:
                confidence *= 0.8
        
        # Score calculation
        score = confidence
        if not validation['warnings']:
            score *= 1.1  # Bonus for no warnings
        score = min(score, 1.0)
        
        validation['is_valid'] = score >= 0.5
        validation['confidence'] = confidence
        validation['validation_score'] = score
        
        return validation
    
    def _get_base_confidence(self, method: str) -> float:
        """Get base confidence based on detection method."""
        method_confidence = {
            'explicit_statute': 0.95,
            'offense_detection': 0.90,
            'paragraph_inference': 0.85,
            'term_detection': 0.80,
            'field_indicator': 0.75,
            'fallback': 0.10,
            'none': 0.05
        }
        return method_confidence.get(method, 0.50)
    
    def _assess_question_complexity(self, question: str) -> float:
        """Assess question complexity and apply penalty."""
        words = question.split()
        
        # Very short questions are ambiguous
        if len(words) < 3:
            return 0.8
        
        # Very long questions might be complex
        if len(words) > 50:
            return 0.9
        
        # Check for multiple question marks
        if question.count('?') > 1:
            return 0.85
        
        # Check for conjunction words (multiple topics)
        conjunctions = ['und', 'oder', 'sowie', 'sowohl', 'als auch', 'außer']
        conjunction_count = sum(1 for conj in conjunctions if conj in question.lower())
        if conjunction_count > 1:
            return 0.8
        
        return 1.0
    
    def _reinforce_from_content(self, content: str, expected_domain: str) -> float:
        """Reinforce detection confidence from content analysis."""
        if not content:
            return 0.0
        
        lower_content = content.lower()
        indicators = self.profiles.field_indicators.get(expected_domain, [])
        
        matches = 0
        for indicator in indicators:
            if indicator in lower_content:
                matches += 1
        
        # Normalize: 0-1 based on matches (max 3 indicators considered)
        return min(matches / 3, 1.0)
    
    def _check_domain_conflicts(self, question: str, detected_domain: str) -> float:
        """Check for conflicting domain signals in question."""
        lower_question = question.lower()
        conflict_penalty = 0.0
        
        # Check for terms from other domains
        domain_terms = {}
        for term, domain in self.profiles.term_to_domain.items():
            if term in lower_question:
                if domain not in domain_terms:
                    domain_terms[domain] = 0
                domain_terms[domain] += 1
        
        # If multiple domains detected
        if len(domain_terms) > 1:
            # Check if detected domain is not the most frequent
            if detected_domain in domain_terms:
                detected_count = domain_terms[detected_domain]
                max_count = max(domain_terms.values())
                
                if detected_count < max_count:
                    # Penalty based on how much less frequent
                    penalty = (max_count - detected_count) * 0.1
                    conflict_penalty = min(penalty, 0.3)
            else:
                # Detected domain not in term matches at all
                conflict_penalty = 0.2
        
        return conflict_penalty
    
    def _detect_mixed_domains(self, question: str) -> List[str]:
        """Detect multiple domains mentioned in question."""
        lower_question = question.lower()
        domains_found = set()
        
        # Check terms
        for term, domain in self.profiles.term_to_domain.items():
            if term in lower_question:
                domains_found.add(domain)
        
        # Check statutes
        statute_patterns = ['stgb', 'bgb', 'hgb', 'gg', 'dsgvo']
        statute_to_domain = {
            'stgb': 'criminal',
            'bgb': 'civil',
            'hgb': 'commercial',
            'gg': 'constitutional',
            'dsgvo': 'data_protection'
        }
        
        for statute in statute_patterns:
            pattern = r'\b' + re.escape(statute) + r'\b'
            if re.search(pattern, lower_question):
                domains_found.add(statute_to_domain.get(statute, 'unknown'))
        
        return list(domains_found)
    
    def generate_confidence_report(self, 
                                 question: str, 
                                 domain_result: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive confidence report."""
        confidence_metrics = self.calculate_confidence(
            question=question,
            detected_domain=domain_result.get('domain'),
            detection_method=domain_result.get('method', 'none'),
            detection_details=domain_result.get('details', {})
        )
        
        validation = self.validate_detection(question, domain_result)
        
        return {
            'domain': domain_result.get('domain'),
            'original_confidence': domain_result.get('confidence', 0.0),
            'calculated_confidence': confidence_metrics.final_confidence,
            'validation_score': validation['validation_score'],
            'is_high_confidence': confidence_metrics.final_confidence >= 0.8,
            'is_valid': validation['is_valid'],
            'warnings': validation['warnings'],
            'suggestions': validation['suggestions'],
            'confidence_breakdown': {
                'base': confidence_metrics.base_confidence,
                'reinforcement': confidence_metrics.reinforcement_factor,
                'penalty': confidence_metrics.conflict_penalty,
                'final': confidence_metrics.final_confidence,
                'factors': confidence_metrics.factors
            },
            'recommendation': self._get_recommendation(confidence_metrics.final_confidence)
        }
    
    def _get_recommendation(self, confidence: float) -> str:
        """Get recommendation based on confidence level."""
        if confidence >= 0.9:
            return "High confidence - proceed with domain-specific processing"
        elif confidence >= 0.7:
            return "Moderate confidence - proceed but consider verification"
        elif confidence >= 0.5:
            return "Low confidence - recommend human review or broader search"
        else:
            return "Very low confidence - use general domain or request clarification"


# Singleton instance
_domain_confidence_instance = None

def get_domain_confidence():
    """Get singleton DomainConfidence instance."""
    global _domain_confidence_instance
    if _domain_confidence_instance is None:
        from .domain_profiles import domain_profiles
        _domain_confidence_instance = DomainConfidence(domain_profiles)
    return _domain_confidence_instance

domain_confidence = get_domain_confidence()