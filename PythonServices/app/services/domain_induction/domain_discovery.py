"""
Domain Discovery
================
Core logic for detecting legal domain from question text.
Direct conversion from legalFieldDetector.js with architectural improvements.
"""

import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

@dataclass
class DomainResult:
    """Standardized domain detection result."""
    domain: Optional[str] = None
    candidate_statutes: List[str] = None
    confidence: float = 0.0
    method: str = "none"
    details: Dict[str, Any] = None
    offense: Optional[str] = None
    severity: Optional[str] = None
    
    def __post_init__(self):
        if self.candidate_statutes is None:
            self.candidate_statutes = []
        if self.details is None:
            self.details = {}


class DomainDiscovery:
    """Main domain detection logic."""
    
    def __init__(self, profiles):
        """
        Args:
            profiles: DomainProfiles instance
        """
        self.profiles = profiles
        self.log_prefix = "[DomainDiscovery]"
        print(f'✅ DomainDiscovery initialized with {len(profiles.domain_mappings)} domains')
    
    def detect_domain(self, question: str) -> DomainResult:
        """
        Detect legal domain from question text.
        
        Args:
            question: User's legal question
            
        Returns:
            DomainResult with detection details
        """
        if not question or not isinstance(question, str):
            return DomainResult(
                details={"error": "Invalid question input"}
            )
        
        lower_question = question.lower().strip()
        
        print(f'🔍 {self.log_prefix} Analyzing: "{question[:80]}{"..." if len(question) > 80 else ""}"')
        
        # Detection pipeline - ordered by confidence
        detection_steps = [
            self._detect_explicit_statute,
            self._detect_offense,
            self._detect_legal_terms,
            self._infer_from_paragraph,
        ]
        
        for step in detection_steps:
            result = step(lower_question, question)
            if result and result.confidence > 0.7:  # High confidence threshold
                return result
        
        # Fallback: check for field indicators
        field_result = self._check_field_indicators(lower_question)
        if field_result:
            return field_result
        
        # No domain detected
        print(f'❌ {self.log_prefix} No domain detected')
        return DomainResult(
            domain="general",
            candidate_statutes=[],
            confidence=0.1,
            method="fallback",
            details={"reason": "No specific domain detected, using general"}
        )
    
    def _detect_explicit_statute(self, lower_question: str, original_question: str) -> Optional[DomainResult]:
        """Detect explicit statute abbreviations."""
        statute_mapping = {
            'stgb': ('criminal', 'StGB'),
            'bgb': ('civil', 'BGB'),
            'hgb': ('commercial', 'HGB'),
            'gg': ('constitutional', 'GG'),
            'dsgvo': ('data_protection', 'EU-GDPR'),
            'gdpr': ('data_protection', 'EU-GDPR'),
            'stpo': ('criminal_procedure', 'StPO'),
            'zpo': ('civil_procedure', 'ZPO'),
            'gmbhg': ('company_law', 'GMBHG'),
        }
        
        for statute_key, (domain, statute) in statute_mapping.items():
            # Look for standalone statute references
            pattern = r'\b' + re.escape(statute_key) + r'\b'
            if re.search(pattern, lower_question):
                print(f'📚 {self.log_prefix} Explicit statute: {statute_key.upper()} → {domain}')
                return DomainResult(
                    domain=domain,
                    candidate_statutes=[statute],
                    confidence=0.95,
                    method="explicit_statute",
                    details={
                        "matched_statute": statute_key.upper(),
                        "position": lower_question.find(statute_key)
                    }
                )
        
        return None
    
    def _detect_offense(self, lower_question: str, original_question: str) -> Optional[DomainResult]:
        """Detect specific criminal offenses."""
        for offense_name, offense_data in self.profiles.offense_mappings.items():
            # Check both German and English offense names
            offense_terms = [offense_name]
            if 'german_terms' in offense_data:
                offense_terms.extend(offense_data['german_terms'])
            
            for term in offense_terms:
                pattern = r'\b' + re.escape(term.lower()) + r'\b'
                if re.search(pattern, lower_question):
                    print(f'⚖️  {self.log_prefix} Detected offense: {offense_name}')
                    
                    # Get primary statute from offense mapping
                    primary_statute = offense_data.get('primary_statute')
                    statutes = offense_data.get('statutes', [])
                    
                    return DomainResult(
                        domain=offense_data['field'],
                        candidate_statutes=statutes if statutes else [primary_statute] if primary_statute else [],
                        confidence=0.9,
                        method="offense_detection",
                        offense=offense_name,
                        severity=offense_data.get('severity'),
                        details={
                            "offense": offense_name,
                            "matched_term": term,
                            "statutes": statutes
                        }
                    )
        
        return None
    
    def _detect_legal_terms(self, lower_question: str, original_question: str) -> Optional[DomainResult]:
        """Detect domain from legal terminology."""
        term_matches = []
        
        for term, domain in self.profiles.term_to_domain.items():
            pattern = r'\b' + re.escape(term) + r'\b'
            match = re.search(pattern, lower_question)
            if match:
                term_matches.append({
                    'term': term,
                    'domain': domain,
                    'position': match.start(),
                    'statute': self.profiles.get_primary_statute(domain)
                })
        
        if term_matches:
            # Sort by position (earlier terms are more significant)
            term_matches.sort(key=lambda x: x['position'])
            primary_match = term_matches[0]
            
            print(f'📝 {self.log_prefix} Legal term match: "{primary_match["term"]}" → {primary_match["domain"]}')
            
            statute = primary_match['statute']
            return DomainResult(
                domain=primary_match['domain'],
                candidate_statutes=[statute] if statute else [],
                confidence=0.8,
                method="term_detection",
                details={
                    "matched_term": primary_match['term'],
                    "position": primary_match['position'],
                    "all_matches": len(term_matches)
                }
            )
        
        return None
    
    def _infer_from_paragraph(self, lower_question: str, original_question: str) -> Optional[DomainResult]:
        """Infer domain from paragraph number ranges."""
        # Look for § symbol with number
        para_patterns = [
            r'§\s*(\d+)[a-z]?',  # § 123, § 123a
            r'paragraph\s*(\d+)',  # Paragraph 123
            r'par\s*\.?\s*(\d+)',  # Par. 123
        ]
        
        for pattern in para_patterns:
            matches = re.finditer(pattern, original_question, re.IGNORECASE)
            for match in matches:
                try:
                    para_num = int(match.group(1))
                    
                    # Check known paragraph ranges
                    domain_range = self.profiles.get_domain_from_paragraph(para_num)
                    if domain_range:
                        domain, statute = domain_range
                        print(f'📊 {self.log_prefix} Paragraph inference: §{para_num} → {domain}')
                        
                        return DomainResult(
                            domain=domain,
                            candidate_statutes=[statute],
                            confidence=0.85,
                            method="paragraph_inference",
                            details={
                                "paragraph": para_num,
                                "match": match.group(0),
                                "range": self.profiles.paragraph_ranges.get(statute, {})
                            }
                        )
                except ValueError:
                    continue
        
        return None
    
    def _check_field_indicators(self, lower_question: str) -> Optional[DomainResult]:
        """Check for domain-specific phrases/indicators."""
        for domain, indicators in self.profiles.field_indicators.items():
            for indicator in indicators:
                if indicator in lower_question:
                    statute = self.profiles.get_primary_statute(domain)
                    print(f'🎯 {self.log_prefix} Field indicator: "{indicator}" → {domain}')
                    
                    return DomainResult(
                        domain=domain,
                        candidate_statutes=[statute] if statute else [],
                        confidence=0.75,
                        method="field_indicator",
                        details={
                            "indicator": indicator,
                            "domain": domain
                        }
                    )
        
        return None
    
    def get_domain_display_name(self, domain: str) -> str:
        """Get German display name for domain."""
        return self.profiles.get_domain_display_name(domain)
    
    def get_statute_display_name(self, statute: str) -> str:
        """Get German display name for statute."""
        return self.profiles.get_statute_display_name(statute)


# Singleton instance (will be initialized after DomainProfiles)
_domain_discovery_instance = None

def get_domain_discovery():
    """Get singleton DomainDiscovery instance."""
    global _domain_discovery_instance
    if _domain_discovery_instance is None:
        from .domain_profiles import domain_profiles
        _domain_discovery_instance = DomainDiscovery(domain_profiles)
    return _domain_discovery_instance

domain_discovery = get_domain_discovery()