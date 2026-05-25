"""
Seed norm graph — domain-expert encoded doctrinal relationships.

Coverage: BGB (damages, contract, ownership, tort, void, capacity),
          StGB (fraud, theft, bodily harm),
          GG (fundamental rights).

Encoding principles:
- Weight = doctrinal coupling strength (0.0–1.0)
- Frequency = approximate co-occurrence in judgments
- No keyword matching — pure structural knowledge
"""

from typing import List, Dict, Any

# ── NODES ─────────────────────────────────────────────────────────────────────
# Each entry is the minimal spec; CentralityEngine fills centrality fields.

SEED_NODES: List[Dict[str, Any]] = [

    # ── BGB DAMAGES CLUSTER ──────────────────────────────────────────────────
    {"node_id": "BGB_249", "statute": "BGB", "paragraph": "249",
     "citation": "§ 249 BGB", "title": "Art und Umfang des Schadensersatzes",
     "domain": "damages",
     "semantic_keywords": ["Naturalrestitution", "Schadensersatz", "Herstellung", "Differenzhypothese"],
     "linked_concepts": ["Schadensersatz", "Naturalrestitution"],
     "aliases": ["§249 BGB", "§ 249 BGB"]},

    {"node_id": "BGB_250", "statute": "BGB", "paragraph": "250",
     "citation": "§ 250 BGB", "title": "Schadensersatz in Geld nach Fristsetzung",
     "domain": "damages",
     "semantic_keywords": ["Geldersatz", "Fristsetzung", "Surrogation"],
     "linked_concepts": ["Schadensersatz", "Geldersatz"]},

    {"node_id": "BGB_251", "statute": "BGB", "paragraph": "251",
     "citation": "§ 251 BGB", "title": "Schadensersatz in Geld ohne Fristsetzung",
     "domain": "damages",
     "semantic_keywords": ["Geldersatz", "Naturalrestitution", "unmöglich"],
     "linked_concepts": ["Schadensersatz", "Unmöglichkeit"]},

    {"node_id": "BGB_252", "statute": "BGB", "paragraph": "252",
     "citation": "§ 252 BGB", "title": "Entgangener Gewinn",
     "domain": "damages",
     "semantic_keywords": ["entgangener Gewinn", "Verdienstausfall", "Wahrscheinlichkeit"],
     "linked_concepts": ["Schadensersatz", "Gewinn"]},

    {"node_id": "BGB_253", "statute": "BGB", "paragraph": "253",
     "citation": "§ 253 BGB", "title": "Immaterieller Schaden",
     "domain": "damages",
     "semantic_keywords": ["Schmerzensgeld", "immateriell", "Nichtvermögensschaden"],
     "linked_concepts": ["Schmerzensgeld", "immaterieller Schaden"]},

    # ── BGB TORT ─────────────────────────────────────────────────────────────
    {"node_id": "BGB_823", "statute": "BGB", "paragraph": "823",
     "citation": "§ 823 BGB", "title": "Schadensersatzpflicht",
     "domain": "tort",
     "semantic_keywords": ["Delikt", "Haftung", "Rechtsgutverletzung", "Verschulden", "widerrechtlich"],
     "linked_concepts": ["Deliktsrecht", "Haftung", "Schadensersatz"],
     "aliases": ["§823 BGB", "§ 823 Abs. 1 BGB"]},

    {"node_id": "BGB_826", "statute": "BGB", "paragraph": "826",
     "citation": "§ 826 BGB", "title": "Sittenwidrige vorsätzliche Schädigung",
     "domain": "tort",
     "semantic_keywords": ["sittenwidrig", "vorsätzlich", "Schädigung"],
     "linked_concepts": ["Sittenwidrigkeit", "Vorsatz"]},

    {"node_id": "BGB_842", "statute": "BGB", "paragraph": "842",
     "citation": "§ 842 BGB", "title": "Schadensersatz bei Körperverletzung",
     "domain": "damages",
     "semantic_keywords": ["Körperverletzung", "Erwerbsminderung", "Heilungskosten"]},

    {"node_id": "BGB_843", "statute": "BGB", "paragraph": "843",
     "citation": "§ 843 BGB", "title": "Geldrente oder Kapitalabfindung",
     "domain": "damages",
     "semantic_keywords": ["Rente", "Kapitalabfindung", "dauernde Schädigung"]},

    # ── BGB CONTRACT CLUSTER ─────────────────────────────────────────────────
    {"node_id": "BGB_145", "statute": "BGB", "paragraph": "145",
     "citation": "§ 145 BGB", "title": "Bindung an den Antrag",
     "domain": "contract",
     "semantic_keywords": ["Angebot", "Antrag", "Vertragsschluss", "bindend"],
     "linked_concepts": ["Vertragsschluss", "Angebot"]},

    {"node_id": "BGB_147", "statute": "BGB", "paragraph": "147",
     "citation": "§ 147 BGB", "title": "Annahmefrist",
     "domain": "contract",
     "semantic_keywords": ["Annahme", "Frist", "Vertragsschluss"]},

    {"node_id": "BGB_241", "statute": "BGB", "paragraph": "241",
     "citation": "§ 241 BGB", "title": "Pflichten aus dem Schuldverhältnis",
     "domain": "contract",
     "semantic_keywords": ["Leistungspflicht", "Schutzpflicht", "Schuldverhältnis"],
     "linked_concepts": ["Schuldverhältnis", "Nebenpflichten"]},

    {"node_id": "BGB_242", "statute": "BGB", "paragraph": "242",
     "citation": "§ 242 BGB", "title": "Leistung nach Treu und Glauben",
     "domain": "contract",
     "semantic_keywords": ["Treu und Glauben", "Verkehrssitte", "gute Sitten"],
     "linked_concepts": ["Treu und Glauben", "Generalklausel"],
     "aliases": ["§242 BGB", "Treu und Glauben"]},

    {"node_id": "BGB_280", "statute": "BGB", "paragraph": "280",
     "citation": "§ 280 BGB", "title": "Schadensersatz wegen Pflichtverletzung",
     "domain": "contract",
     "semantic_keywords": ["Pflichtverletzung", "Schadensersatz", "Vertragshaftung", "Verschulden"],
     "linked_concepts": ["Pflichtverletzung", "Vertragshaftung"],
     "aliases": ["§280 BGB"]},

    {"node_id": "BGB_281", "statute": "BGB", "paragraph": "281",
     "citation": "§ 281 BGB", "title": "Schadensersatz statt der Leistung",
     "domain": "contract",
     "semantic_keywords": ["Schadensersatz statt Leistung", "Nachfrist", "Fristsetzung"]},

    {"node_id": "BGB_311", "statute": "BGB", "paragraph": "311",
     "citation": "§ 311 BGB", "title": "Rechtsgeschäftliche Schuldverhältnisse",
     "domain": "contract",
     "semantic_keywords": ["culpa in contrahendo", "vorvertragliche Pflicht", "§311 Abs. 2"]},

    {"node_id": "BGB_323", "statute": "BGB", "paragraph": "323",
     "citation": "§ 323 BGB", "title": "Rücktritt wegen nicht erbrachter Leistung",
     "domain": "contract",
     "semantic_keywords": ["Rücktritt", "Fristsetzung", "Verzug"]},

    {"node_id": "BGB_433", "statute": "BGB", "paragraph": "433",
     "citation": "§ 433 BGB", "title": "Vertragstypische Pflichten beim Kaufvertrag",
     "domain": "contract",
     "semantic_keywords": ["Kaufvertrag", "Übergabe", "Eigentumsübertragung", "Kaufpreis"],
     "linked_concepts": ["Kaufvertrag", "Kaufpreiszahlung"],
     "aliases": ["§433 BGB"]},

    {"node_id": "BGB_434", "statute": "BGB", "paragraph": "434",
     "citation": "§ 434 BGB", "title": "Sachmangel",
     "domain": "contract",
     "semantic_keywords": ["Sachmangel", "subjektiv", "objektiv", "Beschaffenheit"],
     "linked_concepts": ["Sachmangel", "Gewährleistung"]},

    {"node_id": "BGB_437", "statute": "BGB", "paragraph": "437",
     "citation": "§ 437 BGB", "title": "Rechte des Käufers bei Mängeln",
     "domain": "contract",
     "semantic_keywords": ["Nacherfüllung", "Minderung", "Rücktritt", "Schadensersatz"]},

    {"node_id": "BGB_439", "statute": "BGB", "paragraph": "439",
     "citation": "§ 439 BGB", "title": "Nacherfüllung",
     "domain": "contract",
     "semantic_keywords": ["Nacherfüllung", "Reparatur", "Ersatzlieferung"]},

    # ── BGB VOID CONTRACT CLUSTER ────────────────────────────────────────────
    {"node_id": "BGB_119", "statute": "BGB", "paragraph": "119",
     "citation": "§ 119 BGB", "title": "Anfechtbarkeit wegen Irrtums",
     "domain": "void_contract",
     "semantic_keywords": ["Irrtum", "Anfechtung", "Erklärungsirrtum", "Inhaltsirrtum"],
     "linked_concepts": ["Anfechtung", "Irrtum"]},

    {"node_id": "BGB_123", "statute": "BGB", "paragraph": "123",
     "citation": "§ 123 BGB", "title": "Anfechtbarkeit wegen Täuschung oder Drohung",
     "domain": "void_contract",
     "semantic_keywords": ["arglistige Täuschung", "Drohung", "Anfechtung"],
     "linked_concepts": ["Arglist", "Anfechtung"]},

    {"node_id": "BGB_125", "statute": "BGB", "paragraph": "125",
     "citation": "§ 125 BGB", "title": "Nichtigkeit wegen Formmangels",
     "domain": "void_contract",
     "semantic_keywords": ["Formmangel", "Nichtigkeit", "Formerfordernis"]},

    {"node_id": "BGB_134", "statute": "BGB", "paragraph": "134",
     "citation": "§ 134 BGB", "title": "Gesetzliches Verbot",
     "domain": "void_contract",
     "semantic_keywords": ["Verbotsgesetz", "Nichtigkeit", "gesetzliches Verbot"]},

    {"node_id": "BGB_138", "statute": "BGB", "paragraph": "138",
     "citation": "§ 138 BGB", "title": "Sittenwidriges Rechtsgeschäft",
     "domain": "void_contract",
     "semantic_keywords": ["sittenwidrig", "Nichtigkeit", "gute Sitten", "Wucher"],
     "linked_concepts": ["Sittenwidrigkeit", "Nichtigkeit"]},

    {"node_id": "BGB_142", "statute": "BGB", "paragraph": "142",
     "citation": "§ 142 BGB", "title": "Wirkung der Anfechtung",
     "domain": "void_contract",
     "semantic_keywords": ["Anfechtung", "Rückwirkung", "ex tunc", "Nichtigkeit"]},

    # ── BGB LEGAL CAPACITY CLUSTER ───────────────────────────────────────────
    {"node_id": "BGB_104", "statute": "BGB", "paragraph": "104",
     "citation": "§ 104 BGB", "title": "Geschäftsunfähigkeit",
     "domain": "legal_capacity",
     "semantic_keywords": ["Geschäftsunfähigkeit", "Geisteskrankheit", "Bewusstlosigkeit"],
     "linked_concepts": ["Geschäftsunfähigkeit"]},

    {"node_id": "BGB_106", "statute": "BGB", "paragraph": "106",
     "citation": "§ 106 BGB", "title": "Beschränkte Geschäftsfähigkeit",
     "domain": "legal_capacity",
     "semantic_keywords": ["Minderjährige", "beschränkte Geschäftsfähigkeit", "7 bis 18 Jahre"],
     "linked_concepts": ["Minderjährige", "Geschäftsfähigkeit"]},

    {"node_id": "BGB_107", "statute": "BGB", "paragraph": "107",
     "citation": "§ 107 BGB", "title": "Einwilligung des gesetzlichen Vertreters",
     "domain": "legal_capacity",
     "semantic_keywords": ["Einwilligung", "gesetzlicher Vertreter", "Minderjährige"]},

    # ── BGB OWNERSHIP CLUSTER ────────────────────────────────────────────────
    {"node_id": "BGB_854", "statute": "BGB", "paragraph": "854",
     "citation": "§ 854 BGB", "title": "Erwerb des Besitzes",
     "domain": "possession",
     "semantic_keywords": ["Besitz", "unmittelbar", "Besitzerwerb", "tatsächliche Gewalt"],
     "linked_concepts": ["Besitz", "Besitzerwerb"]},

    {"node_id": "BGB_903", "statute": "BGB", "paragraph": "903",
     "citation": "§ 903 BGB", "title": "Befugnisse des Eigentümers",
     "domain": "ownership",
     "semantic_keywords": ["Eigentum", "Verfügungsbefugnis", "Ausschlussbefugnis", "Eigentümer"],
     "linked_concepts": ["Eigentum", "Eigentumsrecht"],
     "aliases": ["§903 BGB"]},

    {"node_id": "BGB_929", "statute": "BGB", "paragraph": "929",
     "citation": "§ 929 BGB", "title": "Einigung und Übergabe",
     "domain": "ownership",
     "semantic_keywords": ["Übereignung", "Einigung", "Übergabe", "Eigentumsverschaffung"],
     "linked_concepts": ["Übereignung", "Eigentumsübertragung"],
     "aliases": ["§929 BGB"]},

    {"node_id": "BGB_930", "statute": "BGB", "paragraph": "930",
     "citation": "§ 930 BGB", "title": "Besitzkonstitut",
     "domain": "ownership",
     "semantic_keywords": ["Besitzkonstitut", "Übergabesurrogat", "mittelbarer Besitz"]},

    {"node_id": "BGB_931", "statute": "BGB", "paragraph": "931",
     "citation": "§ 931 BGB", "title": "Abtretung des Herausgabeanspruchs",
     "domain": "ownership",
     "semantic_keywords": ["Abtretung", "Herausgabeanspruch", "Übergabesurrogat"]},

    {"node_id": "BGB_932", "statute": "BGB", "paragraph": "932",
     "citation": "§ 932 BGB", "title": "Gutgläubiger Erwerb vom Nichtberechtigten",
     "domain": "good_faith",
     "semantic_keywords": ["gutgläubig", "Nichtberechtigter", "Verkehrsschutz", "guter Glaube"],
     "linked_concepts": ["Gutgläubiger Erwerb", "Verkehrsschutz"],
     "aliases": ["§932 BGB"]},

    {"node_id": "BGB_935", "statute": "BGB", "paragraph": "935",
     "citation": "§ 935 BGB", "title": "Kein gutgläubiger Erwerb bei abhanden gekommenen Sachen",
     "domain": "good_faith",
     "semantic_keywords": ["abhanden gekommen", "gestohlen", "Diebstahl", "kein gutgläubiger Erwerb"],
     "linked_concepts": ["Gutgläubiger Erwerb", "Abhanden kommen"]},

    {"node_id": "BGB_985", "statute": "BGB", "paragraph": "985",
     "citation": "§ 985 BGB", "title": "Herausgabeanspruch",
     "domain": "ownership",
     "semantic_keywords": ["Vindikation", "Herausgabeanspruch", "Eigentümer", "Besitzer"],
     "linked_concepts": ["Vindikation", "Eigentumsschutz"]},

    {"node_id": "BGB_986", "statute": "BGB", "paragraph": "986",
     "citation": "§ 986 BGB", "title": "Einwendungen des Besitzers",
     "domain": "ownership",
     "semantic_keywords": ["Einwendungen", "Besitzrecht", "berechtigter Besitzer"]},

    # ── BGB STATUTE OF LIMITATIONS ───────────────────────────────────────────
    {"node_id": "BGB_195", "statute": "BGB", "paragraph": "195",
     "citation": "§ 195 BGB", "title": "Regelmäßige Verjährungsfrist",
     "domain": "contract",
     "semantic_keywords": ["Verjährung", "3 Jahre", "Regelverjährung"],
     "linked_concepts": ["Verjährung"]},

    {"node_id": "BGB_199", "statute": "BGB", "paragraph": "199",
     "citation": "§ 199 BGB", "title": "Beginn der regelmäßigen Verjährungsfrist",
     "domain": "contract",
     "semantic_keywords": ["Verjährungsbeginn", "Kenntnis", "Jahresende"]},

    # ── StGB FRAUD CLUSTER ───────────────────────────────────────────────────
    {"node_id": "STGB_263", "statute": "STGB", "paragraph": "263",
     "citation": "§ 263 StGB", "title": "Betrug",
     "domain": "fraud",
     "semantic_keywords": ["Betrug", "Täuschung", "Irrtum", "Vermögensverfügung", "Schaden", "Bereicherung"],
     "linked_concepts": ["Betrug", "Täuschungshandlung"],
     "aliases": ["§263 StGB", "§ 263 StGB"]},

    {"node_id": "STGB_264", "statute": "STGB", "paragraph": "264",
     "citation": "§ 264 StGB", "title": "Subventionsbetrug",
     "domain": "fraud",
     "semantic_keywords": ["Subventionsbetrug", "Subvention", "unrichtige Angaben"]},

    {"node_id": "STGB_266", "statute": "STGB", "paragraph": "266",
     "citation": "§ 266 StGB", "title": "Untreue",
     "domain": "fraud",
     "semantic_keywords": ["Untreue", "Treuepflicht", "Vermögensnachteil", "Missbrauch"],
     "linked_concepts": ["Untreue", "Vermögensnachteil"]},

    # ── StGB THEFT CLUSTER ───────────────────────────────────────────────────
    {"node_id": "STGB_242", "statute": "STGB", "paragraph": "242",
     "citation": "§ 242 StGB", "title": "Diebstahl",
     "domain": "theft",
     "semantic_keywords": ["Diebstahl", "Wegnahme", "fremde Sache", "Zueignungsabsicht"],
     "linked_concepts": ["Diebstahl", "Wegnahme"],
     "aliases": ["§242 StGB", "§ 242 StGB"]},

    {"node_id": "STGB_243", "statute": "STGB", "paragraph": "243",
     "citation": "§ 243 StGB", "title": "Besonders schwerer Fall des Diebstahls",
     "domain": "theft",
     "semantic_keywords": ["besonders schwerer Fall", "Einbruch", "Regelbeispiele"]},

    {"node_id": "STGB_246", "statute": "STGB", "paragraph": "246",
     "citation": "§ 246 StGB", "title": "Unterschlagung",
     "domain": "theft",
     "semantic_keywords": ["Unterschlagung", "Zueignung", "fremde bewegliche Sache"]},

    {"node_id": "STGB_249", "statute": "STGB", "paragraph": "249",
     "citation": "§ 249 StGB", "title": "Raub",
     "domain": "theft",
     "semantic_keywords": ["Raub", "Gewalt", "Drohung", "Wegnahme", "qualifizierter Diebstahl"],
     "linked_concepts": ["Raub", "Nötigung"]},

    {"node_id": "STGB_250", "statute": "STGB", "paragraph": "250",
     "citation": "§ 250 StGB", "title": "Schwerer Raub",
     "domain": "theft",
     "semantic_keywords": ["schwerer Raub", "Waffe", "gefährliches Werkzeug"]},

    # ── StGB BODILY HARM CLUSTER ─────────────────────────────────────────────
    {"node_id": "STGB_223", "statute": "STGB", "paragraph": "223",
     "citation": "§ 223 StGB", "title": "Körperverletzung",
     "domain": "bodily_harm",
     "semantic_keywords": ["Körperverletzung", "körperlich", "Gesundheit", "Misshandlung"],
     "linked_concepts": ["Körperverletzung"],
     "aliases": ["§223 StGB", "§ 223 StGB"]},

    {"node_id": "STGB_224", "statute": "STGB", "paragraph": "224",
     "citation": "§ 224 StGB", "title": "Gefährliche Körperverletzung",
     "domain": "bodily_harm",
     "semantic_keywords": ["gefährlich", "Waffe", "hinterlistig", "gemeinschaftlich"]},

    {"node_id": "STGB_226", "statute": "STGB", "paragraph": "226",
     "citation": "§ 226 StGB", "title": "Schwere Körperverletzung",
     "domain": "bodily_harm",
     "semantic_keywords": ["schwere Körperverletzung", "dauerhaft", "Sehvermögen"]},

    {"node_id": "STGB_229", "statute": "STGB", "paragraph": "229",
     "citation": "§ 229 StGB", "title": "Fahrlässige Körperverletzung",
     "domain": "bodily_harm",
     "semantic_keywords": ["fahrlässig", "Körperverletzung", "Fahrlässigkeit"]},

    # ── StGB HOMICIDE ────────────────────────────────────────────────────────
    {"node_id": "STGB_211", "statute": "STGB", "paragraph": "211",
     "citation": "§ 211 StGB", "title": "Mord",
     "domain": "bodily_harm",
     "semantic_keywords": ["Mord", "Mordmerkmale", "heimtückisch", "niedrige Beweggründe"],
     "linked_concepts": ["Mord", "Tötungsdelikt"]},

    {"node_id": "STGB_212", "statute": "STGB", "paragraph": "212",
     "citation": "§ 212 StGB", "title": "Totschlag",
     "domain": "bodily_harm",
     "semantic_keywords": ["Totschlag", "Tötungsvorsatz", "ohne Mordmerkmale"],
     "linked_concepts": ["Totschlag", "Tötungsdelikt"]},

    # ── StGB JUSTIFICATION ───────────────────────────────────────────────────
    {"node_id": "STGB_32", "statute": "STGB", "paragraph": "32",
     "citation": "§ 32 StGB", "title": "Notwehr",
     "domain": "bodily_harm",
     "semantic_keywords": ["Notwehr", "Angriff", "Verteidigung", "Gebotenheit"],
     "linked_concepts": ["Notwehr", "Rechtfertigung"]},

    # ── GG FUNDAMENTAL RIGHTS CLUSTER ───────────────────────────────────────
    {"node_id": "GG_1", "statute": "GG", "paragraph": "1",
     "citation": "Art. 1 GG", "title": "Menschenwürde",
     "domain": "constitutional",
     "semantic_keywords": ["Menschenwürde", "unantastbar", "Grundrechte"],
     "linked_concepts": ["Menschenwürde", "Würde des Menschen"],
     "aliases": ["Art. 1 GG", "Artikel 1 GG"]},

    {"node_id": "GG_2", "statute": "GG", "paragraph": "2",
     "citation": "Art. 2 GG", "title": "Allgemeines Persönlichkeitsrecht",
     "domain": "constitutional",
     "semantic_keywords": ["allgemeine Handlungsfreiheit", "Persönlichkeitsrecht", "Informationelle Selbstbestimmung"],
     "linked_concepts": ["Persönlichkeitsrecht", "Handlungsfreiheit"]},

    {"node_id": "GG_3", "statute": "GG", "paragraph": "3",
     "citation": "Art. 3 GG", "title": "Gleichheitsgrundsatz",
     "domain": "constitutional",
     "semantic_keywords": ["Gleichheit", "Diskriminierungsverbot", "Gleichbehandlung"]},

    {"node_id": "GG_14", "statute": "GG", "paragraph": "14",
     "citation": "Art. 14 GG", "title": "Eigentum und Erbrecht",
     "domain": "constitutional",
     "semantic_keywords": ["Eigentumsgarantie", "Enteignung", "Sozialbindung", "Eigentum"],
     "linked_concepts": ["Eigentumsgarantie", "Eigentum"]},

    {"node_id": "GG_20", "statute": "GG", "paragraph": "20",
     "citation": "Art. 20 GG", "title": "Staatsprinzipien",
     "domain": "constitutional",
     "semantic_keywords": ["Rechtsstaat", "Sozialstaat", "Demokratie", "Gewaltenteilung"]},
]


# ── EDGES ─────────────────────────────────────────────────────────────────────
# Edge list: source, target, type, weight, frequency, source_type, directional

SEED_EDGES: List[Dict[str, Any]] = [

    # ══════════════════════════════════════════════════════
    # BGB DAMAGES CLUSTER
    # ══════════════════════════════════════════════════════

    # §823 → §249: tort triggers damages calculation (strongest edge in German civil law)
    {"source": "BGB_823", "target": "BGB_249", "edge_type": "cites",
     "weight": 0.97, "frequency": 890, "source_type": "judgment", "directional": True},

    # §280 → §249: contract breach triggers damages calculation
    {"source": "BGB_280", "target": "BGB_249", "edge_type": "cites",
     "weight": 0.93, "frequency": 750, "source_type": "judgment", "directional": True},

    # §249 → §252: lost profit is component of Schadensersatz
    {"source": "BGB_249", "target": "BGB_252", "edge_type": "cites",
     "weight": 0.88, "frequency": 430, "source_type": "statute_text", "directional": True},

    # §249 → §253: non-pecuniary damages component
    {"source": "BGB_249", "target": "BGB_253", "edge_type": "cites",
     "weight": 0.82, "frequency": 380, "source_type": "statute_text", "directional": True},

    # §249 ↔ §251: money substitute for Naturalrestitution
    {"source": "BGB_249", "target": "BGB_251", "edge_type": "doctrinally_related",
     "weight": 0.91, "frequency": 420, "source_type": "commentary", "directional": False},
    {"source": "BGB_251", "target": "BGB_249", "edge_type": "doctrinally_related",
     "weight": 0.91, "frequency": 420, "source_type": "commentary", "directional": False},

    # §249 ↔ §250: two routes to Geldersatz
    {"source": "BGB_249", "target": "BGB_250", "edge_type": "doctrinally_related",
     "weight": 0.85, "frequency": 310, "source_type": "commentary", "directional": False},
    {"source": "BGB_250", "target": "BGB_249", "edge_type": "doctrinally_related",
     "weight": 0.85, "frequency": 310, "source_type": "commentary", "directional": False},

    # §823 ↔ §249: doctrinally coupled (tort + damages cluster)
    {"source": "BGB_823", "target": "BGB_249", "edge_type": "doctrinally_related",
     "weight": 0.95, "frequency": 890, "source_type": "judgment", "directional": False},

    # §823 → §253: §253 Abs. 2 — Schmerzensgeld from §823
    {"source": "BGB_823", "target": "BGB_253", "edge_type": "cites",
     "weight": 0.88, "frequency": 520, "source_type": "judgment", "directional": True},

    # §823 → §842, §843 (consequential damages from Körperverletzung)
    {"source": "BGB_823", "target": "BGB_842", "edge_type": "cites",
     "weight": 0.80, "frequency": 280, "source_type": "judgment", "directional": True},
    {"source": "BGB_842", "target": "BGB_843", "edge_type": "cites",
     "weight": 0.75, "frequency": 190, "source_type": "statute_text", "directional": True},

    # §826 ↔ §823: both tort norms
    {"source": "BGB_826", "target": "BGB_823", "edge_type": "doctrinally_related",
     "weight": 0.78, "frequency": 210, "source_type": "commentary", "directional": False},
    {"source": "BGB_823", "target": "BGB_826", "edge_type": "doctrinally_related",
     "weight": 0.78, "frequency": 210, "source_type": "commentary", "directional": False},

    # §280 ↔ §823: contract vs. tort liability cluster
    {"source": "BGB_280", "target": "BGB_823", "edge_type": "interpreted_with",
     "weight": 0.72, "frequency": 340, "source_type": "judgment", "directional": False},

    # ══════════════════════════════════════════════════════
    # BGB CONTRACT CLUSTER
    # ══════════════════════════════════════════════════════

    # §145 → §147: offer → acceptance period
    {"source": "BGB_145", "target": "BGB_147", "edge_type": "cites",
     "weight": 0.90, "frequency": 410, "source_type": "statute_text", "directional": True},

    # §433 → §241: purchase triggers general obligations
    {"source": "BGB_433", "target": "BGB_241", "edge_type": "cites",
     "weight": 0.82, "frequency": 300, "source_type": "statute_text", "directional": True},

    # §242 ↔ §157: Treu und Glauben + Auslegung
    {"source": "BGB_242", "target": "BGB_241", "edge_type": "interpreted_with",
     "weight": 0.85, "frequency": 560, "source_type": "judgment", "directional": False},
    {"source": "BGB_241", "target": "BGB_242", "edge_type": "interpreted_with",
     "weight": 0.85, "frequency": 560, "source_type": "judgment", "directional": False},

    # §280 → §281 prerequisite: §280 required before §281 damages
    {"source": "BGB_280", "target": "BGB_281", "edge_type": "prerequisite_for",
     "weight": 0.92, "frequency": 680, "source_type": "statute_text", "directional": True},

    # §280 ↔ §311: culpa in contrahendo cluster
    {"source": "BGB_311", "target": "BGB_280", "edge_type": "cites",
     "weight": 0.84, "frequency": 290, "source_type": "statute_text", "directional": True},

    # §437 → §323, §439: buyer rights all cluster together
    {"source": "BGB_437", "target": "BGB_439", "edge_type": "cites",
     "weight": 0.91, "frequency": 510, "source_type": "statute_text", "directional": True},
    {"source": "BGB_437", "target": "BGB_323", "edge_type": "cites",
     "weight": 0.88, "frequency": 460, "source_type": "statute_text", "directional": True},
    {"source": "BGB_437", "target": "BGB_280", "edge_type": "cites",
     "weight": 0.86, "frequency": 430, "source_type": "statute_text", "directional": True},

    # §434 prerequisite for §437
    {"source": "BGB_434", "target": "BGB_437", "edge_type": "prerequisite_for",
     "weight": 0.93, "frequency": 610, "source_type": "statute_text", "directional": True},

    # §433 ↔ §434: Kaufvertrag + Sachmangel
    {"source": "BGB_433", "target": "BGB_434", "edge_type": "cites",
     "weight": 0.87, "frequency": 490, "source_type": "statute_text", "directional": True},

    # Verjährung cluster
    {"source": "BGB_195", "target": "BGB_199", "edge_type": "cites",
     "weight": 0.90, "frequency": 380, "source_type": "statute_text", "directional": True},

    # ══════════════════════════════════════════════════════
    # BGB VOID CONTRACT CLUSTER
    # ══════════════════════════════════════════════════════

    # §119 → §142: anfechtung → ex-tunc nichtigkeit
    {"source": "BGB_119", "target": "BGB_142", "edge_type": "cites",
     "weight": 0.93, "frequency": 540, "source_type": "statute_text", "directional": True},

    # §123 → §142: fraud anfechtung → ex-tunc nichtigkeit
    {"source": "BGB_123", "target": "BGB_142", "edge_type": "cites",
     "weight": 0.91, "frequency": 490, "source_type": "statute_text", "directional": True},

    # §119 ↔ §123: both anfechtungsgründe
    {"source": "BGB_119", "target": "BGB_123", "edge_type": "doctrinally_related",
     "weight": 0.84, "frequency": 320, "source_type": "commentary", "directional": False},
    {"source": "BGB_123", "target": "BGB_119", "edge_type": "doctrinally_related",
     "weight": 0.84, "frequency": 320, "source_type": "commentary", "directional": False},

    # §138 ↔ §134: both nichtigkeit grounds
    {"source": "BGB_134", "target": "BGB_138", "edge_type": "doctrinally_related",
     "weight": 0.82, "frequency": 290, "source_type": "commentary", "directional": False},
    {"source": "BGB_138", "target": "BGB_134", "edge_type": "doctrinally_related",
     "weight": 0.82, "frequency": 290, "source_type": "commentary", "directional": False},

    # §138 (sittenwidrig) ↔ §826 (sittenwidrig tort): same concept in different context
    {"source": "BGB_138", "target": "BGB_826", "edge_type": "interpreted_with",
     "weight": 0.74, "frequency": 180, "source_type": "judgment", "directional": False},

    # ══════════════════════════════════════════════════════
    # BGB OWNERSHIP CLUSTER
    # ══════════════════════════════════════════════════════

    # §929 prerequisite for §932 (transfer needed for good faith acquisition)
    {"source": "BGB_929", "target": "BGB_932", "edge_type": "prerequisite_for",
     "weight": 0.94, "frequency": 580, "source_type": "statute_text", "directional": True},

    # §932 → §935: good faith exception limited by abhanden kommen
    {"source": "BGB_932", "target": "BGB_935", "edge_type": "exception_to",
     "weight": 0.92, "frequency": 440, "source_type": "statute_text", "directional": True},

    # §929 cites §930, §931 (Übergabesurrogate)
    {"source": "BGB_929", "target": "BGB_930", "edge_type": "cites",
     "weight": 0.85, "frequency": 310, "source_type": "statute_text", "directional": True},
    {"source": "BGB_929", "target": "BGB_931", "edge_type": "cites",
     "weight": 0.83, "frequency": 270, "source_type": "statute_text", "directional": True},

    # §985 based on §903: vindication requires ownership
    {"source": "BGB_903", "target": "BGB_985", "edge_type": "prerequisite_for",
     "weight": 0.89, "frequency": 420, "source_type": "statute_text", "directional": True},

    # §985 ↔ §986: claim vs. defense
    {"source": "BGB_985", "target": "BGB_986", "edge_type": "doctrinally_related",
     "weight": 0.90, "frequency": 380, "source_type": "commentary", "directional": False},
    {"source": "BGB_986", "target": "BGB_985", "edge_type": "doctrinally_related",
     "weight": 0.90, "frequency": 380, "source_type": "commentary", "directional": False},

    # §854 interpreted with §929: possession and ownership transfer
    {"source": "BGB_854", "target": "BGB_929", "edge_type": "interpreted_with",
     "weight": 0.86, "frequency": 390, "source_type": "judgment", "directional": False},

    # §903 ↔ Art.14 GG: constitutional dimension of ownership
    {"source": "BGB_903", "target": "GG_14", "edge_type": "interpreted_with",
     "weight": 0.79, "frequency": 220, "source_type": "judgment", "directional": False},
    {"source": "GG_14", "target": "BGB_903", "edge_type": "interpreted_with",
     "weight": 0.79, "frequency": 220, "source_type": "judgment", "directional": False},

    # ══════════════════════════════════════════════════════
    # StGB FRAUD CLUSTER
    # ══════════════════════════════════════════════════════

    # §263 ↔ §266: Betrug and Untreue cluster
    {"source": "STGB_263", "target": "STGB_266", "edge_type": "doctrinally_related",
     "weight": 0.78, "frequency": 250, "source_type": "commentary", "directional": False},
    {"source": "STGB_266", "target": "STGB_263", "edge_type": "doctrinally_related",
     "weight": 0.78, "frequency": 250, "source_type": "commentary", "directional": False},

    # §264 is specialization of §263
    {"source": "STGB_264", "target": "STGB_263", "edge_type": "exception_to",
     "weight": 0.82, "frequency": 180, "source_type": "statute_text", "directional": True},

    # ══════════════════════════════════════════════════════
    # StGB THEFT CLUSTER
    # ══════════════════════════════════════════════════════

    # §243 (aggravated theft) is exception to §242
    {"source": "STGB_243", "target": "STGB_242", "edge_type": "exception_to",
     "weight": 0.88, "frequency": 390, "source_type": "statute_text", "directional": True},

    # §246 (Unterschlagung) ↔ §242 (similar factual pattern)
    {"source": "STGB_246", "target": "STGB_242", "edge_type": "doctrinally_related",
     "weight": 0.83, "frequency": 290, "source_type": "commentary", "directional": False},
    {"source": "STGB_242", "target": "STGB_246", "edge_type": "doctrinally_related",
     "weight": 0.83, "frequency": 290, "source_type": "commentary", "directional": False},

    # §249 (Raub) requires §242 elements as prerequisite
    {"source": "STGB_242", "target": "STGB_249", "edge_type": "prerequisite_for",
     "weight": 0.90, "frequency": 450, "source_type": "statute_text", "directional": True},

    # §250 (schwerer Raub) requires §249
    {"source": "STGB_249", "target": "STGB_250", "edge_type": "prerequisite_for",
     "weight": 0.93, "frequency": 380, "source_type": "statute_text", "directional": True},

    # StGB §242 ↔ BGB §935: theft → no good faith acquisition
    {"source": "STGB_242", "target": "BGB_935", "edge_type": "doctrinally_related",
     "weight": 0.80, "frequency": 190, "source_type": "judgment", "directional": False},

    # ══════════════════════════════════════════════════════
    # StGB BODILY HARM CLUSTER
    # ══════════════════════════════════════════════════════

    # §224 is aggravated §223
    {"source": "STGB_224", "target": "STGB_223", "edge_type": "exception_to",
     "weight": 0.91, "frequency": 470, "source_type": "statute_text", "directional": True},

    # §226 (schwere KV) requires §223 elements
    {"source": "STGB_223", "target": "STGB_226", "edge_type": "prerequisite_for",
     "weight": 0.87, "frequency": 320, "source_type": "statute_text", "directional": True},

    # §229 (fahrlässige KV) ↔ §223
    {"source": "STGB_229", "target": "STGB_223", "edge_type": "doctrinally_related",
     "weight": 0.84, "frequency": 280, "source_type": "commentary", "directional": False},
    {"source": "STGB_223", "target": "STGB_229", "edge_type": "doctrinally_related",
     "weight": 0.84, "frequency": 280, "source_type": "commentary", "directional": False},

    # §212 (Totschlag) → §211 (Mord) relationship
    {"source": "STGB_212", "target": "STGB_211", "edge_type": "doctrinally_related",
     "weight": 0.92, "frequency": 680, "source_type": "commentary", "directional": False},
    {"source": "STGB_211", "target": "STGB_212", "edge_type": "doctrinally_related",
     "weight": 0.92, "frequency": 680, "source_type": "commentary", "directional": False},

    # §223 (KV) ↔ §212 (Totschlag): escalation path
    {"source": "STGB_223", "target": "STGB_212", "edge_type": "semantically_adjacent",
     "weight": 0.65, "frequency": 140, "source_type": "commentary", "directional": False},

    # §32 (Notwehr) ↔ §223: most often invoked for KV
    {"source": "STGB_32", "target": "STGB_223", "edge_type": "interpreted_with",
     "weight": 0.85, "frequency": 390, "source_type": "judgment", "directional": False},
    {"source": "STGB_32", "target": "STGB_212", "edge_type": "interpreted_with",
     "weight": 0.82, "frequency": 290, "source_type": "judgment", "directional": False},

    # BGB §823 ↔ StGB §223: civil and criminal Körperverletzung parallel
    {"source": "BGB_823", "target": "STGB_223", "edge_type": "interpreted_with",
     "weight": 0.76, "frequency": 220, "source_type": "judgment", "directional": False},
    {"source": "STGB_223", "target": "BGB_823", "edge_type": "interpreted_with",
     "weight": 0.76, "frequency": 220, "source_type": "judgment", "directional": False},

    # ══════════════════════════════════════════════════════
    # GG CLUSTER
    # ══════════════════════════════════════════════════════

    # Art.1 → Art.2: human dignity is foundation of personal rights
    {"source": "GG_1", "target": "GG_2", "edge_type": "prerequisite_for",
     "weight": 0.88, "frequency": 490, "source_type": "judgment", "directional": True},

    # Art.1 ↔ Art.3: dignity + equality
    {"source": "GG_1", "target": "GG_3", "edge_type": "interpreted_with",
     "weight": 0.79, "frequency": 280, "source_type": "judgment", "directional": False},

    # Art.20 is structural norm
    {"source": "GG_20", "target": "GG_1", "edge_type": "interpreted_with",
     "weight": 0.72, "frequency": 180, "source_type": "judgment", "directional": False},

    # Art.2 ↔ BGB §823: allgemeines Persönlichkeitsrecht civil dimension
    {"source": "GG_2", "target": "BGB_823", "edge_type": "interpreted_with",
     "weight": 0.77, "frequency": 230, "source_type": "judgment", "directional": False},
    {"source": "BGB_823", "target": "GG_2", "edge_type": "interpreted_with",
     "weight": 0.77, "frequency": 230, "source_type": "judgment", "directional": False},

    # ══════════════════════════════════════════════════════
    # CROSS-CLUSTER SEMANTIC ADJACENCY
    # ══════════════════════════════════════════════════════

    # §249 BGB ↔ §263 StGB: Schadensersatz in both Betrug and civil damages
    {"source": "BGB_249", "target": "STGB_263", "edge_type": "semantically_adjacent",
     "weight": 0.55, "frequency": 90, "source_type": "embedding", "directional": False},

    # §280 BGB ↔ §242 BGB: Treu und Glauben + Pflichtverletzung (Siebert doctrine)
    {"source": "BGB_280", "target": "BGB_242", "edge_type": "interpreted_with",
     "weight": 0.80, "frequency": 310, "source_type": "judgment", "directional": False},
    {"source": "BGB_242", "target": "BGB_280", "edge_type": "interpreted_with",
     "weight": 0.80, "frequency": 310, "source_type": "judgment", "directional": False},

    # Legal capacity cluster
    {"source": "BGB_104", "target": "BGB_106", "edge_type": "doctrinally_related",
     "weight": 0.88, "frequency": 320, "source_type": "commentary", "directional": False},
    {"source": "BGB_106", "target": "BGB_107", "edge_type": "cites",
     "weight": 0.87, "frequency": 290, "source_type": "statute_text", "directional": True},
]


# ── DOCTRINAL CLUSTERS ────────────────────────────────────────────────────────
# Pre-defined cluster membership for cluster centrality computation

DOCTRINAL_CLUSTERS: Dict[str, List[str]] = {
    "damages":       ["BGB_249", "BGB_250", "BGB_251", "BGB_252", "BGB_253",
                      "BGB_842", "BGB_843", "BGB_823"],
    "tort":          ["BGB_823", "BGB_826", "BGB_842", "BGB_843"],
    "contract":      ["BGB_145", "BGB_147", "BGB_241", "BGB_242", "BGB_280",
                      "BGB_281", "BGB_311", "BGB_323", "BGB_433", "BGB_434",
                      "BGB_437", "BGB_439", "BGB_195", "BGB_199"],
    "ownership":     ["BGB_903", "BGB_929", "BGB_930", "BGB_931",
                      "BGB_985", "BGB_986"],
    "good_faith":    ["BGB_932", "BGB_933", "BGB_934", "BGB_935"],
    "possession":    ["BGB_854"],
    "void_contract": ["BGB_119", "BGB_123", "BGB_125", "BGB_134",
                      "BGB_138", "BGB_142"],
    "legal_capacity":["BGB_104", "BGB_106", "BGB_107"],
    "fraud":         ["STGB_263", "STGB_264", "STGB_266"],
    "theft":         ["STGB_242", "STGB_243", "STGB_246", "STGB_249", "STGB_250"],
    "bodily_harm":   ["STGB_223", "STGB_224", "STGB_226", "STGB_229",
                      "STGB_211", "STGB_212", "STGB_32"],
    "constitutional":["GG_1", "GG_2", "GG_3", "GG_14", "GG_20"],
}
