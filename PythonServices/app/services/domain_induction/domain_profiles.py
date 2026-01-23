"""
Domain Profiles
===============
Central repository for domain definitions, mappings, and configurations.
Separates data from logic for maintainability.
"""

from typing import Dict, List, Optional, Tuple, Any

class DomainProfiles:
    """Central profiles and mappings for legal domains."""
    
    def __init__(self):
        # Core domain definitions
        self.domains = {
            'criminal': {
                'display_name': 'Strafrecht',
                'primary_statute': 'StGB',
                'description': 'Strafgesetzbuch und strafrechtliche Materien',
                'weight': 1.0
            },
            'civil': {
                'display_name': 'Zivilrecht',
                'primary_statute': 'BGB',
                'description': 'Bürgerliches Gesetzbuch und zivilrechtliche Materien',
                'weight': 1.0
            },
            'commercial': {
                'display_name': 'Handelsrecht',
                'primary_statute': 'HGB',
                'description': 'Handelsgesetzbuch und handelsrechtliche Materien',
                'weight': 1.0
            },
            'constitutional': {
                'display_name': 'Verfassungsrecht',
                'primary_statute': 'GG',
                'description': 'Grundgesetz und verfassungsrechtliche Materien',
                'weight': 1.0
            },
            'data_protection': {
                'display_name': 'Datenschutzrecht',
                'primary_statute': 'EU-GDPR',
                'description': 'Datenschutz-Grundverordnung und Datenschutzrecht',
                'weight': 1.0
            },
            'general': {
                'display_name': 'Allgemeines Recht',
                'primary_statute': None,
                'description': 'Allgemeine Rechtsfragen ohne spezifische Domäne',
                'weight': 0.5
            }
        }
        
        # Legal term to domain mapping
        self.term_to_domain = {
            # Criminal law (StGB)
            'strafbar': 'criminal',
            'freiheitsstrafe': 'criminal',
            'geldstrafe': 'criminal',
            'mord': 'criminal',
            'diebstahl': 'criminal',
            'betrug': 'criminal',
            'körperverletzung': 'criminal',
            'landesverrat': 'criminal',
            'staatsgeheimnis': 'criminal',
            'schuld': 'criminal',
            'schuldunfähigkeit': 'criminal',
            'straftat': 'criminal',
            'verbrechen': 'criminal',
            'vergehen': 'criminal',
            
            # Constitutional law (GG)
            'grundgesetz': 'constitutional',
            'grundrecht': 'constitutional',
            'verfassung': 'constitutional',
            'meinungsfreiheit': 'constitutional',
            'versammlungsfreiheit': 'constitutional',
            'eigentumsgarantie': 'constitutional',
            'menschenwürde': 'constitutional',
            'bundesverfassungsgericht': 'constitutional',
            'verfassungsbeschwerde': 'constitutional',
            'verfassungsmäßig': 'constitutional',
            
            # Commercial law (HGB)
            'kaufmann': 'commercial',
            'handelsregister': 'commercial',
            'prokura': 'commercial',
            'firma': 'commercial',
            'handelsvertreter': 'commercial',
            'kommission': 'commercial',
            'spedition': 'commercial',
            'lagergeschäft': 'commercial',
            'handelsgeschäft': 'commercial',
            'handelsbrauch': 'commercial',
            'handelsrecht': 'commercial',
            'gesellschaft': 'commercial',
            
            # Civil law (BGB)
            'vertrag': 'civil',
            'kauf': 'civil',
            'miete': 'civil',
            'werkvertrag': 'civil',
            'dienstvertrag': 'civil',
            'schadensersatz': 'civil',
            'eigentum': 'civil',
            'besitz': 'civil',
            'anspruch': 'civil',
            'verjährung': 'civil',
            'willenserklärung': 'civil',
            'geschäftsfähigkeit': 'civil',
            'haftung': 'civil',
            
            # Data protection (GDPR)
            'datenschutz': 'data_protection',
            'personenbezogen': 'data_protection',
            'einwilligung': 'data_protection',
            'datensicherheit': 'data_protection',
            'datenschutzbeauftragter': 'data_protection',
            'betroffenenrechte': 'data_protection',
            'datenschutzfolgenabschätzung': 'data_protection',
            'datenschutzerklärung': 'data_protection',
            'datenschutzgrundverordnung': 'data_protection',
        }
        
        # Offense to domain mapping
        self.offense_mappings = {
            'espionage': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['spionage', 'landesverrat'],
                'severity': 'severe',
                'paragraphs': ['§ 94', '§ 95', '§ 96']
            },
            'fraud': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['betrug'],
                'severity': 'medium',
                'paragraphs': ['§ 263']
            },
            'theft': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['diebstahl'],
                'severity': 'medium',
                'paragraphs': ['§ 242', '§ 243']
            },
            'murder': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['mord', 'totschlag'],
                'severity': 'severe',
                'paragraphs': ['§ 211', '§ 212']
            },
            'robbery': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['raub'],
                'severity': 'severe',
                'paragraphs': ['§ 249', '§ 250']
            },
            'assault': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['körperverletzung'],
                'severity': 'medium',
                'paragraphs': ['§ 223', '§ 224']
            },
            'insider trading': {
                'field': 'commercial',
                'primary_statute': 'WpHG',
                'statutes': ['WpHG'],
                'german_terms': ['insidergeschäfte', 'insiderhandel'],
                'severity': 'medium',
                'paragraphs': ['§ 38']
            }
        }
        
        # Field indicators (domain-specific phrases)
        self.field_indicators = {
            'criminal': [
                'ist strafbar nach',
                'wird mit freiheitsstrafe bestraft',
                'wird mit geldstrafe bestraft',
                'begeht eine straftat',
                'wird verfolgt nach',
                'strafrechtlich relevant',
                'unter strafe gestellt',
            ],
            'civil': [
                'hat anspruch auf',
                'ist verpflichtet zu',
                'muss schadensersatz leisten',
                'kann vom vertrag zurücktreten',
                'ist zur zahlung verpflichtet',
                'zivilrechtliche haftung',
                'vertraglich vereinbart',
            ],
            'commercial': [
                'ist kaufmann im sinne des',
                'muss ins handelsregister eingetragen werden',
                'hat prokura für',
                'als handelsvertreter',
                'nach handelsbrauch',
                'handelsrechtliche vorschriften',
                'unternehmerisch tätig',
            ],
            'constitutional': [
                'grundrecht auf',
                'garantiert durch artikel',
                'verfassungsrechtlich geschützt',
                'verstoß gegen das grundgesetz',
                'bundesverfassungsgericht entschied',
                'verfassungsmäßige ordnung',
                'grundgesetzlich garantiert',
            ],
            'data_protection': [
                'datenschutzrechtlich zulässig',
                'einwilligung des betroffenen',
                'datenschutzkonform',
                'gemäß datenschutz-grundverordnung',
                'datenschutzbeauftragter muss',
                'betroffenenrechte gemäß',
                'datenschutzfolgenabschätzung durchführen',
            ]
        }
        
        # Paragraph number ranges for statutes
        self.paragraph_ranges = {
            'StGB': {'start': 1, 'end': 358, 'domain': 'criminal'},
            'BGB': {'start': 1, 'end': 2385, 'domain': 'civil'},
            'HGB': {'start': 1, 'end': 372, 'domain': 'commercial'},
            'GG': {'start': 1, 'end': 146, 'domain': 'constitutional'},
            'StPO': {'start': 1, 'end': 477, 'domain': 'criminal_procedure'},
            'ZPO': {'start': 1, 'end': 1066, 'domain': 'civil_procedure'},
        }
        
        # Statute display names
        self.statute_display_names = {
            'StGB': 'Strafgesetzbuch',
            'BGB': 'Bürgerliches Gesetzbuch',
            'HGB': 'Handelsgesetzbuch',
            'GG': 'Grundgesetz',
            'EU-GDPR': 'EU-Datenschutz-Grundverordnung',
            'StPO': 'Strafprozessordnung',
            'ZPO': 'Zivilprozessordnung',
            'WpHG': 'Wertpapierhandelsgesetz',
        }
        
        print(f'✅ DomainProfiles initialized: {len(self.domains)} domains, {len(self.term_to_domain)} terms')
    
    # Property accessors
    @property
    def domain_mappings(self) -> Dict[str, str]:
        """Get reverse domain to statute mapping."""
        return {
            domain: data['primary_statute']
            for domain, data in self.domains.items()
            if data['primary_statute']
        }
    
    # Public methods
    def get_primary_statute(self, domain: str) -> Optional[str]:
        """Get primary statute for a domain."""
        domain_info = self.domains.get(domain)
        return domain_info.get('primary_statute') if domain_info else None
    
    def get_domain_display_name(self, domain: str) -> str:
        """Get German display name for domain."""
        domain_info = self.domains.get(domain)
        return domain_info.get('display_name', domain) if domain_info else domain
    
    def get_statute_display_name(self, statute: str) -> str:
        """Get German display name for statute."""
        return self.statute_display_names.get(statute, statute)
    
    def get_domain_from_paragraph(self, paragraph: int) -> Optional[Tuple[str, str]]:
        """Get domain and statute from paragraph number."""
        for statute, range_info in self.paragraph_ranges.items():
            if range_info['start'] <= paragraph <= range_info['end']:
                return (range_info['domain'], statute)
        return None
    
    def get_domain_info(self, domain: str) -> Dict[str, Any]:
        """Get complete domain information."""
        return self.domains.get(domain, {}).copy()
    
    def list_domains(self) -> List[str]:
        """List all available domains."""
        return list(self.domains.keys())
    
    def list_statutes(self) -> List[str]:
        """List all known statutes."""
        return list(self.statute_display_names.keys())
    
    def validate_domain(self, domain: str) -> bool:
        """Check if domain is valid."""
        return domain in self.domains
    
    def add_custom_term(self, term: str, domain: str) -> bool:
        """Add custom term mapping."""
        if domain not in self.domains:
            return False
        
        self.term_to_domain[term.lower()] = domain
        return True
    
    def add_custom_offense(self, offense: str, data: Dict[str, Any]) -> bool:
        """Add custom offense mapping."""
        required_fields = {'field', 'primary_statute'}
        if not all(field in data for field in required_fields):
            return False
        
        self.offense_mappings[offense.lower()] = data
        return True


# Singleton instance
domain_profiles = DomainProfiles()