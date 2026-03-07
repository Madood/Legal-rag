DOCTRINAL_QUESTION_TYPES = {
    "DOCTRINE", "LEGAL_PRINCIPLE", "GRUNDSATZ", "PRINCIPLE", "DOCTRINAL_ANALYSIS"
}

CANONICAL_DOCTRINES = {
    "schuldprinzip": "SCHULDPRINZIP",
    "nulla poena sine lege": "NULLA_POENA_SINE_LEGE",
    "verhältnismäßigkeitsprinzip": "VERHAELTNISMAESSIGKEIT",
    "rechtsstaatsprinzip": "RECHTSSTAATSPRINZIP",
    "bestimmtheitsgrundsatz": "BESTIMMTHEITSGRUNDSATZ",
}

CIVIL_LAW_DOCTRINES = {
    "privatautonomie": {
        "canonical_id": "PRIVATAUTONOMIE",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§ 145 BGB", "§§ 305 ff. BGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG (indirect)"],
        "description": "Freedom of contract as private autonomy principle",
        "aliases": ["vertragsfreiheit", "freedom of contract"]
    },
    "trennungsprinzip": {
        "canonical_id": "TRENNUNGSPRINZIP",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§ 925 BGB", "§ 929 BGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)"],
        "description": "Separation principle between obligation and conveyance",
        "aliases": ["trennungsgrundsatz", "separation principle"]
    },
    "tort_liability": {
        "canonical_id": "SCHADENSERSATZ",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§ 249 BGB", "§ 250 BGB", "§ 251 BGB", "§ 252 BGB", "§ 253 BGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)", "Art. 2 Abs. 1 GG (indirect)"],
        "description": "Schadensersatz – law of damages under BGB §§ 249–253",
        "aliases": ["schadensersatz", "schadenersatz", "damages", "tort liability", "haftung"]
    },
    "willenserklarung": {
        "canonical_id": "WILLENSERKLARUNG",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 116-144 BGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG (indirect)"],
        "description": "Willenserklärung – declaration of intent; validity, formation, and defects under BGB §§ 116-144",
        "aliases": ["willenserklärung", "willenserklärungen", "declaration of intent", "rechtsgeschäft", "willenserklaerung"]
    },
    "verjaehrung": {
        "canonical_id": "VERJAEHRUNG",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 194-218 BGB"],
        "constitutional_basis": ["Art. 20 GG (Rechtssicherheit)"],
        "description": "Verjährung – statute of limitations; regular 3-year period and special periods under BGB §§ 194-218",
        "aliases": ["verjährung", "verjaehrungsfrist", "verjährungsfrist", "regelverjährung", "limitation period", "prescription"]
    },
    "angebot_annahme": {
        "canonical_id": "ANGEBOT_ANNAHME",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 145-150 BGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG (indirect)"],
        "description": "Angebot und Annahme – offer and acceptance; contract formation under BGB §§ 145-150",
        "aliases": ["angebot", "annahme", "antrag", "offer acceptance", "antrag und annahme", "vertragsangebot"]
    },
    "geschaeftsfaehigkeit": {
        "canonical_id": "GESCHAEFTSFAEHIGKEIT",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 104-113 BGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG"],
        "description": "Geschäftsfähigkeit – legal capacity; full, limited, and lack of capacity under BGB §§ 104-113",
        "aliases": ["geschäftsfähigkeit", "geschäftsunfähigkeit", "beschränkte geschäftsfähigkeit", "legal capacity", "rechtsfähigkeit"]
    },
    "stellvertretung": {
        "canonical_id": "STELLVERTRETUNG",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 164-181 BGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG (indirect)"],
        "description": "Stellvertretung – agency and representation; authority, effect, and limits under BGB §§ 164-181",
        "aliases": ["vollmacht", "bevollmächtigter", "vertreter", "vertretungsmacht", "agency", "legal representation"]
    },
    "bereicherung": {
        "canonical_id": "UNGERECHTFERTIGTE_BEREICHERUNG",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 812-822 BGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)"],
        "description": "Ungerechtfertigte Bereicherung – unjust enrichment; condictio and restitution under BGB §§ 812-822",
        "aliases": ["ungerechtfertigte bereicherung", "bereicherungsrecht", "bereicherungsanspruch", "condictio", "unjust enrichment"]
    },
    "koerperverletzung": {
        "canonical_id": "KOERPERVERLETZUNG_STGB_BGB",
        "hierarchy": "civil_law_doctrine",
        "statutory_basis": ["§§ 223-229 StGB", "§ 823 BGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG"],
        "description": "Cross-statute: criminal liability under StGB §§ 223-229 vs civil damages under BGB § 823; both can apply simultaneously",
        "aliases": ["körperverletzung", "stgb_bgb_comparison", "stgb_bgb_vergleich", "körperliche verletzung", "bodily harm", "koerper verletzung"]
    },
    "kaufmann": {
        "canonical_id": "KAUFMANN",
        "hierarchy": "commercial_law_doctrine",
        "statutory_basis": ["§ 1 HGB", "§ 2 HGB", "§ 6 HGB"],
        "constitutional_basis": ["Art. 12 GG (indirect)"],
        "description": "Kaufmannsbegriff – Istkaufmann, Kannkaufmann, Formkaufmann under HGB §§ 1-6",
        "aliases": ["istkaufmann", "kannkaufmann", "formkaufmann", "kaufleute", "handelsgewerbe"]
    },
    "prokura": {
        "canonical_id": "PROKURA",
        "hierarchy": "commercial_law_doctrine",
        "statutory_basis": ["§§ 48-53 HGB"],
        "constitutional_basis": ["Art. 12 GG (indirect)"],
        "description": "Prokura – commercial power of attorney under HGB §§ 48-53",
        "aliases": ["prokurist", "handlungsvollmacht", "prokura hgb"]
    },
    # ── Criminal law doctrines (StGB) ────────────────────────────────────────
    "totschlag": {
        "canonical_id": "TOTSCHLAG",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 212 StGB", "§ 213 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG", "Art. 103 Abs. 2 GG"],
        "description": "Totschlag – vorsätzliche Tötung ohne Mordmerkmale; Grundtatbestand § 212 StGB",
        "aliases": ["manslaughter", "tötungsdelikt", "§ 212 stgb"]
    },
    "mord": {
        "canonical_id": "MORD",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 211 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG", "Art. 103 Abs. 2 GG"],
        "description": "Mord – vorsätzliche Tötung mit Mordmerkmalen; lebenslange Freiheitsstrafe",
        "aliases": ["murder", "mordmerkmale", "heimtücke", "habgier", "niedrige beweggründe", "§ 211 stgb"]
    },
    "koerperverletzung_stgb": {
        "canonical_id": "KOERPERVERLETZUNG_STGB",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 223 StGB", "§ 224 StGB", "§ 226 StGB", "§ 227 StGB", "§ 229 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG", "Art. 103 Abs. 2 GG"],
        "description": "Körperverletzungsdelikte §§ 223-229 StGB – einfache, gefährliche, schwere KV, KV mit Todesfolge, fahrlässige KV",
        "aliases": ["einfache körperverletzung", "gefährliche körperverletzung", "schwere körperverletzung",
                    "fahrlässige körperverletzung", "körperverletzung mit todesfolge", "assault", "§ 223 stgb", "§ 224 stgb"]
    },
    "diebstahl": {
        "canonical_id": "DIEBSTAHL",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 242 StGB", "§ 243 StGB", "§ 244 StGB", "§ 244a StGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)", "Art. 103 Abs. 2 GG"],
        "description": "Diebstahl – Wegnahme einer fremden beweglichen Sache in Zueignungsabsicht",
        "aliases": ["theft", "wegnahme", "zueignungsabsicht", "wohnungseinbruchsdiebstahl", "einbruch", "§ 242 stgb"]
    },
    "betrug": {
        "canonical_id": "BETRUG",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 263 StGB", "§ 263a StGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)", "Art. 103 Abs. 2 GG"],
        "description": "Betrug – fünfgliedrige Kausalreihe: Täuschung → Irrtum → Verfügung → Schaden; Bereicherungsabsicht",
        "aliases": ["fraud", "täuschung", "vermögensschaden", "computerbetrug", "irrtum betrug", "§ 263 stgb"]
    },
    "noetigung": {
        "canonical_id": "NOETIGUNG",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 240 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 1 GG (indirect)", "Art. 103 Abs. 2 GG"],
        "description": "Nötigung – Gewalt oder Drohung zur Erzwingung von Handlung/Duldung/Unterlassen; Verwerflichkeitsklausel § 240 II",
        "aliases": ["nötigung", "coercion", "verwerflichkeitsklausel", "drohung stgb", "§ 240 stgb"]
    },
    "untreue": {
        "canonical_id": "UNTREUE",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 266 StGB"],
        "constitutional_basis": ["Art. 14 GG (indirect)", "Art. 103 Abs. 2 GG"],
        "description": "Untreue – Missbrauchstatbestand (Alt. 1) oder Treubruchtatbestand (Alt. 2) mit Vermögensnachteil",
        "aliases": ["breach of fiduciary duty", "missbrauchstatbestand", "treubruchtatbestand",
                    "vermögensnachteil", "fiduciary duty", "§ 266 stgb"]
    },
    "mord_totschlag_vergleich": {
        "canonical_id": "MORD_TOTSCHLAG_VERGLEICH",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 211 StGB", "§ 212 StGB", "§ 213 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG", "Art. 103 Abs. 2 GG"],
        "description": "Abgrenzung Mord (§ 211) vs. Totschlag (§ 212) – Mordmerkmale, Strafrahmen, Prüfungsschema",
        "aliases": [
            "unterschied mord totschlag", "mord vs totschlag", "mord oder totschlag",
            "abgrenzung mord totschlag", "§ 211 vs § 212", "mord und totschlag",
            "vergleich mord totschlag"
        ]
    },
    # ── Täterschaft und Teilnahme (§§ 25-27 StGB) ────────────────────────────
    "mittaeterschaft": {
        "canonical_id": "MITTAETERSCHAFT",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 25 Abs. 2 StGB"],
        "constitutional_basis": ["Art. 103 Abs. 2 GG"],
        "description": "Mittäterschaft – gemeinschaftliche Tatbegehung durch bewusstes und gewolltes Zusammenwirken; jeder Mittäter hat Tatherrschaft",
        "aliases": [
            "mittäter", "mittaeter", "gemeinschaftliche tatbegehung",
            "§ 25 ii stgb", "joint commission", "§ 25 abs. 2 stgb",
            "täterschaft stgb", "beteiligung täterschaft"
        ]
    },
    "mittelbare_taeterschaft": {
        "canonical_id": "MITTELBARE_TAETERSCHAFT",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 25 Abs. 1 Alt. 2 StGB"],
        "constitutional_basis": ["Art. 103 Abs. 2 GG"],
        "description": "Mittelbare Täterschaft – Begehung durch ein menschliches Werkzeug; Tatherrschaft kraft Irrtums, Nötigung oder Schuldunfähigkeit des Vordermanns",
        "aliases": [
            "mittelbare taeterschaft", "mittelbarer täter", "werkzeug stgb",
            "hintermann", "§ 25 i alt. 2 stgb", "indirect perpetration",
            "täter hinter dem täter"
        ]
    },
    "anstiftung": {
        "canonical_id": "ANSTIFTUNG",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 26 StGB"],
        "constitutional_basis": ["Art. 103 Abs. 2 GG"],
        "description": "Anstiftung – vorsätzliche Bestimmung eines anderen zur vorsätzlichen rechtswidrigen Tat; akzessorisch zur Haupttat",
        "aliases": [
            "anstifter", "bestimmung zur tat", "zur tat bestimmen",
            "incitement", "§ 26 stgb", "anstiftung stgb"
        ]
    },
    "beihilfe": {
        "canonical_id": "BEIHILFE",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 27 StGB"],
        "constitutional_basis": ["Art. 103 Abs. 2 GG"],
        "description": "Beihilfe – vorsätzliche Hilfeleistung zu einer fremden vorsätzlichen rechtswidrigen Tat; obligatorische Strafmilderung nach § 27 Abs. 2 i.V.m. § 49 Abs. 1 StGB",
        "aliases": [
            "gehilfe", "hilfeleistung stgb", "aiding and abetting",
            "§ 27 stgb", "strafmilderung beihilfe", "beihilfe stgb"
        ]
    },
    # ── Rechtfertigungs- und Entschuldigungsgründe ────────────────────────────
    "notwehr": {
        "canonical_id": "NOTWEHR",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 32 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG", "Art. 103 Abs. 2 GG"],
        "description": "Notwehr – Rechtfertigung durch erforderliche Verteidigung gegen gegenwärtigen rechtswidrigen Angriff; Nothilfe zugunsten Dritter",
        "aliases": [
            "nothilfe", "notwehrlage", "notwehrrecht", "notwehrexzess",
            "self-defence", "selbstverteidigung", "§ 32 stgb",
            "rechtfertigungsgrund notwehr", "putativnotwehr"
        ]
    },
    "notstand": {
        "canonical_id": "NOTSTAND",
        "hierarchy": "criminal_law_doctrine",
        "statutory_basis": ["§ 34 StGB", "§ 35 StGB"],
        "constitutional_basis": ["Art. 2 Abs. 2 GG", "Art. 103 Abs. 2 GG"],
        "description": "Notstand – rechtfertigender Notstand (§ 34) bei Interessenabwägung; entschuldigender Notstand (§ 35) bei Unzumutbarkeit normgemäßen Verhaltens",
        "aliases": [
            "rechtfertigender notstand", "entschuldigender notstand",
            "§ 34 stgb", "§ 35 stgb", "necessity", "aggressivnotstand",
            "defensivnotstand", "übergesetzlicher notstand"
        ]
    },
}

DOCTRINE_LOOKUP = {}
for term, canonical_id in CANONICAL_DOCTRINES.items():
    DOCTRINE_LOOKUP[term] = {
        "canonical_id": canonical_id,
        "hierarchy": "constitutional",
        "constitutional_basis": ["Art. 20 GG", "Art. 103 GG"],
        "statutory_basis": None,
        "description": "Fundamental constitutional principle"
    }

for term, metadata in CIVIL_LAW_DOCTRINES.items():
    DOCTRINE_LOOKUP[term] = metadata
    for alias in metadata.get("aliases", []):
        DOCTRINE_LOOKUP[alias] = metadata

SETTLED_DOCTRINES = set(DOCTRINE_LOOKUP.keys())

class DoctrineGuard:
    """Doctrine detection and metadata"""
    
    @staticmethod
    def get_doctrinal_empty_result(doctrine_mode: bool = True, 
                                  doctrine_metadata: dict = None) -> dict:
        """Return empty result for doctrinal questions"""
        default_metadata = {
            "canonical_id": "GENERAL_DOCTRINE",
            "hierarchy": "constitutional",
            "constitutional_basis": ["Art. 20 GG", "Art. 103 GG"],
            "statutory_basis": None,
            "description": "General constitutional principle"
        }
        
        metadata = doctrine_metadata or default_metadata
        hierarchy = metadata.get("hierarchy", "constitutional")
        
        if hierarchy == "civil_law_doctrine":
            constitutional_basis = metadata.get("constitutional_basis", ["Art. 2 Abs. 1 GG (indirect)"])
            statutory_basis = metadata.get("statutory_basis", [])
            legal_hierarchy = "civil_law_doctrine"
            doctrinal_template = "civil_law_principle"
            message = f"No retrieval for civil law doctrine: {metadata.get('canonical_id')}"
        else:
            constitutional_basis = metadata.get("constitutional_basis", ["Art. 20 GG", "Art. 103 GG"])
            statutory_basis = None
            legal_hierarchy = "constitutional"
            doctrinal_template = "constitutional_principle"
            message = f"No retrieval for constitutional doctrine: {metadata.get('canonical_id')}"
        
        return {
            "results": [],
            "terminal": True,
            "mode": "DOCTRINAL_ONLY",
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "constitutional_basis": constitutional_basis,
                "statutory_basis": statutory_basis,
                "legal_hierarchy": legal_hierarchy,
                "doctrine_mode": doctrine_mode,
                "canonical_doctrine": metadata.get("canonical_id"),
                "doctrine_description": metadata.get("description"),
                "retrieval_performed": False,
                "retrieval_blocked": True,
                "has_real_norms": False,
                "doctrinal_template": doctrinal_template,
                "doctrine_blocking_applied": True,
                "doctrine_enforcement_blocked": True,
                "terminal": True
            },
            "authority_validation": {
                "status": "doctrinal_early_exit",
                "message": message,
                "doctrine": {
                    "applied": True,
                    "status": "settled_doctrine_no_retrieval",
                    "canonical_doctrine": metadata.get("canonical_id"),
                    "hierarchy": legal_hierarchy,
                    "blocking_invariant": "enforced"
                }
            },
            "requires_clarification": False,
            "doctrine_metadata": {
                "status": "settled_doctrine_no_retrieval",
                "canonical_doctrine": metadata.get("canonical_id"),
                "doctrinal_template": doctrinal_template,
                "applied": True,
                "retrieval_blocked": True,
                "type": "blocking_not_enforcement",
                "hierarchy_level": legal_hierarchy,
                "terminal": True
            }
        }

# ✅ CRITICAL: Export all necessary symbols
__all__ = [
    'DoctrineGuard', 
    'DOCTRINAL_QUESTION_TYPES', 
    'SETTLED_DOCTRINES', 
    'DOCTRINE_LOOKUP',
    'CANONICAL_DOCTRINES',
    'CIVIL_LAW_DOCTRINES'
]