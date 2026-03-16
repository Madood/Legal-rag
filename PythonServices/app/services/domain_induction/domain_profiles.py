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
            },
            'criminal_procedure': {
                'display_name': 'Strafprozessrecht',
                'primary_statute': 'StPO',
                'description': 'Strafprozessordnung und strafprozessrechtliche Materien',
                'weight': 1.0
            },
            'civil_procedure': {
                'display_name': 'Zivilprozessrecht',
                'primary_statute': 'ZPO',
                'description': 'Zivilprozessordnung und zivilprozessrechtliche Materien',
                'weight': 1.0
            },
            'company_law': {
                'display_name': 'Gesellschaftsrecht',
                'primary_statute': 'GMBHG',
                'description': 'GmbHG und gesellschaftsrechtliche Materien',
                'weight': 1.0
            },
        }
        
        # Legal term to domain mapping
        self.term_to_domain = {
            # Criminal law (StGB)
            'strafbar': 'criminal',
            'freiheitsstrafe': 'criminal',
            'geldstrafe': 'criminal',
            'mord': 'criminal',
            'totschlag': 'criminal',
            'fahrlässige tötung': 'criminal',
            'diebstahl': 'criminal',
            'raub': 'criminal',
            'erpressung': 'criminal',
            'betrug': 'criminal',
            'untreue': 'criminal',
            'hehlerei': 'criminal',
            'körperverletzung': 'criminal',
            'schwere körperverletzung': 'criminal',
            'nötigung': 'criminal',
            'hausfriedensbruch': 'criminal',
            'beleidigung': 'criminal',
            'urkundenfälschung': 'criminal',
            'notwehr': 'criminal',
            'notstand': 'criminal',
            'landesverrat': 'criminal',
            'staatsgeheimnis': 'criminal',
            'schuld': 'criminal',
            'schuldunfähigkeit': 'criminal',
            'straftat': 'criminal',
            'verbrechen': 'criminal',
            'vergehen': 'criminal',
            # English equivalents → criminal (StGB)
            'felony': 'criminal',
            'misdemeanor': 'criminal',
            'self-defense': 'criminal',
            'negligence': 'criminal',
            'intent': 'criminal',
            'murder': 'criminal',
            'theft': 'criminal',

            # Constitutional law (GG)
            'grundgesetz': 'constitutional',
            'grundrecht': 'constitutional',
            'verfassung': 'constitutional',
            'meinungsfreiheit': 'constitutional',
            'pressefreiheit': 'constitutional',
            'versammlungsfreiheit': 'constitutional',
            'eigentumsgarantie': 'constitutional',
            'menschenwürde': 'constitutional',
            'persönlichkeitsrecht': 'constitutional',
            'freie entfaltung': 'constitutional',
            'gleichheit': 'constitutional',
            'gleichheitsgrundsatz': 'constitutional',
            'religionsfreiheit': 'constitutional',
            'gewissensfreiheit': 'constitutional',
            'berufsfreiheit': 'constitutional',
            'rechtsstaat': 'constitutional',
            'sozialstaat': 'constitutional',
            'bundesstaat': 'constitutional',
            'verhältnismäßigkeit': 'constitutional',
            'ewigkeitsklausel': 'constitutional',
            'grundrechtseinschränkung': 'constitutional',
            'bundesverfassungsgericht': 'constitutional',
            'verfassungsbeschwerde': 'constitutional',
            'verfassungsmäßig': 'constitutional',

            # Commercial law (HGB)
            'kaufmann': 'commercial',
            'istkaufmann': 'commercial',
            'handelsregister': 'commercial',
            'prokura': 'commercial',
            'prokurist': 'commercial',
            'firma': 'commercial',
            'handelsvertreter': 'commercial',
            'handelsmakler': 'commercial',
            'handelsbücher': 'commercial',
            'buchführung': 'commercial',
            'handlungsgehilfe': 'commercial',
            'zurückbehaltungsrecht': 'commercial',
            'kommissionsgeschäft': 'commercial',
            'ohg': 'commercial',
            'offene handelsgesellschaft': 'commercial',
            'kommanditgesellschaft': 'commercial',
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
            'kaufvertrag': 'civil',
            'miete': 'civil',
            'mietvertrag': 'civil',
            'werkvertrag': 'civil',
            'dienstvertrag': 'civil',
            'darlehen': 'civil',
            'darlehensvertrag': 'civil',
            'schadensersatz': 'civil',
            'eigentum': 'civil',
            'eigentumsübertragung': 'civil',
            'besitz': 'civil',
            'anspruch': 'civil',
            'verjährung': 'civil',
            'regelverjährung': 'civil',
            'willenserklärung': 'civil',
            'anfechtung': 'civil',
            'geschäftsfähigkeit': 'civil',
            'minderjähriger': 'civil',
            'vollmacht': 'civil',
            'stellvertretung': 'civil',
            'haftung': 'civil',
            'gewährleistung': 'civil',
            'mängelgewährleistung': 'civil',
            'verzug': 'civil',
            'schuldnerverzug': 'civil',
            'unmöglichkeit': 'civil',
            'mitverschulden': 'civil',
            'treu und glauben': 'civil',
            'bereicherung': 'civil',
            'ungerechtfertigte bereicherung': 'civil',
            'bereicherungsrecht': 'civil',
            'widerrufsrecht': 'civil',
            'agb': 'civil',
            'allgemeine geschäftsbedingungen': 'civil',

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

            # Company law (GmbHG)
            'gmbh': 'company_law',
            'gmbhg': 'company_law',
            'stammkapital': 'company_law',
            'mindeststammkapital': 'company_law',
            'stammeinlage': 'company_law',
            'gesellschaftsvertrag': 'company_law',
            'unternehmergesellschaft': 'company_law',
            'ug': 'company_law',
            'geschäftsführerhaftung': 'company_law',
            'gmbh-geschäftsführer': 'company_law',
            'gesellschafterbeschluss': 'company_law',
            'kapitalerhöhung': 'company_law',
            'liquidation': 'company_law',
            'insolvenzantrag': 'company_law',

            # Civil procedure (ZPO)
            'klagerhebung': 'civil_procedure',
            'klageschrift': 'civil_procedure',
            'zwangsvollstreckung': 'civil_procedure',
            'mahnbescheid': 'civil_procedure',
            'mahnverfahren': 'civil_procedure',
            'vollstreckungsbescheid': 'civil_procedure',
            'prozesskostenhilfe': 'civil_procedure',
            'einstweilige verfügung': 'civil_procedure',
            'versäumnisurteil': 'civil_procedure',
            'berufung': 'civil_procedure',
            'revision': 'civil_procedure',
            'beweislast': 'civil_procedure',
            'arrest': 'civil_procedure',

            # Criminal procedure (StPO)
            'untersuchungshaft': 'criminal_procedure',
            'hauptverhandlung': 'criminal_procedure',
            'haftbefehl': 'criminal_procedure',
            'anklageschrift': 'criminal_procedure',
            'beschuldigtenrechte': 'criminal_procedure',
            'strafprozess': 'criminal_procedure',
            'strafverfahren': 'criminal_procedure',
            'hausdurchsuchung': 'criminal_procedure',
            'durchsuchung': 'criminal_procedure',
            'strafbefehl': 'criminal_procedure',
            'verfahrenseinstellung': 'criminal_procedure',
            'akteneinsicht': 'criminal_procedure',
            'vernehmung': 'criminal_procedure',
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
            },
            'extortion': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['erpressung'],
                'severity': 'severe',
                'paragraphs': ['§ 253']
            },
            'breach of trust': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['untreue'],
                'severity': 'medium',
                'paragraphs': ['§ 266']
            },
            'receiving stolen goods': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['hehlerei'],
                'severity': 'medium',
                'paragraphs': ['§ 259']
            },
            'coercion': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['nötigung'],
                'severity': 'medium',
                'paragraphs': ['§ 240']
            },
            'trespass': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['hausfriedensbruch'],
                'severity': 'low',
                'paragraphs': ['§ 123']
            },
            'defamation': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['beleidigung'],
                'severity': 'low',
                'paragraphs': ['§ 185']
            },
            'document forgery': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['urkundenfälschung'],
                'severity': 'medium',
                'paragraphs': ['§ 267']
            },
            'negligent homicide': {
                'field': 'criminal',
                'primary_statute': 'StGB',
                'statutes': ['StGB'],
                'german_terms': ['fahrlässige tötung'],
                'severity': 'severe',
                'paragraphs': ['§ 222']
            },
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
                'unterschied zwischen mord',
                'voraussetzungen für betrug',
                'notwehr erlaubt',
                'fahrlässige tötung',
            ],
            'civil': [
                'hat anspruch auf',
                'ist verpflichtet zu',
                'muss schadensersatz leisten',
                'kann vom vertrag zurücktreten',
                'ist zur zahlung verpflichtet',
                'zivilrechtliche haftung',
                'vertraglich vereinbart',
                'treu und glauben',
                'allgemeine geschäftsbedingungen',
                'widerrufsrecht',
                'verjähren ansprüche',
                'ungerechtfertigte bereicherung',
            ],
            'commercial': [
                'ist kaufmann im sinne des',
                'muss ins handelsregister eingetragen werden',
                'hat prokura für',
                'als handelsvertreter',
                'nach handelsbrauch',
                'handelsrechtliche vorschriften',
                'unternehmerisch tätig',
                'offene handelsgesellschaft',
                'kommanditgesellschaft',
                'handelsbücher',
            ],
            'constitutional': [
                'grundrecht auf',
                'garantiert durch artikel',
                'verfassungsrechtlich geschützt',
                'verstoß gegen das grundgesetz',
                'bundesverfassungsgericht entschied',
                'verfassungsmäßige ordnung',
                'grundgesetzlich garantiert',
                'art. 1 gg',
                'art. 2 gg',
                'art. 3 gg',
                'art. 4 gg',
                'art. 5 gg',
                'art. 6 gg',
                'art. 8 gg',
                'art. 12 gg',
                'art. 14 gg',
                'art. 19 gg',
                'art. 20 gg',
                'art. 79 gg',
            ],
            'data_protection': [
                'datenschutzrechtlich zulässig',
                'einwilligung des betroffenen',
                'datenschutzkonform',
                'gemäß datenschutz-grundverordnung',
                'datenschutzbeauftragter muss',
                'betroffenenrechte gemäß',
                'datenschutzfolgenabschätzung durchführen',
            ],
            'company_law': [
                'gmbh gründen',
                'gmbh haftung',
                'stammkapital der gmbh',
                'als geschäftsführer',
                'gesellschaft mit beschränkter haftung',
                'wie gründet man eine gmbh',
                'mindeststammkapital',
                'unternehmergesellschaft',
                'insolvenzantrag stellen',
                'gmbh auflösung',
                'liquidation gmbh',
            ],
            'civil_procedure': [
                'klage einreichen',
                'einstweilige verfügung beantragen',
                'mahnbescheid stellen',
                'zwangsvollstreckung einleiten',
                'zuständiges gericht',
                'klage ein',
                'mahnverfahren funktioniert',
                'örtlich zuständig',
                'versäumnisurteil',
                'berufung im zivilprozess',
                'revision im zivilprozess',
            ],
            'criminal_procedure': [
                'untersuchungshaft anordnen',
                'haftbefehl erlassen',
                'hauptverhandlung durchführen',
                'polizei durchsuchen',
                'rechte des beschuldigten',
                'untersuchungshaft angeordnet',
                'darf die polizei durchsuchen',
                'strafbefehl',
                'akteneinsicht',
                'revision im strafprozess',
            ],
        }
        
        # Paragraph number ranges for statutes
        self.paragraph_ranges = {
            'StGB': {'start': 1, 'end': 358, 'domain': 'criminal'},
            'BGB': {'start': 1, 'end': 2385, 'domain': 'civil'},
            'HGB': {'start': 1, 'end': 372, 'domain': 'commercial'},
            'GG': {'start': 1, 'end': 146, 'domain': 'constitutional'},
            'StPO': {'start': 1, 'end': 477, 'domain': 'criminal_procedure'},
            'ZPO': {'start': 1, 'end': 1066, 'domain': 'civil_procedure'},
            'GMBHG': {'start': 1, 'end': 88, 'domain': 'company_law'},
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
            'GMBHG': 'Gesetz betreffend die GmbH',
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