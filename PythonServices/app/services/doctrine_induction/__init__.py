"""
DOCTRINE INDUCTION MODULE
========================

Purpose:
Formalizes doctrinal reasoning as a first-class system layer in legal AI systems.

Core Responsibility:
Transforms statutory material and authoritative norms into structured legal principles,
rules, definitions, and tests that explain HOW the law operates.

Key Features:
- Doctrine synthesis from norms
- Structural validation
- Template-based doctrinal framing
- Exam-grade legal reasoning preparation
- Automated doctrine orchestration (NEW)

Architectural Position:
This module sits BETWEEN authority/norm retrieval and answer composition.
It receives authoritative content and outputs structured doctrine.

STRICT BOUNDARIES:
- NEVER retrieves documents
- NEVER ranks authorities
- NEVER decides jurisdiction
- ONLY structures legal reasoning

Version: 2.0.0 (Now includes DoctrineInductor orchestration)
"""

from .doctrine_builder import DoctrineBuilder, LegalElement, DoctrinalTest
from .doctrine_validator import DoctrineValidator, ValidationResult, ValidationRule
from .doctrine_templates import (
    DoctrineTemplates, 
    TemplateType, 
    DefinitionTemplate,
    RuleTemplate,
    PrincipleTemplate,
    TestTemplate
)
from typing import Dict
from .doctrine_inductor import (
    DoctrineInductor,
    InductionConfig,
    InductionContext,
    DoctrineInductionResult,
    create_doctrine_inductor,
    get_default_inductor
)

__all__ = [
    # Builder
    "DoctrineBuilder",
    "LegalElement",
    "DoctrinalTest",
    
    # Validator
    "DoctrineValidator",
    "ValidationResult",
    "ValidationRule",
    
    # Templates
    "DoctrineTemplates",
    "TemplateType",
    "DefinitionTemplate",
    "RuleTemplate",
    "PrincipleTemplate",
    "TestTemplate",
    
    # Inductor (NEW - Complete Orchestration Layer)
    "DoctrineInductor",
    "InductionConfig",
    "InductionContext",
    "DoctrineInductionResult",
    "create_doctrine_inductor",
    "get_default_inductor"
]

__version__ = "2.0.0"

# Module metadata for system integration
MODULE_METADATA = {
    "name": "doctrine_induction",
    "version": __version__,
    "description": "Transforms norms into structured legal doctrine with automated orchestration",
    "dependencies": [],
    "input_requirements": ["authoritative_content", "norm_context", "question_context"],
    "output_type": "structured_doctrine_with_orchestration",
    "strict_boundaries": {
        "no_retrieval": True,
        "no_authority_ranking": True,
        "no_jurisdiction_decisions": True,
        "no_answer_composition": True
    },
    "components": {
        "builder": "Synthesizes doctrine from authoritative materials",
        "validator": "Validates doctrinal legitimacy and completeness",
        "templates": "Defines doctrinal structures and field rules (single source of truth)",
        "inductor": "Orchestrates doctrine application from question to examiner-ready output"
    },
    "capabilities": {
        "field_detection": "Automatically identifies applicable doctrinal fields",
        "doctrine_synthesis": "Builds structured doctrine from norms",
        "validation": "Ensures legal correctness and prevents hallucination",
        "examiner_grading": "Prepares doctrine for exam-level legal reasoning",
        "confidence_scoring": "Calculates reliability scores for doctrine application",
        "implicit_authority": "Handles implicit statutory references per civil law"
    },
    "integration_points": {
        "retrieval_service": "Receives authority-contracted retrieval results",
        "answer_composer": "Provides validated doctrine for answer construction",
        "question_analyzer": "Accepts question context for field determination"
    }
}

# Public API functions
def get_doctrine_explanation(doctrine_name: str, language: str = 'german'):
    """Get doctrine/principle explanation."""

    _SCHADENSERSATZ = {
        'type': 'RULE',
        'domain': 'tort_law',
        'explanation': {
            'german': (
                "**Schadensersatz (§§ 249–253 BGB)**\n\n"
                "**Rechtsnatur:** Primäres Wiedergutmachungsinstrument des deutschen Schuldrechts. "
                "Der Schadensersatzanspruch verpflichtet den Schuldner, den aus einer Pflichtverletzung "
                "oder unerlaubten Handlung entstandenen Schaden vollständig zu ersetzen.\n\n"
                "**Grundsatz der Naturalrestitution (§ 249 Abs. 1 BGB):** Der Ersatzpflichtige hat den "
                "Zustand wiederherzustellen, der bestehen würde, wenn der zum Ersatz verpflichtende "
                "Umstand nicht eingetreten wäre. Naturalrestitution hat Vorrang vor Geldersatz.\n\n"
                "**Geldersatz (§§ 250–251 BGB):**\n"
                "- § 250 BGB: Geldersatz nach erfolglosem Ablauf einer vom Geschädigten gesetzten Frist.\n"
                "- § 251 BGB: Geldersatz, wenn Naturalherstellung unmöglich oder zur Entschädigung "
                "des Geschädigten nicht ausreichend ist.\n\n"
                "**Entgangener Gewinn (§ 252 BGB):** Der zu ersetzende Schaden umfasst auch den "
                "entgangenen Gewinn. Als entgangen gilt der Gewinn, welcher nach dem gewöhnlichen Lauf "
                "der Dinge oder nach den besonderen Umständen mit Wahrscheinlichkeit erwartet werden konnte.\n\n"
                "**Immaterieller Schaden / Schmerzensgeld (§ 253 BGB):** Bei Verletzung des Körpers, "
                "der Gesundheit, der Freiheit oder der sexuellen Selbstbestimmung kann eine billige "
                "Entschädigung in Geld (Schmerzensgeld) gefordert werden.\n\n"
                "**Voraussetzungen des Schadensersatzanspruchs:**\n"
                "1. Haftungsgrundlage (z.B. §§ 280, 281, 823, 826 BGB)\n"
                "2. Schaden (nach der Differenzhypothese)\n"
                "3. Kausalität (haftungsbegründend und haftungsausfüllend)\n"
                "4. Rechtswidrigkeit und Verschulden (soweit nach Anspruchsgrundlage erforderlich)\n\n"
                "**Schadensberechnung (Differenzhypothese):** Vergleich des tatsächlichen Vermögens-"
                "zustands des Geschädigten mit dem hypothetischen Zustand ohne das schädigende Ereignis. "
                "Adäquanzkausalität und Schutzzweck der Norm begrenzen den Umfang der Ersatzpflicht."
            ),
            'english': (
                "**Schadensersatz – Law of Damages (§§ 249–253 BGB)**\n\n"
                "**Legal Nature:** The primary remedy for civil wrongs under German law. "
                "It obligates the liable party to make the injured party whole.\n\n"
                "**Natural Restitution (§ 249 I BGB):** The liable party must restore the state "
                "that would exist had the damaging event not occurred. Natural restitution takes "
                "priority over monetary compensation.\n\n"
                "**Monetary Compensation (§§ 250–251 BGB):** Available where natural restitution "
                "is impossible, insufficient, or not effected within a set deadline.\n\n"
                "**Lost Profit (§ 252 BGB):** Compensable profits the claimant would ordinarily "
                "have expected to earn.\n\n"
                "**Non-Material Damages / Pain and Suffering (§ 253 BGB):** Monetary compensation "
                "for non-economic harm (Schmerzensgeld) is available for bodily injury, harm to health, "
                "liberty, or sexual self-determination.\n\n"
                "**Requirements:** (1) basis of liability (e.g. §§ 280, 823 BGB), (2) damage, "
                "(3) causation, (4) unlawfulness and fault where required.\n\n"
                "**Damage Calculation (Differenzhypothese):** Comparison of the claimant's actual "
                "asset position with the hypothetical position absent the damaging event."
            ),
        },
        'sources': ['§ 249 BGB', '§ 250 BGB', '§ 251 BGB', '§ 252 BGB', '§ 253 BGB'],
    }

    _VERJÄHRUNG = {
        'type': 'RULE',
        'domain': 'civil_doctrine',
        'explanation': {
            'german': (
                "**Verjährung (§§ 194–218 BGB)**\n\n"
                "**Begriff:** Verjährung bedeutet, dass der Schuldner nach Ablauf der "
                "gesetzlichen Frist berechtigt ist, die Leistung zu verweigern (§ 214 Abs. 1 BGB). "
                "Der Anspruch erlischt nicht, aber seine Durchsetzbarkeit entfällt.\n\n"
                "**Regelverjährung (§ 195 BGB):** Die regelmäßige Verjährungsfrist beträgt "
                "drei Jahre. Sie gilt für die meisten vertraglichen und deliktischen Ansprüche.\n\n"
                "**Beginn der Verjährung (§ 199 BGB):**\n"
                "Die Regelverjährung beginnt mit dem Schluss des Jahres, in dem\n"
                "1. der Anspruch entstanden ist und\n"
                "2. der Gläubiger von den den Anspruch begründenden Umständen und der Person "
                "des Schuldners Kenntnis erlangt oder ohne grobe Fahrlässigkeit erlangen müsste.\n\n"
                "**Besondere Verjährungsfristen:**\n"
                "- § 196 BGB: 10 Jahre für Ansprüche auf Übertragung von Rechten an Grundstücken.\n"
                "- § 197 BGB: 30 Jahre für rechtskräftig festgestellte Ansprüche, Herausgabe- "
                "und Eigentümeransprüche.\n"
                "- § 438 BGB: 2 Jahre für Mängelansprüche beim Kauf (bewegliche Sachen).\n"
                "- § 634a BGB: 2 Jahre für Mängelansprüche beim Werkvertrag (bewegliche Sachen).\n"
                "- § 548 BGB: 6 Monate für Ansprüche des Vermieters nach Rückgabe der Mietsache.\n\n"
                "**Hemmung der Verjährung (§§ 203–211 BGB):**\n"
                "Die Verjährung wird gehemmt (Zeit läuft nicht) bei:\n"
                "- Verhandlungen zwischen Gläubiger und Schuldner (§ 203 BGB).\n"
                "- Klageerhebung und gerichtlichen Verfahren (§ 204 BGB).\n"
                "- Höherer Gewalt (§ 206 BGB).\n\n"
                "**Neubeginn der Verjährung (§ 212 BGB):**\n"
                "Die Verjährung beginnt erneut, wenn der Schuldner den Anspruch durch "
                "Abschlagszahlung, Zinszahlung, Sicherheitsleistung oder in anderer Weise "
                "anerkennt (§ 212 Abs. 1 Nr. 1 BGB), oder wenn eine gerichtliche "
                "Vollstreckungshandlung vorgenommen wird.\n\n"
                "**Rechtsfolge (§ 214 BGB):**\n"
                "Nach Eintritt der Verjährung kann der Schuldner die Leistung dauerhaft "
                "verweigern (dauernde Einrede). Die Einrede muss vom Schuldner erhoben werden; "
                "das Gericht berücksichtigt die Verjährung nicht von Amts wegen."
            ),
            'english': (
                "**Verjährung – Statute of Limitations (§§ 194–218 BGB)**\n\n"
                "**Definition:** Verjährung (limitation) entitles the debtor to refuse "
                "performance after the statutory period has expired (§ 214 I BGB). The claim "
                "itself survives but becomes unenforceable.\n\n"
                "**Regular Limitation Period (§ 195 BGB):** 3 years. Applies to most "
                "contractual and tort claims.\n\n"
                "**Commencement (§ 199 BGB):** The regular period begins at the end of the "
                "year in which (1) the claim arose and (2) the creditor knew or, without gross "
                "negligence, ought to have known the facts giving rise to the claim and the "
                "identity of the debtor.\n\n"
                "**Special Periods:**\n"
                "- § 196: 10 years for real property transfer claims.\n"
                "- § 197: 30 years for enforceable judgments and property restitution claims.\n"
                "- § 438: 2 years for sale-of-goods defect claims.\n"
                "- § 548: 6 months for landlord's claims after return of leased property.\n\n"
                "**Suspension (Hemmung, §§ 203–211 BGB):** The limitation period is suspended "
                "(time stops running) during negotiations (§ 203), court proceedings (§ 204), "
                "and force majeure (§ 206).\n\n"
                "**Recommencement (Neubeginn, § 212 BGB):** The period restarts if the debtor "
                "acknowledges the claim by part-payment, interest payment, or other conduct.\n\n"
                "**Effect (§ 214 BGB):** The debtor gains a permanent defence (dauernde Einrede) "
                "which must be affirmatively raised; courts do not apply it ex officio."
            ),
        },
        'sources': ['§ 194 BGB', '§ 195 BGB', '§ 199 BGB', '§ 203 BGB', '§ 212 BGB', '§ 214 BGB'],
    }

    _ANGEBOT_ANNAHME = {
        'type': 'RULE',
        'domain': 'civil_doctrine',
        'explanation': {
            'german': (
                "**Angebot und Annahme (§§ 145–150 BGB)**\n\n"
                "Ein Vertrag kommt durch zwei übereinstimmende Willenserklärungen zustande: "
                "Angebot (Antrag) und Annahme.\n\n"
                "**Angebot (§ 145 BGB):** Der Antrag ist eine empfangsbedürftige Willenserklärung, "
                "die alle wesentlichen Vertragsbestandteile (essentialia negotii) enthält und "
                "auf Vertragsschluss gerichtet ist. Der Antragende ist daran gebunden, "
                "es sei denn, er hat die Gebundenheit ausgeschlossen.\n\n"
                "**Annahme (§ 147 BGB):** Die Annahme muss rechtzeitig erfolgen. "
                "Unter Anwesenden: sofortige Annahme; unter Abwesenden: innerhalb der Frist, "
                "die der Antragende bestimmt hat, sonst innerhalb angemessener Zeit (§ 147 Abs. 2 BGB).\n\n"
                "**Verspätete/abweichende Annahme (§§ 149–150 BGB):** "
                "Eine verspätete Annahme gilt als neuer Antrag (§ 150 Abs. 1 BGB). "
                "Eine Annahme mit Änderungen gilt als Ablehnung verbunden mit neuem Antrag "
                "(§ 150 Abs. 2 BGB — Abänderungsantrag)."
            ),
            'english': (
                "**Angebot und Annahme – Offer and Acceptance (§§ 145–150 BGB)**\n\n"
                "A contract is formed by two matching declarations of intent: offer (Antrag) and "
                "acceptance (Annahme).\n\n"
                "**Offer (§ 145 BGB):** Must contain all material terms (essentialia negotii) "
                "and be directed at concluding a contract. The offeror is bound unless they "
                "excluded bindingness.\n\n"
                "**Acceptance (§ 147 BGB):** Must be timely. Between parties present: immediate; "
                "between absent parties: within the period set by the offeror, or else within a "
                "reasonable time (§ 147 II BGB).\n\n"
                "**Late or modified acceptance (§§ 149–150 BGB):** A late acceptance is treated "
                "as a new offer (§ 150 I). An acceptance with modifications is a rejection plus "
                "counter-offer (§ 150 II)."
            ),
        },
        'sources': ['§ 145 BGB', '§ 147 BGB', '§ 150 BGB'],
    }

    _GESCHAEFTSFAEHIGKEIT = {
        'type': 'RULE',
        'domain': 'civil_doctrine',
        'explanation': {
            'german': (
                "**Geschäftsfähigkeit (§§ 104–113 BGB)**\n\n"
                "Geschäftsfähigkeit ist die Fähigkeit, Rechtsgeschäfte wirksam vorzunehmen.\n\n"
                "**Geschäftsunfähigkeit (§ 104 BGB):** Geschäftsunfähig sind\n"
                "- Kinder unter 7 Jahren (§ 104 Nr. 1 BGB);\n"
                "- Personen, die sich in einem dauerhaften Zustand krankhafter Störung der "
                "Geistestätigkeit befinden (§ 104 Nr. 2 BGB).\n"
                "Willenserklärungen Geschäftsunfähiger sind nichtig (§ 105 BGB).\n\n"
                "**Beschränkte Geschäftsfähigkeit (§§ 106–113 BGB):** Minderjährige ab 7 Jahren "
                "sind beschränkt geschäftsfähig. Ihre Willenserklärungen sind schwebend unwirksam "
                "und bedürfen der Genehmigung des gesetzlichen Vertreters, es sei denn, sie sind "
                "lediglich rechtlich vorteilhaft (§ 107 BGB — 'Taschengeldparagraph' § 110 BGB).\n\n"
                "**Volle Geschäftsfähigkeit** tritt mit Vollendung des 18. Lebensjahres ein (§ 2 BGB)."
            ),
            'english': (
                "**Geschäftsfähigkeit – Legal Capacity (§§ 104–113 BGB)**\n\n"
                "Legal capacity is the ability to enter into legally binding transactions.\n\n"
                "**No capacity (§ 104 BGB):** Children under 7 and persons with a permanent "
                "mental disorder. Their declarations are void (§ 105 BGB).\n\n"
                "**Limited capacity (§§ 106–113 BGB):** Minors aged 7–17. Their declarations are "
                "provisionally ineffective and require parental consent, unless they are purely "
                "advantageous (§ 107 BGB) or covered by the pocket-money rule (§ 110 BGB).\n\n"
                "**Full capacity** is acquired at age 18 (§ 2 BGB)."
            ),
        },
        'sources': ['§ 2 BGB', '§ 104 BGB', '§ 105 BGB', '§ 106 BGB', '§ 107 BGB', '§ 110 BGB'],
    }

    _STELLVERTRETUNG = {
        'type': 'RULE',
        'domain': 'civil_doctrine',
        'explanation': {
            'german': (
                "**Stellvertretung (§§ 164–181 BGB)**\n\n"
                "Der Vertreter gibt eine eigene Willenserklärung im Namen des Vertretenen ab, "
                "die unmittelbar für und gegen den Vertretenen wirkt (§ 164 Abs. 1 BGB).\n\n"
                "**Voraussetzungen:**\n"
                "1. Eigene Willenserklärung des Vertreters.\n"
                "2. Offenkundigkeit des Handelns im fremden Namen (Offenkundigkeitsprinzip).\n"
                "3. Vertretungsmacht (Vollmacht, § 166 BGB, oder gesetzliche Vertretung).\n\n"
                "**Vollmacht (§§ 166–176 BGB):** Einseitige, empfangsbedürftige Willenserklärung "
                "des Vollmachtgebers. Unterschied zwischen Innen- und Außenverhältnis.\n\n"
                "**Vertretung ohne Vertretungsmacht (§§ 177–180 BGB):** "
                "Der vollmachtlose Vertreter (falsus procurator) schließt einen schwebend "
                "unwirksamen Vertrag; Genehmigung des Vertretenen möglich (§ 177 BGB). "
                "Ohne Genehmigung haftet der falsus procurator dem Dritten auf Erfüllung oder "
                "Schadensersatz (§ 179 BGB).\n\n"
                "**Insichgeschäft (§ 181 BGB):** In der Regel unzulässig."
            ),
            'english': (
                "**Stellvertretung – Agency / Representation (§§ 164–181 BGB)**\n\n"
                "An agent makes a declaration of intent in the principal's name that takes "
                "direct legal effect for and against the principal (§ 164 I BGB).\n\n"
                "**Requirements:** (1) own declaration by the agent, (2) acting in the principal's "
                "name (Offenkundigkeitsprinzip), (3) authority (Vollmacht or statutory power).\n\n"
                "**Authority (§§ 166–176 BGB):** Granted by unilateral declaration. The scope "
                "of internal mandate (Auftrag) and external authority (Vollmacht) may differ.\n\n"
                "**Unauthorized agent (§§ 177–180 BGB):** Contract is provisionally ineffective; "
                "ratification by principal possible (§ 177). Without ratification the agent is "
                "personally liable for performance or damages (§ 179 BGB).\n\n"
                "**Self-dealing (§ 181 BGB):** Generally prohibited."
            ),
        },
        'sources': ['§ 164 BGB', '§ 166 BGB', '§ 177 BGB', '§ 179 BGB', '§ 181 BGB'],
    }

    _BEREICHERUNG = {
        'type': 'RULE',
        'domain': 'civil_doctrine',
        'explanation': {
            'german': (
                "**Ungerechtfertigte Bereicherung (§§ 812–822 BGB)**\n\n"
                "Wer durch die Leistung eines anderen oder in sonstiger Weise auf dessen Kosten "
                "etwas ohne rechtlichen Grund erlangt, ist ihm zur Herausgabe verpflichtet "
                "(§ 812 Abs. 1 S. 1 BGB).\n\n"
                "**Arten der Kondiktionen:**\n"
                "- **Leistungskondiktion (§ 812 Abs. 1 S. 1 Alt. 1 BGB):** Bereicherung durch "
                "Leistung (Zahlung, Übereignung) ohne Rechtsgrund oder mit weggefallener causa.\n"
                "- **Nichtleistungskondiktion (§ 812 Abs. 1 S. 1 Alt. 2 BGB):** Bereicherung "
                "in sonstiger Weise (Eingriff, Verwendung, Rückgriffskondiktion).\n\n"
                "**Voraussetzungen der Leistungskondiktion:**\n"
                "1. Bereicherung des Schuldners.\n"
                "2. Auf Kosten des Gläubigers.\n"
                "3. Durch Leistung des Gläubigers.\n"
                "4. Ohne rechtlichen Grund (condictio indebiti, § 812 Abs. 1 S. 1 BGB) oder "
                "Wegfall des Grundes (§ 812 Abs. 1 S. 2 BGB) oder Nichteintritt des bezweckten "
                "Erfolgs.\n\n"
                "**Rechtsfolge (§§ 818–822 BGB):** Herausgabe des Erlangten; "
                "bei Unmöglichkeit Wertersatz (§ 818 Abs. 2 BGB). "
                "Wegfall der Bereicherung schützt gutgläubigen Empfänger (§ 818 Abs. 3 BGB), "
                "nicht jedoch den bösgläubigen (§ 819 BGB)."
            ),
            'english': (
                "**Ungerechtfertigte Bereicherung – Unjust Enrichment (§§ 812–822 BGB)**\n\n"
                "Whoever obtains something at another's expense without legal justification must "
                "return it (§ 812 I 1 BGB).\n\n"
                "**Types of condictio:**\n"
                "- **Leistungskondiktion (§ 812 I 1 alt. 1):** Enrichment through the claimant's "
                "own performance without legal basis.\n"
                "- **Nichtleistungskondiktion (§ 812 I 1 alt. 2):** Enrichment by other means "
                "(interference, use of another's assets).\n\n"
                "**Requirements:** (1) enrichment of the defendant, (2) at the claimant's expense, "
                "(3) through performance or otherwise, (4) without legal justification.\n\n"
                "**Remedy (§§ 818–822 BGB):** Return of the enrichment; if impossible, monetary "
                "value (§ 818 II). Good-faith enrichees may invoke change-of-position defence "
                "(§ 818 III); bad-faith enrichees may not (§ 819 BGB)."
            ),
        },
        'sources': ['§ 812 BGB', '§ 818 BGB', '§ 819 BGB'],
    }

    _WILLENSERKLARUNG = {
        'type': 'RULE',
        'domain': 'civil_doctrine',
        'explanation': {
            'german': (
                "**Willenserklärung (§§ 116–144 BGB)**\n\n"
                "**Begriff:** Eine Willenserklärung ist die Äußerung eines auf die Herbeiführung "
                "einer Rechtsfolge gerichteten Willens. Sie ist das zentrale Instrument des "
                "Rechtsgeschäftslehre im deutschen Zivilrecht.\n\n"
                "**Bestandteile:**\n"
                "- **Handlungswille:** Bewusstsein, überhaupt zu handeln.\n"
                "- **Erklärungsbewusstsein:** Bewusstsein, eine rechtlich relevante Erklärung "
                "abzugeben (str.; hM: nicht erforderlich, wenn Erklärungsbewusstsein bei "
                "Anwendung der nötigen Sorgfalt vorhanden sein musste).\n"
                "- **Geschäftswille:** Wille, eine bestimmte Rechtsfolge herbeizuführen.\n\n"
                "**Arten der Willenserklärung:**\n"
                "- **Ausdrücklich:** verbal oder schriftlich (§ 126 ff. BGB für Formvorschriften).\n"
                "- **Konkludent:** durch schlüssiges Verhalten.\n"
                "- **Schweigen:** grundsätzlich keine Willenserklärung, außer gesetzlich "
                "bestimmt oder im kaufmännischen Verkehr.\n\n"
                "**Wirksamkeit und Zugang (§ 130 BGB):**\n"
                "Eine empfangsbedürftige Willenserklärung wird wirksam, wenn sie dem Empfänger "
                "zugeht (Zugangstheorie). Zugang tritt ein, wenn die Erklärung so in den "
                "Machtbereich des Empfängers gelangt ist, dass dieser unter normalen Umständen "
                "von ihr Kenntnis nehmen kann.\n\n"
                "**Mängel der Willenserklärung (§§ 116–122 BGB):**\n"
                "- § 116 BGB: Geheimer Vorbehalt (unbeachtlich, wenn dem Empfänger unbekannt).\n"
                "- § 117 BGB: Scheingeschäft (nichtig).\n"
                "- § 118 BGB: Fehlende Ernstlichkeit (nichtig).\n"
                "- § 119 BGB: Irrtum (anfechtbar: Inhalts- oder Erklärungsirrtum).\n"
                "- § 120 BGB: Falsche Übermittlung (wie Irrtum behandelt).\n"
                "- § 121 BGB: Anfechtungsfrist (unverzüglich nach Kenntnis).\n"
                "- § 122 BGB: Ersatzpflicht bei Anfechtung (negatives Interesse).\n\n"
                "**Auslegung (§§ 133, 157 BGB):**\n"
                "§ 133 BGB: Bei der Auslegung einer Willenserklärung ist der wirkliche Wille "
                "zu erforschen, nicht am buchstäblichen Sinn des Ausdrucks zu haften. "
                "§ 157 BGB: Verträge sind so auszulegen, wie Treu und Glauben mit Rücksicht "
                "auf die Verkehrssitte es erfordern.\n\n"
                "**Angebot und Annahme (§§ 145–150 BGB):**\n"
                "Ein Vertrag kommt durch zwei übereinstimmende Willenserklärungen (Angebot und "
                "Annahme) zustande. Das Angebot bindet den Offerenten bis zum Ablauf der "
                "Annahmefrist (§ 145 BGB)."
            ),
            'english': (
                "**Willenserklärung – Declaration of Intent (§§ 116–144 BGB)**\n\n"
                "**Definition:** A Willenserklärung is an expression of will directed at "
                "producing a legal effect. It is the core instrument of the German law of "
                "juridical acts (Rechtsgeschäftslehre).\n\n"
                "**Elements:**\n"
                "- **Handlungswille:** Awareness of acting at all.\n"
                "- **Erklärungsbewusstsein:** Awareness that the act has legal significance "
                "(majority view: not required if it should have been apparent with due care).\n"
                "- **Geschäftswille:** Intention to bring about a specific legal consequence.\n\n"
                "**Types:**\n"
                "- **Express:** verbal or written (§§ 126 ff. BGB for formal requirements).\n"
                "- **Implied (konkludent):** by conduct.\n"
                "- **Silence:** generally not a declaration, except by statute or commercial usage.\n\n"
                "**Receipt and Effect (§ 130 BGB):**\n"
                "A declaration requiring receipt becomes effective upon receipt (Zugangstheorie): "
                "when it enters the recipient's sphere of influence so that they can normally "
                "take note of it.\n\n"
                "**Defects (§§ 116–122 BGB):**\n"
                "- § 119 BGB: Mistake of content or declaration (voidable).\n"
                "- § 117 BGB: Simulated declaration (void).\n"
                "- § 122 BGB: Liability for reliance damages upon avoidance.\n\n"
                "**Interpretation (§§ 133, 157 BGB):**\n"
                "Declarations are interpreted according to the true intent (§ 133) and the "
                "requirements of good faith and commercial usage (§ 157).\n\n"
                "**Offer and Acceptance (§§ 145–150 BGB):**\n"
                "A contract requires two matching declarations of intent. An offer is binding "
                "until the acceptance period expires (§ 145 BGB)."
            ),
        },
        'sources': ['§ 116 BGB', '§ 119 BGB', '§ 130 BGB', '§ 133 BGB', '§ 145 BGB', '§ 157 BGB'],
    }

    _KOERPERVERLETZUNG = {
        'type': 'RULE',
        'domain': 'cross_statute',
        'explanation': {
            'german': (
                "**Körperverletzung – Strafrecht (StGB) vs. Zivilrecht (BGB)**\n\n"
                "**Grundprinzip:** Dieselbe körperverletzende Handlung kann gleichzeitig "
                "strafrechtliche Strafbarkeit und zivilrechtliche Schadensersatzpflicht begründen. "
                "Strafverfolgung und zivilrechtlicher Anspruch schließen sich nicht gegenseitig aus.\n\n"
                "**Strafrechtliche Haftung – StGB §§ 223–229:**\n"
                "- § 223 StGB (Körperverletzung): Vorsätzliche körperliche Misshandlung oder "
                "Gesundheitsschädigung; Freiheitsstrafe bis zu 5 Jahren oder Geldstrafe.\n"
                "- § 224 StGB (Gefährliche Körperverletzung): Qualifizierter Tatbestand bei Einsatz "
                "von Waffen, gefährlichen Werkzeugen, hinterlistigem Überfall oder gemeinschaftlicher Begehung.\n"
                "- § 225 StGB (Misshandlung von Schutzbefohlenen): Erhöhter Schutz für Personen unter "
                "besonderer Fürsorge.\n"
                "- § 226 StGB (Schwere Körperverletzung): Verlust von Gliedmaßen, Sehvermögen, Gehör "
                "oder schwerwiegende dauerhafte Schäden.\n"
                "- § 229 StGB (Fahrlässige Körperverletzung): Fahrlässige Herbeiführung einer "
                "Körperverletzung ist strafbar.\n\n"
                "**Zivilrechtliche Haftung – BGB § 823:**\n"
                "- § 823 Abs. 1 BGB: Wer vorsätzlich oder fahrlässig das Leben, den Körper, die "
                "Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich "
                "verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet.\n"
                "- § 823 Abs. 2 BGB: Gleiches gilt für denjenigen, der gegen ein den Schutz eines anderen "
                "bezweckendes Gesetz verstößt (Schutzgesetzverletzung — die Strafnormen der §§ 223 ff. StGB "
                "sind solche Schutzgesetze).\n\n"
                "**Kumulative Anwendbarkeit (Anspruchskonkurrenz):**\n"
                "Strafrechtliche Verurteilung und zivilrechtlicher Schadensersatz können nebeneinander "
                "bestehen. Der Strafanspruch des Staates und der Schadensersatzanspruch des Opfers sind "
                "unabhängig voneinander. Zivilrechtliche Ansprüche (Schmerzensgeld nach § 253 BGB, "
                "materieller Schadensersatz nach §§ 249 ff. BGB) bleiben auch bei strafrechtlicher "
                "Erledigung vollständig erhalten.\n\n"
                "**Wann gilt StGB, wann BGB?**\n"
                "- StGB: Staatliche Strafverfolgung wegen des öffentlich-rechtlichen Unrechtsgehalts.\n"
                "- BGB § 823: Privater Schadensersatzanspruch des Verletzten gegen den Schädiger.\n"
                "- Beide Rechtswege sind kumulativ anwendbar — eine Strafanzeige schließt "
                "eine Zivilklage nicht aus und umgekehrt."
            ),
            'english': (
                "**Körperverletzung (Bodily Harm) – Criminal Law (StGB) vs. Civil Law (BGB)**\n\n"
                "**Core Principle:** The same act of bodily harm can simultaneously give rise to "
                "criminal liability and civil damages. Criminal prosecution and civil claims are "
                "independent and do not preclude each other.\n\n"
                "**Criminal Liability – StGB §§ 223–229:**\n"
                "- § 223 StGB (Simple bodily harm): Intentional physical ill-treatment or impairment "
                "of health; up to 5 years imprisonment or fine.\n"
                "- § 224 StGB (Dangerous bodily harm): Qualified offence using weapons, dangerous "
                "instruments, ambush, or joint commission.\n"
                "- § 226 StGB (Grievous bodily harm): Loss of limb, sight, hearing, or permanent "
                "severe damage.\n"
                "- § 229 StGB (Negligent bodily harm): Negligently causing bodily harm is also "
                "a criminal offence.\n\n"
                "**Civil Liability – BGB § 823:**\n"
                "- § 823 I BGB: Whoever intentionally or negligently injures another person's life, "
                "body, health, freedom, or property is obliged to compensate the resulting damage.\n"
                "- § 823 II BGB: The same applies to violation of a protective statute (Schutzgesetz); "
                "StGB §§ 223 ff. qualify as such protective statutes.\n\n"
                "**Cumulative Application:**\n"
                "Criminal conviction and civil damages can coexist. The state's punitive claim and the "
                "victim's compensation claim are independent. Civil remedies (Schmerzensgeld under § 253 BGB, "
                "material damages under §§ 249 ff. BGB) remain fully available even after criminal "
                "proceedings have concluded.\n\n"
                "**When StGB, when BGB?**\n"
                "- StGB: Public law criminal prosecution for the social harm.\n"
                "- BGB § 823: Private law damages claim by the injured party against the wrongdoer.\n"
                "- Both apply simultaneously — a criminal complaint does not bar a civil suit."
            ),
        },
        'sources': ['§ 223 StGB', '§ 224 StGB', '§ 226 StGB', '§ 229 StGB', '§ 823 BGB', '§ 253 BGB'],
    }

    _KAUFMANN = {
        'type': 'RULE',
        'domain': 'commercial_law',
        'explanation': {
            'german': (
                "**Kaufmannsbegriff (§§ 1–6 HGB)**\n\n"
                "Das HGB unterscheidet drei Grundtypen des Kaufmanns:\n\n"
                "**1. Istkaufmann (§ 1 HGB):** Wer ein Handelsgewerbe betreibt, ist Kaufmann "
                "(Muss-Kaufmann). Ein Handelsgewerbe liegt vor, wenn das Unternehmen nach Art "
                "oder Umfang einen in kaufmännischer Weise eingerichteten Geschäftsbetrieb "
                "erfordert. Auf eine Eintragung im Handelsregister kommt es nicht an.\n\n"
                "**2. Kannkaufmann (§ 2 HGB):** Gewerbetreibende, deren Unternehmen keinen "
                "in kaufmännischer Weise eingerichteten Geschäftsbetrieb erfordert (Kleingewerbe), "
                "können sich ins Handelsregister eintragen lassen und erwerben dadurch die "
                "Kaufmannseigenschaft (opt-in). Ohne Eintragung sind sie kein Kaufmann.\n\n"
                "**3. Formkaufmann (§ 6 HGB):** Handelsgesellschaften (OHG, KG) und "
                "Kapitalgesellschaften (AG, GmbH) sind kraft ihrer Rechtsform Kaufleute, "
                "unabhängig von der Art oder dem Umfang des betriebenen Gewerbes.\n\n"
                "**Scheinkaufmann:** Wer im Rechtsverkehr den Anschein der Kaufmannseigenschaft "
                "erweckt, muss sich an diesem Schein festhalten lassen (§ 5 HGB analog).\n\n"
                "**Rechtsfolgen der Kaufmannseigenschaft:**\n"
                "- Handelsregisterpflicht (§§ 29 ff. HGB)\n"
                "- Firmenführung (§§ 17 ff. HGB)\n"
                "- Kaufmännisches Schweigen (§ 362 HGB)\n"
                "- Kontokorrent (§§ 355 ff. HGB)\n"
                "- Handelsbrauch (§ 346 HGB)"
            ),
            'english': (
                "**Kaufmannsbegriff – The Concept of Merchant (§§ 1–6 HGB)**\n\n"
                "The German Commercial Code (HGB) distinguishes three types of merchant:\n\n"
                "**1. Istkaufmann (§ 1 HGB):** Anyone who operates a trade (Handelsgewerbe) "
                "is a merchant by operation of law. A trade qualifies if it requires a "
                "commercially organized business operation by its nature or scale. "
                "Registration in the commercial register is not required.\n\n"
                "**2. Kannkaufmann (§ 2 HGB):** Small-scale traders whose business does not "
                "require commercial organization may voluntarily register in the commercial "
                "register and thereby acquire merchant status (opt-in). Without registration "
                "they are not merchants.\n\n"
                "**3. Formkaufmann (§ 6 HGB):** Trading partnerships (OHG, KG) and capital "
                "companies (AG, GmbH) are merchants by virtue of their legal form, regardless "
                "of the type or scale of their business.\n\n"
                "**Legal consequences of merchant status:** Duty to register, right to a "
                "Firma (trade name), commercial silence rule (§ 362 HGB), current account "
                "(§§ 355 ff. HGB), and applicability of trade usage (§ 346 HGB)."
            ),
        },
        'sources': ['§ 1 HGB', '§ 2 HGB', '§ 5 HGB', '§ 6 HGB'],
    }

    _PROKURA = {
        'type': 'RULE',
        'domain': 'commercial_law',
        'explanation': {
            'german': (
                "**Prokura (§§ 48–53 HGB)**\n\n"
                "Die Prokura ist eine gesetzlich typisierte, umfassende Handelsvollmacht, "
                "die nur vom Inhaber des Handelsgeschäfts oder seinem gesetzlichen Vertreter "
                "erteilt werden kann (§ 48 HGB).\n\n"
                "**Erteilung (§ 48 HGB):** Nur durch den Inhaber oder organschaftlichen Vertreter "
                "(nicht durch andere Prokuristen). Die Erteilung ist ins Handelsregister einzutragen "
                "(§ 53 HGB), allerdings ist die Eintragung nur deklaratorisch.\n\n"
                "**Umfang (§ 49 HGB):** Die Prokura ermächtigt zu allen Arten von gerichtlichen "
                "und außergerichtlichen Geschäften und Rechtshandlungen, die der Betrieb eines "
                "Handelsgewerbes mit sich bringt. Ausgenommen sind insbesondere:\n"
                "- Veräußerung und Belastung von Grundstücken (§ 49 Abs. 2 HGB) — nur mit "
                "ausdrücklicher Ermächtigung.\n\n"
                "**Beschränkungen (§ 50 HGB):** Beschränkungen der Prokura sind Dritten gegenüber "
                "unwirksam (absolute Außenwirkung). Im Innenverhältnis können Beschränkungen "
                "vereinbart werden, aber sie schützen Dritte nicht.\n\n"
                "**Erlöschen (§ 52 HGB):** Die Prokura erlischt durch Widerruf des Inhabers, "
                "Auflösung des Unternehmens oder Tod des Prokuristen (nicht durch Tod des Inhabers).\n\n"
                "**Abgrenzung zur Handlungsvollmacht (§ 54 HGB):** Die Handlungsvollmacht ist "
                "enger als die Prokura und erfasst nur die gewöhnlichen Handlungen des Gewerbes."
            ),
            'english': (
                "**Prokura – Commercial Power of Attorney (§§ 48–53 HGB)**\n\n"
                "Prokura is a statutory, comprehensive commercial power of attorney that can "
                "only be granted by the owner of a business or their legal representative "
                "(§ 48 HGB).\n\n"
                "**Grant (§ 48 HGB):** Only the owner or corporate representative may grant "
                "Prokura (not other Prokuristen). Registration in the commercial register is "
                "required (§ 53 HGB) but is merely declaratory.\n\n"
                "**Scope (§ 49 HGB):** Prokura authorizes all judicial and extra-judicial acts "
                "associated with running a commercial business. Notable exclusion: "
                "sale or encumbrance of real property (§ 49 II HGB) requires express authorization.\n\n"
                "**Restrictions (§ 50 HGB):** Internal restrictions on Prokura are ineffective "
                "against third parties (absolute external effect).\n\n"
                "**Termination (§ 52 HGB):** Prokura expires upon revocation by the owner, "
                "dissolution of the business, or death of the Prokurist (not by owner's death).\n\n"
                "**vs. Handlungsvollmacht (§ 54 HGB):** Handlungsvollmacht is narrower, covering "
                "only acts customary to the ordinary course of the business."
            ),
        },
        'sources': ['§ 48 HGB', '§ 49 HGB', '§ 50 HGB', '§ 52 HGB', '§ 53 HGB'],
    }

    # ── Criminal law doctrine dicts ──────────────────────────────────────────

    _TOTSCHLAG = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Totschlag (§ 212 StGB)**\n\n"
                "**Begriff:** Totschlag ist das vorsätzliche Töten eines anderen Menschen ohne "
                "Mordmerkmale. § 212 StGB ist der Grundtatbestand der Tötungsdelikte.\n\n"
                "**Objektiver Tatbestand:**\n"
                "- Tatobjekt: Ein anderer lebender Mensch (Beginn: Einsetzen der Eröffnungswehen; "
                "Ende: irreversibler Hirntod).\n"
                "- Tathandlung: Jedes kausale Tun oder Unterlassen, das den Tod des Opfers "
                "herbeiführt und objektiv zurechenbar ist (Adäquanztheorie, Schutzzweck der Norm).\n\n"
                "**Subjektiver Tatbestand:**\n"
                "- Vorsatz bezüglich der Tötung: dolus directus 1. oder 2. Grades oder dolus "
                "eventualis.\n"
                "- Keine Mordmerkmale (sonst § 211 StGB).\n\n"
                "**Rechtswidrigkeit und Schuld:** Rechtfertigungsgründe (§§ 32, 34 StGB) und "
                "Entschuldigungsgründe (§§ 33, 35 StGB) sind zu prüfen. § 35 StGB: "
                "Entschuldigender Notstand bei Gefahr für sich, Angehörige oder nahestehende Personen.\n\n"
                "**Rechtsfolge:**\n"
                "- Regelstrafe: Freiheitsstrafe nicht unter 5 Jahren (§ 212 Abs. 1 StGB).\n"
                "- Besonders schwerer Fall (§ 212 Abs. 2 StGB): Lebenslange Freiheitsstrafe.\n"
                "- Minder schwerer Fall (§ 213 StGB): Freiheitsstrafe 1–10 Jahre bei "
                "verständlichem Erregungszustand (Provokation) oder sonstigen minder schweren Fällen.\n\n"
                "**Abgrenzungen:**\n"
                "- Mord (§ 211 StGB): Tatbestandsmäßige Mordmerkmale; lebenslange Freiheitsstrafe.\n"
                "- Fahrlässige Tötung (§ 222 StGB): Kein Tötungsvorsatz.\n"
                "- Körperverletzung mit Todesfolge (§ 227 StGB): Vorsatz nur zur KV, "
                "Tod als Folge (leichtfertig)."
            ),
            'english': (
                "**Totschlag – Manslaughter (§ 212 StGB)**\n\n"
                "**Definition:** Intentional killing of another person without murder characteristics "
                "(§ 211 StGB). § 212 is the basic homicide offence.\n\n"
                "**Objective elements:** A living human being; any act or omission causally and "
                "objectively attributable to the victim's death.\n\n"
                "**Subjective element:** Intent to kill (dolus directus or eventualis); absence of "
                "murder characteristics.\n\n"
                "**Sentence:** Not less than 5 years (§ 212 I); life imprisonment in especially "
                "serious cases (§ 212 II); 1–10 years in less serious cases (§ 213 — provocation "
                "or other mitigating circumstances)."
            ),
        },
        'sources': ['§ 211 StGB', '§ 212 StGB', '§ 213 StGB', '§ 222 StGB', '§ 227 StGB'],
    }

    _MORD = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Mord (§ 211 StGB)**\n\n"
                "**Begriff:** Mord ist das vorsätzliche Töten eines anderen Menschen mit mindestens "
                "einem Mordmerkmal. Nach h.M. (BGH) ist § 211 ein eigenständiger Tatbestand, kein "
                "qualifizierter Totschlag.\n\n"
                "**Objektiver Tatbestand:** Töten eines anderen Menschen (wie § 212 StGB) "
                "+ mindestens ein Mordmerkmal.\n\n"
                "**Mordmerkmale (§ 211 Abs. 2 StGB) — drei Gruppen:**\n\n"
                "**1. Gruppe – Gesinnung des Täters:**\n"
                "- Mordlust (Töten als Selbstzweck, ohne nachvollziehbares Motiv)\n"
                "- Zur Befriedigung des Geschlechtstriebs\n"
                "- Aus Habgier (rücksichtsloses Streben nach Vermögensvorteilen)\n"
                "- Aus sonstigen niedrigen Beweggründen (nach BGH: sittlich auf tiefster Stufe "
                "stehend, die das allgemeine Gefühl für die Unverbrüchlichkeit des Lebens verletzt)\n\n"
                "**2. Gruppe – Ausführungsart:**\n"
                "- Heimtückisch: Bewusstes Ausnutzen der Arg- und Wehrlosigkeit des Opfers\n"
                "- Grausam: Zufügen besonderer körperlicher oder seelischer Leiden, die über das "
                "zur Tötung Erforderliche hinausgehen\n"
                "- Mit gemeingefährlichen Mitteln: unkontrollierbares Risiko für unbestimmten "
                "Personenkreis (z.B. Sprengstoff, Brandstiftung)\n\n"
                "**3. Gruppe – Täter-Ziel-Beziehung:**\n"
                "- Um eine andere Straftat zu ermöglichen (Ermöglichungsabsicht, dolus directus)\n"
                "- Um eine andere Straftat zu verdecken (Verdeckungsabsicht, dolus directus)\n\n"
                "**Subjektiver Tatbestand:** Vorsatz zur Tötung + Vorsatz bezüglich des "
                "Mordmerkmals (Gesinnungsmerkmale müssen zur Tatzeit vorliegen und bestehen).\n\n"
                "**Rechtsfolge:** Lebenslange Freiheitsstrafe (§ 211 Abs. 1 StGB) — zwingend, "
                "kein richterliches Ermessen. Besondere Schwere der Schuld (§ 57a StGB) kann "
                "vorzeitige Entlassung nach 15 Jahren ausschließen.\n\n"
                "**Wichtige Problemfelder:**\n"
                "- Heimtücke bei arglosem Schlafenden: h.M. bejaht Arglosigkeit im Zeitpunkt "
                "des Angriffs.\n"
                "- Verdeckungsmord: dolus directus 1. Grades erforderlich (str.)\n"
                "- Außergewöhnliche Milderung: verfassungskonforme Strafmilderung analog "
                "§ 49 Abs. 1 StGB bei extrem außergewöhnlichen Umständen (BVerfGE 45, 187)."
            ),
            'english': (
                "**Mord – Murder (§ 211 StGB)**\n\n"
                "**Definition:** Intentional killing with at least one qualifying murder "
                "characteristic (Mordmerkmal). Under prevailing BGH case law, § 211 is an "
                "independent offence, not a qualified form of manslaughter.\n\n"
                "**Murder characteristics — three groups:**\n"
                "1. Motive-based: lust for killing, sexual gratification, avarice (Habgier), "
                "other base motives (niedrige Beweggründe).\n"
                "2. Method-based: treachery (Heimtücke — exploiting the victim's unsuspecting "
                "defencelessness), cruelty (Grausamkeit), use of means dangerous to the public.\n"
                "3. Purpose-based: to facilitate or to conceal another criminal offence "
                "(dolus directus 1st degree required for concealment murder).\n\n"
                "**Sentence:** Mandatory life imprisonment (§ 211 I). Early release after 15 "
                "years under § 57a StGB unless the court declares 'particular gravity of guilt' "
                "(besondere Schwere der Schuld)."
            ),
        },
        'sources': ['§ 211 StGB', '§ 212 StGB', '§ 49 StGB', '§ 57a StGB', 'BVerfGE 45, 187'],
    }

    _KOERPERVERLETZUNG_STGB = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Körperverletzung (§§ 223–229 StGB)**\n\n"
                "**§ 223 StGB – Einfache Körperverletzung (Grundtatbestand):**\n"
                "Tathandlung: (1) Körperliche Misshandlung — jede üble, unangemessene Behandlung, "
                "die das körperliche Wohlbefinden mehr als unerheblich beeinträchtigt; "
                "(2) Gesundheitsschädigung — Hervorrufen oder Steigern eines pathologischen "
                "Zustands. Vorsatz (dolus eventualis genügt) erforderlich.\n"
                "Rechtsfolge: Freiheitsstrafe bis 5 Jahre oder Geldstrafe.\n\n"
                "**§ 224 StGB – Gefährliche Körperverletzung:**\n"
                "Begehung durch eines der fünf Qualifikationsmerkmale:\n"
                "- Nr. 1: Beibringen von Gift oder gesundheitsschädlichen Stoffen\n"
                "- Nr. 2: Waffe oder gefährliches Werkzeug (objektiv geeignet, erhebliche "
                "Körperverletzungen zu verursachen; auch bei konkreter Verwendung maßgeblich)\n"
                "- Nr. 3: Hinterlistiger Überfall (planmäßiges Ausnutzen des Überraschungsmoments)\n"
                "- Nr. 4: Gemeinschaftlich mit einem anderen Beteiligten\n"
                "- Nr. 5: Lebensgefährdende Behandlung (konkrete — nicht nur abstrakte — "
                "Lebensgefahr erforderlich)\n"
                "Rechtsfolge: Freiheitsstrafe 6 Monate bis 10 Jahre.\n\n"
                "**§ 226 StGB – Schwere Körperverletzung:**\n"
                "Erfolgsqualifikation: Verlust des Sehvermögens, Gehörs, Sprechvermögens, eines "
                "wichtigen Körperglieds, dauernde Entstellung des Gesichts, Siechtum, Lähmung, "
                "geistige Krankheit oder Behinderung.\n"
                "§ 226 Abs. 1: Freiheitsstrafe 1–10 Jahre; § 226 Abs. 2 (absichtlich oder "
                "wissentlich herbeigeführt): 3–15 Jahre.\n\n"
                "**§ 227 StGB – Körperverletzung mit Todesfolge:**\n"
                "Erfolgsqualifikation: Vorsätzliche Körperverletzung (§§ 223, 224, 226 StGB) + "
                "Tod als unmittelbare Folge, den der Täter leichtfertig herbeiführt "
                "(§ 18 StGB: erhöhter Fahrlässigkeitsvorwurf).\n"
                "Rechtsfolge: Freiheitsstrafe 3–15 Jahre.\n\n"
                "**§ 229 StGB – Fahrlässige Körperverletzung:**\n"
                "Fahrlässiges Herbeiführen einer Körperverletzung. "
                "Rechtsfolge: Freiheitsstrafe bis 3 Jahre oder Geldstrafe. "
                "Grundsätzlich Antragsdelikt (§ 230 Abs. 1 StGB); Amtsermittlung bei "
                "öffentlichem Interesse.\n\n"
                "**Rechtfertigungsgründe:** Einwilligung des Verletzten "
                "(§ 228 StGB: wirksam, sofern die KV nicht gegen die guten Sitten verstößt; "
                "Grenze bei § 224/226); Notwehr (§ 32 StGB).\n\n"
                "**Abgrenzung:** Zur zivilrechtlichen Haftung nach BGB § 823: "
                "Strafrechtliche Verurteilung und zivilrechtlicher Schadensersatzanspruch "
                "sind kumulativ möglich (Anspruchskonkurrenz)."
            ),
            'english': (
                "**Körperverletzung – Bodily Harm (§§ 223–229 StGB)**\n\n"
                "**§ 223 (Basic offence):** Physical ill-treatment or causation of a pathological "
                "condition. Intent (dolus eventualis) required. Up to 5 years or fine.\n\n"
                "**§ 224 (Dangerous bodily harm):** Five qualifying methods — poison/harmful "
                "substances, weapon or dangerous instrument, ambush, joint commission with "
                "another, or life-threatening treatment (concrete risk required). "
                "6 months – 10 years.\n\n"
                "**§ 226 (Grievous bodily harm):** Serious permanent consequences listed in "
                "statute (loss of sight, hearing, limb, etc.). 1–10 years; 3–15 years if "
                "intentionally caused (§ 226 II).\n\n"
                "**§ 227 (Bodily harm causing death):** Intent for the battery, death as a "
                "reckless (leichtfertig) consequence. 3–15 years.\n\n"
                "**§ 229 (Negligent bodily harm):** Negligence sufficient; victim's complaint "
                "required as a rule (§ 230). Up to 3 years or fine.\n\n"
                "**Defences:** Informed consent (§ 228 — invalid if contrary to public policy); "
                "self-defence (§ 32 StGB)."
            ),
        },
        'sources': ['§ 223 StGB', '§ 224 StGB', '§ 226 StGB', '§ 227 StGB',
                    '§ 228 StGB', '§ 229 StGB', '§ 230 StGB', '§ 18 StGB'],
    }

    _DIEBSTAHL = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Diebstahl (§ 242 StGB)**\n\n"
                "**Objektiver Tatbestand:**\n"
                "1. **Fremde bewegliche Sache:** Körperlicher Gegenstand (kein unkörperliches Recht), "
                "im Eigen- oder Miteigentum eines anderen, nicht herrenlos.\n"
                "2. **Wegnahme:** Bruch des fremden Gewahrsams (Besitzaufhebung ohne oder gegen "
                "den Willen des Gewahrsamsinhabers) UND Begründung neuen Gewahrsams durch den Täter "
                "oder einen Dritten. Maßgeblich: natürlicher Gewahrsamsbegriff — tatsächliche "
                "Sachherrschaft mit Besitzwillen.\n\n"
                "**Subjektiver Tatbestand:**\n"
                "1. Vorsatz (dolus eventualis genügt) bezüglich aller objektiven Tatbestandsmerkmale.\n"
                "2. Zueignungsabsicht (dolus directus 1. Grades): dauerhaftes Enteignen des "
                "Berechtigten UND zumindest vorübergehendes Sich- oder Drittzueignen der Sache. "
                "Die angestrebte Zueignung muss rechtswidrig sein.\n\n"
                "**Rechtsfolge (Grundtatbestand):** Freiheitsstrafe bis 5 Jahre oder Geldstrafe.\n\n"
                "**Qualifikationen und schwere Fälle:**\n"
                "- **§ 243 StGB – Besonders schwere Fälle** (Regelbeispiele): Einbruch in "
                "Gebäude/Wohnung/Geschäftsraum (Nr. 1), Überwindung von Schutzvorrichtungen "
                "(Nr. 2), Waffe (Nr. 3), gewerbsmäßig (Nr. 4), geschwächte Person (Nr. 6), "
                "Denkmal (Nr. 5). Rechtsfolge: 3 Monate bis 10 Jahre.\n"
                "- **§ 244 Abs. 1 Nr. 3 StGB – Wohnungseinbruchsdiebstahl:** Einbruch in eine "
                "dauerhaft bewohnte Privatwohnung — Mindeststrafe 1 Jahr Freiheitsstrafe.\n"
                "- **§ 244 StGB – Qualifizierter Diebstahl:** Waffe/gefährliches Werkzeug (Nr. 1a), "
                "Bande (Nr. 2), Wohnungseinbruch (Nr. 3) — 6 Monate bis 10 Jahre.\n"
                "- **§ 244a StGB – Schwerer Bandendiebstahl:** Freiheitsstrafe 1–10 Jahre.\n\n"
                "**Abgrenzungen:**\n"
                "- Raub (§ 249 StGB): Diebstahl mit Nötigungsmitteln (Gewalt oder Drohung).\n"
                "- Unterschlagung (§ 246 StGB): Keine Wegnahme; Sache ist bereits im Besitz des "
                "Täters.\n"
                "- Gebrauchsanmaßung: Kein dauerhaftes Enteignen (straflos; allenfalls § 248b "
                "StGB bei Kraftfahrzeugen)."
            ),
            'english': (
                "**Diebstahl – Theft (§ 242 StGB)**\n\n"
                "**Objective elements:** (1) A movable thing belonging to another; "
                "(2) taking (Wegnahme) — breaking the owner's possession without consent and "
                "establishing new possession.\n\n"
                "**Subjective elements:** Intent (dolus eventualis) + specific intent to "
                "appropriate (Zueignungsabsicht, dolus directus 1st degree): permanently "
                "depriving the owner and at least temporarily appropriating the thing for "
                "oneself or a third party; the intended appropriation must be unlawful.\n\n"
                "**Sentence:** Up to 5 years or fine.\n\n"
                "**Aggravated forms:** § 243 (especially serious cases — break-in, weapon, "
                "commercial): 3 months–10 years; § 244 Nr. 3 (residential burglary): minimum "
                "1 year; § 244 (qualified theft — weapon, gang): 6 months–10 years; "
                "§ 244a (serious gang theft): 1–10 years."
            ),
        },
        'sources': ['§ 242 StGB', '§ 243 StGB', '§ 244 StGB', '§ 244a StGB',
                    '§ 246 StGB', '§ 248b StGB', '§ 249 StGB'],
    }

    _BETRUG = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Betrug (§ 263 StGB)**\n\n"
                "**Objektiver Tatbestand — fünfgliedrige Kausalreihe:**\n\n"
                "1. **Täuschungshandlung** über Tatsachen: innere oder äußere, vergangene oder "
                "gegenwärtige Tatsachen (keine Werturteile). Ausdrücklich, konkludent (z.B. "
                "Preisauszeichnung) oder durch Schweigen bei bestehender Aufklärungspflicht.\n"
                "2. **Irrtum** beim Verfügenden: Fehlvorstellung über die Wirklichkeit. "
                "Auch der 'leichtgläubige Irrtum' ist tatbestandsmäßig.\n"
                "3. **Vermögensverfügung**: Jede Handlung, Duldung oder Unterlassen des Irrenden "
                "mit unmittelbarer Vermögenswirkung (Unmittelbarkeitsprinzip — kein Dazwischentreten "
                "des Täters erforderlich).\n"
                "4. **Vermögensschaden**: Differenzhypothese — Vergleich des Vermögenswerts des "
                "Opfers vor und nach der Verfügung; juristische Personen können Opfer sein. "
                "Schadenswiedergutmachung nach der Tat schließt Tatbestand nicht aus.\n"
                "5. **Kausalität** zwischen allen Gliedern der Kette: "
                "Täuschung → Irrtum → Verfügung → Schaden.\n\n"
                "**Subjektiver Tatbestand:**\n"
                "1. Vorsatz (dolus eventualis genügt) bezüglich aller objektiven Merkmale.\n"
                "2. Absicht rechtswidriger Bereicherung (dolus directus 1. Grades): "
                "Sich- oder Drittzueignungsabsicht, die mit dem Vermögensschaden des Opfers "
                "stoffgleich ist (Stoffgleichheitsprinzip).\n\n"
                "**Rechtsfolge:**\n"
                "- Grundtatbestand: Freiheitsstrafe bis 5 Jahre oder Geldstrafe.\n"
                "- Besonders schwere Fälle (§ 263 Abs. 3, Regelbeispiele: gewerbsmäßig, "
                "Bandenmitglied, großes Ausmaß ≥ 50.000 €, Amtsträger, Not): "
                "Freiheitsstrafe 6 Monate bis 10 Jahre.\n"
                "- Gewerbsmäßiger Bandenbetrug (§ 263 Abs. 5): Freiheitsstrafe 1–10 Jahre.\n\n"
                "**Computerbetrug (§ 263a StGB):** Tathandlung ist die Beeinflussung des "
                "Ergebnisses einer Datenverarbeitung (kein menschliches Opfer erforderlich).\n\n"
                "**Abgrenzungen:**\n"
                "- Untreue (§ 266 StGB): Opfer handelt aufgrund einer Treuepflicht, nicht "
                "aufgrund eines Irrtums.\n"
                "- Erpressung (§ 253 StGB): Vermögensvorteil durch Nötigungsmittel."
            ),
            'english': (
                "**Betrug – Fraud (§ 263 StGB)**\n\n"
                "**Five-step causal chain (objective elements):**\n"
                "1. Deception (Täuschung) about facts — express, implied, or by silence where "
                "a duty to disclose exists.\n"
                "2. Mistake (Irrtum) induced in the disposing party.\n"
                "3. Disposition (Vermögensverfügung) with immediate financial effect "
                "(Unmittelbarkeitsprinzip).\n"
                "4. Financial damage (Vermögensschaden) — difference test.\n"
                "5. Causation linking each step.\n\n"
                "**Subjective elements:** Intent (dolus eventualis) + specific intent to "
                "unlawfully enrich (Bereicherungsabsicht, dolus directus 1st degree), "
                "the enrichment being the mirror-image of the victim's loss (Stoffgleichheit).\n\n"
                "**Sentence:** Up to 5 years; 6 months–10 years for especially serious cases "
                "(§ 263 III); 1–10 years for commercial gang fraud (§ 263 V)."
            ),
        },
        'sources': ['§ 263 StGB', '§ 263a StGB', '§ 253 StGB', '§ 266 StGB'],
    }

    _NOETIGUNG = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Nötigung (§ 240 StGB)**\n\n"
                "**Objektiver Tatbestand:**\n"
                "1. **Nötigungsmittel:** Gewalt gegen eine Person oder eine Sache als Beugemittel "
                "(vis compulsiva; auch vis absoluta nach h.M.) ODER Drohung mit einem empfindlichen "
                "Übel (zukünftiges, vom Täter beeinflussbares Übel, das der Adressat als "
                "erheblich empfindet).\n"
                "2. **Nötigungserfolg:** Das Opfer nimmt eine Handlung vor, duldet etwas oder "
                "unterlässt etwas.\n"
                "3. **Kausalität** zwischen Nötigungsmittel und Nötigungserfolg.\n\n"
                "**Subjektiver Tatbestand:** Vorsatz (dolus eventualis genügt) bezüglich "
                "Nötigungsmittel und Nötigungserfolg.\n\n"
                "**Rechtswidrigkeit — Verwerflichkeitsklausel (§ 240 Abs. 2 StGB):**\n"
                "Die Tat ist nur rechtswidrig, wenn die Anwendung des Nötigungsmittels zu dem "
                "angestrebten Zweck als verwerflich anzusehen ist. Maßstab: Mittel-Zweck-Relation "
                "im Einzelfall. Das Nötigungsmittel oder der verfolgte Zweck muss sozial unerträglich "
                "sein. Bedeutsame BGH-/BVerfG-Entscheidungen: Straßenblockaden (BVerfGE 92, 1: "
                "Verwerflichkeit bejaht bei bloßem Protestzweck ohne Sachzusammenhang).\n\n"
                "**Rechtsfolge:**\n"
                "- Grundtatbestand: Freiheitsstrafe bis 3 Jahre oder Geldstrafe.\n"
                "- Besonders schwere Fälle (§ 240 Abs. 4): Freiheitsstrafe 6 Monate bis 5 Jahre "
                "(Nötigung eines Abgeordneten, Zeugen, Sachverständigen u.a.).\n\n"
                "**Abgrenzungen:**\n"
                "- Raub (§ 249 StGB): Nötigung zum Diebstahl mittels Gewalt oder Drohung — "
                "Spezialvorschrift mit höherer Strafandrohung.\n"
                "- Erpressung (§ 253 StGB): Nötigung zur Vermögensverfügung in "
                "Bereicherungsabsicht.\n"
                "- Bedrohung (§ 241 StGB): Ankündigung einer Straftat gegen die Person — "
                "kein Nötigungserfolg erforderlich."
            ),
            'english': (
                "**Nötigung – Coercion (§ 240 StGB)**\n\n"
                "**Objective elements:** Use of force (Gewalt) or threat of a sensitive harm "
                "(Drohung mit empfindlichem Übel) causing the victim to act, suffer, or refrain "
                "from acting. Causation required.\n\n"
                "**Subjective element:** Intent (dolus eventualis).\n\n"
                "**Unlawfulness — Verwerflichkeitsklausel (§ 240 II):** The act is only unlawful "
                "if the means-end relationship is reprehensible (verwerflich). Courts weigh the "
                "purpose pursued against the coercive means used.\n\n"
                "**Sentence:** Up to 3 years or fine; 6 months–5 years for especially serious "
                "cases (§ 240 IV — e.g. coercion of MPs, witnesses, or experts)."
            ),
        },
        'sources': ['§ 240 StGB', '§ 241 StGB', '§ 249 StGB', '§ 253 StGB', 'BVerfGE 92, 1'],
    }

    _UNTREUE = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Untreue (§ 266 StGB)**\n\n"
                "**§ 266 Abs. 1 StGB — Zwei selbstständige Tatbestandsvarianten:**\n\n"
                "**1. Missbrauchstatbestand (§ 266 Abs. 1 Alt. 1):**\n"
                "- Tätereigenschaft: Inhaber einer rechtsgeschäftlichen Befugnis, über fremdes "
                "Vermögen zu verfügen oder fremde zu verpflichten (z.B. Vollmacht, Prokura, "
                "organschaftliche Vertretungsmacht).\n"
                "- Tathandlung: Missbrauch dieser Befugnis — Vornahme von Rechtsgeschäften, "
                "die im Außenverhältnis wirksam sind, aber die im Innenverhältnis (z.B. durch "
                "Gesellschafterbeschluss, Weisung) gesetzten Grenzen überschreiten.\n"
                "- Beispiel: GmbH-Geschäftsführer schließt nachteiligen Vertrag entgegen "
                "ausdrücklicher Gesellschafterweisung; Vorstandsmitglied genehmigt "
                "überhöhte Vergütungen ohne Aufsichtsratsbeschluss.\n\n"
                "**2. Treubruchtatbestand (§ 266 Abs. 1 Alt. 2):**\n"
                "- Tätereigenschaft: Pflicht zur Wahrnehmung fremder Vermögensinteressen "
                "aufgrund Gesetzes, behördlichen Auftrags, Rechtsgeschäfts oder eines "
                "tatsächlichen Treueverhältnisses (weiter als Alt. 1).\n"
                "- Tathandlung: Verletzung der Treuepflicht durch Tun oder Unterlassen.\n"
                "- Beispiel: Anwalt verwendet Mandantengelder für eigene Zwecke; Betreuer "
                "schädigt das Vermögen des Betreuten.\n\n"
                "**Gemeinsame Voraussetzung — Vermögensnachteil:**\n"
                "Eintritt eines tatsächlichen, bezifferbaren Vermögensnachteils beim "
                "Vermögensinhaber (Differenzhypothese). Nach BVerfGE 126, 170 (Bestimmtheitsgebot "
                "Art. 103 Abs. 2 GG): Der Schaden muss 'greifbar' und konkret festgestellt "
                "werden; abstrakte Gefährdung genügt grundsätzlich nicht. 'Schwarze Kassen' "
                "können einen Nachteil begründen (BGH NJW 2009, 2390).\n\n"
                "**Subjektiver Tatbestand:** Vorsatz (dolus eventualis genügt) bezüglich "
                "Tathandlung und Vermögensnachteil. Bereicherungsabsicht ist nicht erforderlich "
                "(Abgrenzung zu § 263 StGB).\n\n"
                "**Rechtsfolge:**\n"
                "- Grundtatbestand: Freiheitsstrafe bis 5 Jahre oder Geldstrafe.\n"
                "- Besonders schwere Fälle (§ 266 Abs. 2 i.V.m. § 263 Abs. 3 StGB): "
                "Freiheitsstrafe 6 Monate bis 10 Jahre."
            ),
            'english': (
                "**Untreue – Breach of Fiduciary Duty (§ 266 StGB)**\n\n"
                "**Two independent alternative bases:**\n\n"
                "1. **Missbrauch – Abuse (§ 266 I Alt. 1):** Misuse of a legal power to "
                "dispose of or obligate another's assets (e.g. power of attorney, Prokura, "
                "corporate authority), where the act is externally valid but violates internal "
                "restrictions.\n\n"
                "2. **Treubruch – Breach of trust (§ 266 I Alt. 2):** Breach of a duty to "
                "safeguard another's financial interests arising from statute, official mandate, "
                "legal transaction, or a factual trust relationship (broader than Alt. 1).\n\n"
                "**Both require a concrete, quantifiable financial loss (Vermögensnachteil)** — "
                "mere abstract risk is insufficient (BVerfGE 126, 170; constitutional requirement "
                "of certainty under Art. 103 II GG).\n\n"
                "**Subjective element:** Intent (dolus eventualis sufficient); no enrichment "
                "motive required (unlike § 263 StGB fraud).\n\n"
                "**Sentence:** Up to 5 years or fine; 6 months–10 years for especially serious "
                "cases (§ 266 II with § 263 III)."
            ),
        },
        'sources': ['§ 266 StGB', '§ 263 StGB', 'BVerfGE 126, 170', 'BGH NJW 2009, 2390'],
    }

    _MORD_TOTSCHLAG_VERGLEICH = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Mord (§ 211 StGB) vs. Totschlag (§ 212 StGB) — Abgrenzung**\n\n"
                "**Grundstruktur:**\n"
                "§ 212 Abs. 1 StGB (Totschlag) ist der Grundtatbestand der vorsätzlichen "
                "Tötungsdelikte. § 211 StGB (Mord) ist nach h.M. (BGH seit BGHSt 1, 368) "
                "kein qualifizierter Totschlag, sondern ein eigenständiger Tatbestand "
                "(sog. Exklusivitäts- oder Selbstständigkeitsthese). Gemeinsames "
                "Tatbestandsmerkmal beider Vorschriften ist das vorsätzliche Töten eines "
                "anderen Menschen.\n\n"
                "**Mordmerkmale (§ 211 Abs. 2 StGB) — Übersicht:**\n\n"
                "| Gruppe | Merkmal | Erläuterung |\n"
                "|--------|---------|-------------|\n"
                "| **1. Gruppe** (Gesinnung) | Mordlust | Töten als Selbstzweck, ohne "
                "nachvollziehbares Motiv |\n"
                "| | Befriedigung des Geschlechtstriebs | Sexuelle Motivation für die "
                "Tötung |\n"
                "| | Habgier | Rücksichtsloses Gewinnstreben als Tatantrieb |\n"
                "| | Sonstige niedrige Beweggründe | Sittlich auf tiefster Stufe stehend; "
                "Gesamtwürdigung aller Umstände |\n"
                "| **2. Gruppe** (Ausführungsart) | Heimtückisch | Bewusstes Ausnutzen "
                "der Arg- und Wehrlosigkeit des Opfers im Zeitpunkt des Angriffs |\n"
                "| | Grausam | Zufügen besonderer körperlicher oder seelischer Leiden "
                "über das zur Tötung Erforderliche hinaus |\n"
                "| | Gemeingefährliche Mittel | Unkontrollierbares Risiko für "
                "unbestimmten Personenkreis (z.B. Sprengstoff, Brandstiftung) |\n"
                "| **3. Gruppe** (Zweck) | Ermöglichungsabsicht | Um eine andere "
                "Straftat zu ermöglichen (dolus directus 1. Grades) |\n"
                "| | Verdeckungsabsicht | Um eine andere Straftat zu verdecken "
                "(dolus directus 1. Grades) |\n\n"
                "**Prüfungsschema — Abgrenzungsschritte:**\n"
                "1. Vorsätzliches Töten eines anderen Menschen? (Tatbestandsmerkmal "
                "beider Delikte)\n"
                "2. Liegt mindestens ein Mordmerkmal (§ 211 Abs. 2) vor?\n"
                "   - **Ja** → Mord (§ 211 StGB): lebenslange Freiheitsstrafe (zwingend)\n"
                "   - **Nein** → Totschlag (§ 212 StGB): Freiheitsstrafe nicht unter "
                "5 Jahren\n"
                "3. Beim Totschlag: Minder schwerer Fall (§ 213 StGB)? → "
                "Freiheitsstrafe 1–10 Jahre\n"
                "4. Beim Totschlag: Besonders schwerer Fall (§ 212 Abs. 2 StGB)? → "
                "Lebenslange Freiheitsstrafe\n\n"
                "**Strafrahmen im Vergleich:**\n\n"
                "| | Mord § 211 | Totschlag § 212 | Minder schwerer Fall § 213 |\n"
                "|--|-----------|----------------|---------------------------|\n"
                "| Regelstrafe | Lebenslänglich (zwingend) | ≥ 5 Jahre | 1–10 Jahre |\n"
                "| Schwerer Fall | — | Lebenslänglich (§ 212 II) | — |\n\n"
                "**§ 213 StGB — Minder schwerer Fall des Totschlags:**\n"
                "Freiheitsstrafe 1–10 Jahre bei: (1) verständlichem, auf Reizung "
                "beruhendem Erregungszustand (Provokation), oder (2) sonstigen minder "
                "schweren Fällen (Gesamtabwägung). Schließt Mord aus — Mordmerkmal "
                "und § 213 sind unvereinbar.\n\n"
                "**Konkurrenzen und Besonderheiten:**\n"
                "- Mehrere Mordmerkmale begründen keinen schwereren Schuldspruch; "
                "ein Schuldspruch wegen Mordes genügt.\n"
                "- § 52 StGB: Tateinheit zwischen § 211 und § 212 nach BGH möglich "
                "(bei Mehrfachtötungen mit unterschiedlichen Mordmerkmalen, str.).\n"
                "- Abgrenzung zu § 227 StGB (KV mit Todesfolge): Bei § 227 fehlt der "
                "Tötungsvorsatz; Tod als leichtfertig herbeigeführte Folge.\n\n"
                "**Wichtige Entscheidungen:**\n"
                "- BGHSt 1, 368: § 211 als eigenständiger Tatbestand "
                "(Exklusivitätsthese)\n"
                "- BGHSt 30, 105: Heimtücke beim ahnungslosen Schlafenden\n"
                "- BVerfGE 45, 187: Lebenslange Freiheitsstrafe verfassungsgemäß; "
                "Milderungsgebot bei außergewöhnlichen Umständen (analog § 49 Abs. 1 "
                "StGB)"
            ),
            'english': (
                "**Mord (§ 211 StGB) vs. Totschlag (§ 212 StGB) — Comparison**\n\n"
                "**Structure:** § 212 (manslaughter) is the basic intentional homicide "
                "offence. § 211 (murder) is, under prevailing BGH case law, an independent "
                "offence rather than a qualified form of manslaughter (Exklusivitätsthese, "
                "BGHSt 1, 368). Both share the element of intentionally killing another "
                "person.\n\n"
                "**Murder characteristics (§ 211 II) — three groups:**\n"
                "1. *Motive-based:* lust for killing; sexual gratification; avarice "
                "(Habgier); other base motives (sittlich auf tiefster Stufe).\n"
                "2. *Method-based:* treachery (Heimtücke — exploiting unsuspecting "
                "defencelessness); cruelty; use of means dangerous to the public.\n"
                "3. *Purpose-based:* to facilitate or to conceal another offence "
                "(both require dolus directus 1st degree).\n\n"
                "**Decision tree:**\n"
                "Intentional killing → murder characteristic present?\n"
                "- Yes → Murder § 211: mandatory life imprisonment.\n"
                "- No → Manslaughter § 212: minimum 5 years.\n"
                "  - Less serious case (§ 213): 1–10 years (provocation / overall "
                "mitigation).\n"
                "  - Especially serious case (§ 212 II): life imprisonment.\n\n"
                "**Key case law:** BGHSt 1, 368 (§ 211 independent); BGHSt 30, 105 "
                "(Heimtücke against sleeping victim); BVerfGE 45, 187 (life sentence "
                "constitutional; mitigation available in extraordinary circumstances)."
            ),
        },
        'sources': [
            '§ 211 StGB', '§ 212 StGB', '§ 213 StGB', '§ 227 StGB',
            'BGHSt 1, 368', 'BGHSt 30, 105', 'BVerfGE 45, 187',
        ],
    }

    _MITTAETERSCHAFT = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Mittäterschaft (§ 25 Abs. 2 StGB)**\n\n"
                "**Begriff:** Mittäter ist, wer die Tat gemeinschaftlich mit einem anderen begeht. "
                "Erforderlich ist ein gemeinsamer Tatplan und ein gemeinsames Handeln, "
                "durch das jeder Beteiligte Tatherrschaft ausübt.\n\n"
                "**Voraussetzungen:**\n"
                "1. **Gemeinsamer Tatentschluss** – wechselseitige Willenseinigung über die "
                "Tatbegehung (dolus communis); kann konkludent erfolgen; nicht erforderlich: "
                "vorherige Verabredung.\n"
                "2. **Gemeinsames Ausführen / Tatherrschaft** – jeder leistet einen wesentlichen "
                "Beitrag im Ausführungsstadium oder übernimmt eine Schlüsselrolle im Tatplan "
                "(funktionelle Tatherrschaft nach Roxin). Vorbereitungshandlungen können "
                "ausreichen, wenn sie unentbehrlich sind.\n\n"
                "**Abgrenzung zur Beihilfe (§ 27 StGB):**\n"
                "- Mittäter: eigener Tatherrschaftswille (animus auctoris); wesentlicher Beitrag.\n"
                "- Gehilfe: untergeordnete Rolle; kein Tatherrschaftswille (animus socii).\n"
                "- BGH: subjektive Formel (Täterwille); Literatur: Tatherrschaftslehre (Roxin).\n\n"
                "**Rechtsfolge:** Jedem Mittäter wird der Gesamterfolg vollständig zugerechnet "
                "(§ 25 Abs. 2 StGB). Strafrahmen wie bei alleiniger Tatbegehung. Individuelle "
                "strafändernde Merkmale (§ 28 StGB) werden differenziert geprüft.\n\n"
                "**Besonderheiten:**\n"
                "- Sukzessive Mittäterschaft: Eintritt in laufende Tat möglich bis Vollendung.\n"
                "- Überschreitung des Tatplans durch einen Mittäter (Exzess) wird den anderen "
                "nicht zugerechnet."
            ),
            'english': (
                "**Mittäterschaft – Joint Commission (§ 25 II StGB)**\n\n"
                "**Definition:** Co-perpetration where two or more persons commit an offence "
                "together pursuant to a joint plan, each exercising co-dominion over the act "
                "(Tatherrschaft).\n\n"
                "**Requirements:**\n"
                "1. **Joint resolution** (dolus communis) — mutual agreement, which may be "
                "tacit; no prior arrangement required.\n"
                "2. **Joint execution / co-dominion** — each co-perpetrator makes an essential "
                "contribution at the execution stage or holds a key role in the plan "
                "(functional co-dominion, Roxin).\n\n"
                "**Distinction from aiding (§ 27):** The aider lacks dominion over the act "
                "(animus socii); the co-perpetrator has it (animus auctoris).\n\n"
                "**Legal consequence:** The entire result is attributed to each co-perpetrator. "
                "Individual aggravating or mitigating features are assessed separately (§ 28).\n\n"
                "**Note:** Excess acts by one co-perpetrator (Exzess) are not attributed to "
                "the others."
            ),
        },
        'sources': ['§ 25 Abs. 2 StGB', '§ 28 StGB'],
    }

    _MITTELBARE_TAETERSCHAFT = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Mittelbare Täterschaft (§ 25 Abs. 1 Alt. 2 StGB)**\n\n"
                "**Begriff:** Mittelbarer Täter ist, wer die Tat durch einen anderen begeht "
                "(Hintermann – Vordermann/Werkzeug). Der Hintermann beherrscht die Tat "
                "durch Steuerung des menschlichen Werkzeugs (Tatherrschaft kraft Steuerung).\n\n"
                "**Fallgruppen der Werkzeugstellung:**\n"
                "1. **Irrtum des Werkzeugs** – Vordermann handelt im Tatbestandsirrtum (§ 16 StGB) "
                "oder Verbotsirrtum (§ 17 StGB); Hintermann nutzt Wissensvorsprung.\n"
                "2. **Nötigung des Werkzeugs** – Vordermann handelt unter entschuldigenden Zwang "
                "(§ 35 StGB); Hintermann beherrscht durch Drohung.\n"
                "3. **Schuldunfähigkeit des Werkzeugs** – Vordermann schuldunfähig (§ 20 StGB) "
                "oder Kind (§ 19 StGB); Hintermann steuert.\n"
                "4. **Organisationsherrschaft (Roxin)** – Befehlsgeber in kriminellen "
                "Machtapparaten kann mittelbarer Täter sein, auch wenn Ausführender voll "
                "verantwortlich ist (str., vom BGH in bestimmten Konstellationen anerkannt).\n\n"
                "**Abgrenzung zur Anstiftung (§ 26 StGB):**\n"
                "- Mittelbare Täterschaft: Werkzeug handelt ohne oder mit eingeschränkter "
                "Eigenverantwortlichkeit.\n"
                "- Anstiftung: Vordermann handelt voll verantwortlich und vorsätzlich.\n\n"
                "**Rechtsfolge:** Hintermann haftet als Täter; voller Strafrahmen. "
                "Qualifikationsmerkmale des Vordermanns werden nicht automatisch zugerechnet."
            ),
            'english': (
                "**Mittelbare Täterschaft – Indirect Perpetration (§ 25 I Alt. 2 StGB)**\n\n"
                "**Definition:** The perpetrator-behind-the-perpetrator (Hintermann) commits "
                "the offence through a human instrument (Werkzeug/Vordermann) over whom "
                "they exercise dominion.\n\n"
                "**Main categories:**\n"
                "1. Instrument acting under a mistake of fact (§ 16) or law (§ 17).\n"
                "2. Instrument acting under duress (§ 35).\n"
                "3. Instrument lacking criminal capacity (§ 19, § 20).\n"
                "4. Organisational dominion in criminal hierarchies (Roxin; accepted by BGH "
                "in limited contexts).\n\n"
                "**Distinction from incitement (§ 26):** Indirect perpetration requires "
                "the instrument to act without full autonomous responsibility; incitement "
                "requires a fully responsible principal offender.\n\n"
                "**Legal consequence:** The Hintermann is punished as perpetrator."
            ),
        },
        'sources': ['§ 25 Abs. 1 Alt. 2 StGB', '§ 16 StGB', '§ 17 StGB', '§ 19 StGB', '§ 20 StGB', '§ 35 StGB'],
    }

    _ANSTIFTUNG = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Anstiftung (§ 26 StGB)**\n\n"
                "**Begriff:** Als Anstifter wird gleich einem Täter bestraft, wer vorsätzlich "
                "einen anderen zu dessen vorsätzlich begangener rechtswidriger Tat bestimmt hat.\n\n"
                "**Voraussetzungen:**\n"
                "1. **Vorsätzliche rechtswidrige Haupttat** – Akzessorietät: Anstiftung setzt "
                "eine vollständig tatbestandsmäßige und rechtswidrige Tat des Haupttäters voraus "
                "(§ 29 StGB: Selbstständigkeit der Schuld).\n"
                "2. **Bestimmen zur Tat** – kausales Hervorrufen des Tatentschlusses beim Täter. "
                "Wer bereits zur Tat entschlossen ist (omnimodo facturus), kann nicht angestiftet "
                "werden → dann nur versuchte Anstiftung oder agent provocateur (str.).\n"
                "3. **Doppelter Anstiftervorsatz** – (a) Vorsatz zur Haupttat des Täters; "
                "(b) Vorsatz, den Täter zur Tat zu bestimmen. Beide Vorsatzelemente müssen "
                "vorliegen.\n\n"
                "**Abgrenzung:**\n"
                "- Mittelbare Täterschaft: Wenn Vordermann nicht voll verantwortlich.\n"
                "- Kettenanstiftung: Anstiftung zur Anstiftung ist möglich (str.).\n\n"
                "**Rechtsfolge:** Gleiche Strafe wie der Täter (§ 26 StGB); keine obligatorische "
                "Milderung (im Gegensatz zur Beihilfe)."
            ),
            'english': (
                "**Anstiftung – Incitement / Instigation (§ 26 StGB)**\n\n"
                "**Definition:** A person who intentionally induces another to commit an "
                "intentional unlawful act is punished as an instigator on the same level as "
                "the principal.\n\n"
                "**Requirements:**\n"
                "1. An intentional, unlawful principal offence (accessory nature).\n"
                "2. Causing the principal's decision to act — impossible where the principal "
                "is already resolved (omnimodo facturus).\n"
                "3. Double intent: intent regarding the principal offence AND intent to induce.\n\n"
                "**Key distinction:** If the principal lacks full responsibility, the inducer "
                "may be an indirect perpetrator (§ 25 I Alt. 2) rather than an instigator.\n\n"
                "**Legal consequence:** Sentenced as if a perpetrator — no mandatory mitigation "
                "(unlike aiding under § 27)."
            ),
        },
        'sources': ['§ 26 StGB', '§ 29 StGB'],
    }

    _BEIHILFE = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Beihilfe (§ 27 StGB)**\n\n"
                "**Begriff:** Als Gehilfe wird bestraft, wer vorsätzlich einem anderen zu "
                "dessen vorsätzlich begangener rechtswidriger Tat Hilfe geleistet hat.\n\n"
                "**Voraussetzungen:**\n"
                "1. **Vorsätzliche rechtswidrige Haupttat** – Akzessorietät wie bei der "
                "Anstiftung (§ 29 StGB).\n"
                "2. **Hilfeleistung** – jede kausale Förderung der Haupttat, physisch "
                "(Tatmittel, Zugang) oder psychisch (Ratschlag, Bestärkung des Tatentschlusses). "
                "Kausalität: ohne Gehilfenbeitrag wäre die Tat nicht so oder so schnell "
                "begangen worden (h.M.: Risikoerhöhungsformel).\n"
                "3. **Doppelter Gehilfenvorsatz** – (a) Vorsatz hinsichtlich der Haupttat; "
                "(b) Vorsatz hinsichtlich der eigenen Hilfeleistung.\n\n"
                "**Abgrenzung zur Mittäterschaft:**\n"
                "- Gehilfe: untergeordnete Rolle, kein Tatherrschaftswille (animus socii).\n"
                "- Mittäter: wesentlicher Tatbeitrag, Tatherrschaftswille (animus auctoris).\n\n"
                "**Rechtsfolge:** Obligatorische Strafmilderung nach § 27 Abs. 2 i.V.m. "
                "§ 49 Abs. 1 StGB (Strafrahmen wird nach unten verschoben). Bei minder "
                "schweren Fällen kann der Rahmen nochmals gemildert werden."
            ),
            'english': (
                "**Beihilfe – Aiding and Abetting (§ 27 StGB)**\n\n"
                "**Definition:** A person who intentionally assists another in committing an "
                "intentional unlawful act is guilty of aiding (Beihilfe).\n\n"
                "**Requirements:**\n"
                "1. An intentional, unlawful principal offence.\n"
                "2. Assistance — any causal facilitation, physical or psychological.\n"
                "3. Double intent: intent regarding the principal offence AND intent to assist.\n\n"
                "**Distinction from co-perpetration:** The aider has a subordinate role and "
                "lacks co-dominion (animus socii vs. animus auctoris of the co-perpetrator).\n\n"
                "**Legal consequence:** Mandatory sentence reduction under § 27 II combined "
                "with § 49 I StGB — the sentencing range is shifted downwards."
            ),
        },
        'sources': ['§ 27 StGB', '§ 27 Abs. 2 StGB', '§ 49 Abs. 1 StGB', '§ 29 StGB'],
    }

    _NOTWEHR = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Notwehr (§ 32 StGB)**\n\n"
                "**Begriff:** Notwehr ist die Verteidigung, die erforderlich ist, um einen "
                "gegenwärtigen rechtswidrigen Angriff von sich oder einem anderen abzuwenden "
                "(§ 32 Abs. 2 StGB).\n\n"
                "**Voraussetzungen — Prüfungsschema:**\n\n"
                "**I. Notwehrlage**\n"
                "1. **Angriff** – menschliches, von einem Willen getragenes Verhalten, das "
                "Rechtsgüter des Verteidigers oder Dritter verletzt oder gefährdet. Angriff "
                "durch Tiere nur bei Instrumentalisierung.\n"
                "2. **Gegenwärtigkeit** – Angriff hat begonnen oder steht unmittelbar bevor; "
                "endet mit Vollendung oder endgültigem Scheitern.\n"
                "3. **Rechtswidrigkeit** – Angriff nicht durch Notwehr, Einwilligung oder "
                "sonstige Rechtfertigung gedeckt.\n\n"
                "**II. Notwehrhandlung**\n"
                "1. **Verteidigung** – jede geeignete Gegenmaßnahme.\n"
                "2. **Erforderlichkeit** – mildestes Mittel, das den Angriff sicher abwehrt "
                "(kein Gebot zur Flucht; 'Recht braucht dem Unrecht nicht zu weichen').\n"
                "3. **Gebotenheit (§ 32 Abs. 1)** – sozialethische Einschränkungen: "
                "Einschränkung bei krassen Missverhältnissen (Bagatellangriffen), bei "
                "schuldlosem Angreifer, bei Provokation oder in engen Gemeinschaftsverhältnissen.\n\n"
                "**III. Subjektives Rechtfertigungselement** – Verteidigungswille.\n\n"
                "**Notwehrexzess (§ 33 StGB):** Überschreitung der Notwehr aus Verwirrung, "
                "Furcht oder Schrecken → Entschuldigung (kein Vorsatzdelikt, aber Fahrlässigkeit "
                "bleibt möglich).\n\n"
                "**Nothilfe:** Notwehr zugunsten Dritter (§ 32 Abs. 2 Var. 2). "
                "Gleiche Voraussetzungen; auch gegenüber Willen des Angegriffenen möglich (str.)."
            ),
            'english': (
                "**Notwehr – Self-Defence (§ 32 StGB)**\n\n"
                "**Definition:** Notwehr is the defence necessary to avert a present unlawful "
                "attack on oneself or another person (§ 32 II).\n\n"
                "**Elements:**\n\n"
                "**I. Defensive situation (Notwehrlage)**\n"
                "1. An attack — human volitional conduct threatening a legally protected interest.\n"
                "2. Present — ongoing or immediately imminent; ends on completion or abandonment.\n"
                "3. Unlawful — not itself justified.\n\n"
                "**II. Defensive act (Notwehrhandlung)**\n"
                "1. Any suitable counter-measure.\n"
                "2. Necessary — mildest means reliably capable of repelling the attack. "
                "No duty to retreat ('right need not yield to wrong').\n"
                "3. Geboten — social-ethical limits apply in exceptional cases "
                "(trivial attacks, attacks by persons lacking culpability, provocation).\n\n"
                "**III. Subjective element** — awareness and intent to defend.\n\n"
                "**Excess (§ 33):** If limits are exceeded out of confusion, fear, or "
                "terror, the defender is excused."
            ),
        },
        'sources': ['§ 32 StGB', '§ 33 StGB'],
    }

    _NOTSTAND = {
        'type': 'RULE',
        'domain': 'criminal',
        'explanation': {
            'german': (
                "**Notstand (§§ 34–35 StGB)**\n\n"
                "**Unterscheidung:** Deutsches Recht kennt zwei Notstandsfiguren:\n"
                "- **Rechtfertigender Notstand (§ 34 StGB):** schließt Rechtswidrigkeit aus.\n"
                "- **Entschuldigender Notstand (§ 35 StGB):** schließt nur die Schuld aus.\n\n"
                "**I. Rechtfertigender Notstand (§ 34 StGB)**\n\n"
                "**Voraussetzungen:**\n"
                "1. **Notstandslage** – gegenwärtige, nicht anders abwendbare Gefahr für "
                "Leben, Leib, Freiheit, Ehre, Eigentum oder anderes Rechtsgut.\n"
                "2. **Notstandshandlung** – Eingriff in fremde Rechtsgüter.\n"
                "3. **Interessenabwägung** – das geschützte Interesse überwiegt wesentlich "
                "das beeinträchtigte. Maßgeblich: Art der Güter, Grad der drohenden Gefahr, "
                "soziale Pflichten.\n"
                "4. **Angemessenheit** – kein unangemessenes Mittel zur Interessendurchsetzung.\n\n"
                "**Aggressivnotstand** – Eingriff in Rechtsgüter unbeteiligter Dritter "
                "(z.B. Zerstörung fremden Eigentums zur Rettung von Menschenleben).\n"
                "**Defensivnotstand** – Abwehr einer Gefahr, die von einer Sache ausgeht "
                "(Eingriff in die gefährliche Sache selbst).\n\n"
                "**II. Entschuldigender Notstand (§ 35 StGB)**\n\n"
                "**Voraussetzungen:**\n"
                "1. Gegenwärtige Gefahr für Leib, Leben oder Freiheit des Täters oder "
                "nahestehender Personen.\n"
                "2. Keine Zumutbarkeit anderer Abwendungsmöglichkeit.\n"
                "3. Einschränkung: Duldungspflicht besteht, wenn Täter die Gefahr selbst "
                "verschuldet hat oder in einem besonderen Rechtsverhältnis steht (z.B. "
                "Polizist, Soldat).\n\n"
                "**Rechtsfolge § 35:** Täter handelt rechtswidrig, aber entschuldigt – "
                "kein Schuldvorwurf. Kein Notwehrrecht des Genötigten. Verminderte "
                "Schuldfähigkeit möglich.\n\n"
                "**Abgrenzung:** § 34 rechtfertigt (Tat ist nicht rechtswidrig); "
                "§ 35 entschuldigt nur (Tat bleibt rechtswidrig, aber straflos)."
            ),
            'english': (
                "**Notstand – Necessity (§§ 34–35 StGB)**\n\n"
                "**Two distinct doctrines under German law:**\n\n"
                "**I. Justifying Necessity (§ 34 StGB)** — excludes unlawfulness.\n"
                "Requirements: (1) present danger to a legally protected interest not "
                "otherwise avoidable; (2) the protected interest substantially outweighs "
                "the infringed interest (Interessenabwägung); (3) the means are appropriate.\n\n"
                "*Aggressivnotstand*: Necessity against uninvolved third parties' property.\n"
                "*Defensivnotstand*: Defence against the source of danger itself.\n\n"
                "**II. Excusing Necessity (§ 35 StGB)** — excludes culpability only; "
                "the act remains unlawful.\n"
                "Requirements: present danger to life, limb, or liberty of the actor or "
                "close relatives; no reasonable alternative; no duty to endure the danger "
                "(reduced if actor caused the danger or holds a special legal duty, "
                "e.g. police officer).\n\n"
                "**Key distinction:** § 34 justifies (lawful act); § 35 only excuses "
                "(act remains unlawful but actor is not punished)."
            ),
        },
        'sources': ['§ 34 StGB', '§ 35 StGB'],
    }

    DOCTRINES = {
        'schuldprinzip': {
            'type': 'PRINCIPLE',
            'domain': 'criminal',
            'explanation': {
                'german': """**Das Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Rechtsnatur:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB).""",
                'english': """**The Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Legal Nature:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB)."""
            },
            'sources': ['GG Art. 1', 'GG Art. 20', 'StGB implied']
        },
        'verhältnismäßigkeitsprinzip': {
            'type': 'PRINCIPLE',
            'domain': 'constitutional',
            'explanation': {
                'german': 'Das Verhältnismäßigkeitsprinzip verlangt, dass staatliche Maßnahmen geeignet, erforderlich und angemessen sein müssen.',
                'english': 'The proportionality principle requires that state measures must be suitable, necessary, and appropriate.'
            },
            'sources': ['GG Art. 20']
        },
        # Schadensersatz and all aliases resolve to the same entry
        'tort_liability': _SCHADENSERSATZ,
        'schadensersatz': _SCHADENSERSATZ,
        'schadenersatz': _SCHADENSERSATZ,
        'damages': _SCHADENSERSATZ,
        'tort liability': _SCHADENSERSATZ,
        'haftung': _SCHADENSERSATZ,
        # Willenserklärung (declaration of intent, BGB §§ 116-144)
        'willenserklarung': _WILLENSERKLARUNG,
        'willenserklärung': _WILLENSERKLARUNG,
        'willenserklaerung': _WILLENSERKLARUNG,
        'declaration of intent': _WILLENSERKLARUNG,
        # Cross-statute Körperverletzung (StGB §§ 223-229 vs BGB § 823)
        'koerperverletzung': _KOERPERVERLETZUNG,
        'körperverletzung': _KOERPERVERLETZUNG,
        'stgb_bgb_comparison': _KOERPERVERLETZUNG,
        'stgb_bgb_vergleich': _KOERPERVERLETZUNG,
        'körperliche verletzung': _KOERPERVERLETZUNG,
        'bodily harm': _KOERPERVERLETZUNG,
        # Verjährung – statute of limitations (BGB §§ 194-218)
        'verjaehrung': _VERJÄHRUNG,
        'verjährung': _VERJÄHRUNG,
        'verjährungsfrist': _VERJÄHRUNG,
        'verjaehrungsfrist': _VERJÄHRUNG,
        'regelverjährung': _VERJÄHRUNG,
        'limitation period': _VERJÄHRUNG,
        'prescription': _VERJÄHRUNG,
        # Angebot und Annahme – offer and acceptance (BGB §§ 145-150)
        'angebot_annahme': _ANGEBOT_ANNAHME,
        'angebot': _ANGEBOT_ANNAHME,
        'annahme': _ANGEBOT_ANNAHME,
        'antrag': _ANGEBOT_ANNAHME,
        'vertragsangebot': _ANGEBOT_ANNAHME,
        'offer and acceptance': _ANGEBOT_ANNAHME,
        'antrag und annahme': _ANGEBOT_ANNAHME,
        # Geschäftsfähigkeit – legal capacity (BGB §§ 104-113)
        'geschaeftsfaehigkeit': _GESCHAEFTSFAEHIGKEIT,
        'geschäftsfähigkeit': _GESCHAEFTSFAEHIGKEIT,
        'geschäftsunfähigkeit': _GESCHAEFTSFAEHIGKEIT,
        'beschränkte geschäftsfähigkeit': _GESCHAEFTSFAEHIGKEIT,
        'legal capacity': _GESCHAEFTSFAEHIGKEIT,
        'rechtsfähigkeit': _GESCHAEFTSFAEHIGKEIT,
        # Stellvertretung – agency / representation (BGB §§ 164-181)
        'stellvertretung': _STELLVERTRETUNG,
        'vollmacht': _STELLVERTRETUNG,
        'bevollmächtigter': _STELLVERTRETUNG,
        'vertreter': _STELLVERTRETUNG,
        'vertretungsmacht': _STELLVERTRETUNG,
        'agency': _STELLVERTRETUNG,
        'legal representation': _STELLVERTRETUNG,
        # Ungerechtfertigte Bereicherung – unjust enrichment (BGB §§ 812-822)
        'bereicherung': _BEREICHERUNG,
        'ungerechtfertigte bereicherung': _BEREICHERUNG,
        'bereicherungsrecht': _BEREICHERUNG,
        'bereicherungsanspruch': _BEREICHERUNG,
        'condictio': _BEREICHERUNG,
        'unjust enrichment': _BEREICHERUNG,
        # Kaufmann – merchant concept (HGB §§ 1-6)
        'kaufmann': _KAUFMANN,
        'istkaufmann': _KAUFMANN,
        'kannkaufmann': _KAUFMANN,
        'formkaufmann': _KAUFMANN,
        'kaufleute': _KAUFMANN,
        'handelsgewerbe': _KAUFMANN,
        # Prokura – commercial power of attorney (HGB §§ 48-53)
        'prokura': _PROKURA,
        'prokurist': _PROKURA,
        'handlungsvollmacht': _PROKURA,
        'prokura hgb': _PROKURA,
        # ── Criminal law doctrines (StGB) ────────────────────────────────────
        # Mord vs Totschlag — comparison / Abgrenzung (§§ 211-212 StGB)
        'mord_totschlag_vergleich': _MORD_TOTSCHLAG_VERGLEICH,
        'unterschied mord totschlag': _MORD_TOTSCHLAG_VERGLEICH,
        'mord vs totschlag': _MORD_TOTSCHLAG_VERGLEICH,
        'mord oder totschlag': _MORD_TOTSCHLAG_VERGLEICH,
        'abgrenzung mord totschlag': _MORD_TOTSCHLAG_VERGLEICH,
        'vergleich mord totschlag': _MORD_TOTSCHLAG_VERGLEICH,
        'mord und totschlag': _MORD_TOTSCHLAG_VERGLEICH,
        # Totschlag – manslaughter (§ 212 StGB)
        'totschlag': _TOTSCHLAG,
        'manslaughter': _TOTSCHLAG,
        'tötungsdelikt': _TOTSCHLAG,
        '§ 212 stgb': _TOTSCHLAG,
        # Mord – murder (§ 211 StGB)
        'mord': _MORD,
        'murder': _MORD,
        'mordmerkmale': _MORD,
        'heimtücke': _MORD,
        'habgier': _MORD,
        'niedrige beweggründe': _MORD,
        '§ 211 stgb': _MORD,
        # Körperverletzung – bodily harm (§§ 223-229 StGB, criminal only)
        'koerperverletzung_stgb': _KOERPERVERLETZUNG_STGB,
        'einfache körperverletzung': _KOERPERVERLETZUNG_STGB,
        'gefährliche körperverletzung': _KOERPERVERLETZUNG_STGB,
        'schwere körperverletzung': _KOERPERVERLETZUNG_STGB,
        'fahrlässige körperverletzung': _KOERPERVERLETZUNG_STGB,
        'körperverletzung mit todesfolge': _KOERPERVERLETZUNG_STGB,
        'assault': _KOERPERVERLETZUNG_STGB,
        '§ 223 stgb': _KOERPERVERLETZUNG_STGB,
        '§ 224 stgb': _KOERPERVERLETZUNG_STGB,
        # Diebstahl – theft (§ 242 StGB)
        'diebstahl': _DIEBSTAHL,
        'theft': _DIEBSTAHL,
        'wegnahme': _DIEBSTAHL,
        'zueignungsabsicht': _DIEBSTAHL,
        'wohnungseinbruchsdiebstahl': _DIEBSTAHL,
        'einbruch': _DIEBSTAHL,
        '§ 242 stgb': _DIEBSTAHL,
        # Betrug – fraud (§ 263 StGB)
        'betrug': _BETRUG,
        'fraud': _BETRUG,
        'täuschung': _BETRUG,
        'vermögensschaden': _BETRUG,
        'computerbetrug': _BETRUG,
        '§ 263 stgb': _BETRUG,
        # Nötigung – coercion (§ 240 StGB)
        'nötigung': _NOETIGUNG,
        'noetigung': _NOETIGUNG,
        'coercion': _NOETIGUNG,
        'verwerflichkeitsklausel': _NOETIGUNG,
        'drohung stgb': _NOETIGUNG,
        '§ 240 stgb': _NOETIGUNG,
        # Untreue – breach of fiduciary duty (§ 266 StGB)
        'untreue': _UNTREUE,
        'breach of fiduciary duty': _UNTREUE,
        'missbrauchstatbestand': _UNTREUE,
        'treubruchtatbestand': _UNTREUE,
        'vermögensnachteil': _UNTREUE,
        'fiduciary duty': _UNTREUE,
        '§ 266 stgb': _UNTREUE,
        # Mittäterschaft – joint commission (§ 25 II StGB)
        'mittäterschaft': _MITTAETERSCHAFT,
        'mittaeterschaft': _MITTAETERSCHAFT,
        'mittäter': _MITTAETERSCHAFT,
        'mittaeter': _MITTAETERSCHAFT,
        'gemeinschaftliche tatbegehung': _MITTAETERSCHAFT,
        '§ 25 ii stgb': _MITTAETERSCHAFT,
        '§ 25 abs. 2 stgb': _MITTAETERSCHAFT,
        'joint commission': _MITTAETERSCHAFT,
        'tatherrschaft': _MITTAETERSCHAFT,
        'täterschaft stgb': _MITTAETERSCHAFT,
        # Mittelbare Täterschaft – indirect perpetration (§ 25 I Alt. 2 StGB)
        'mittelbare täterschaft': _MITTELBARE_TAETERSCHAFT,
        'mittelbare taeterschaft': _MITTELBARE_TAETERSCHAFT,
        'mittelbarer täter': _MITTELBARE_TAETERSCHAFT,
        'werkzeug stgb': _MITTELBARE_TAETERSCHAFT,
        'hintermann': _MITTELBARE_TAETERSCHAFT,
        '§ 25 i alt. 2 stgb': _MITTELBARE_TAETERSCHAFT,
        'indirect perpetration': _MITTELBARE_TAETERSCHAFT,
        'täter hinter dem täter': _MITTELBARE_TAETERSCHAFT,
        'mittelbare_taeterschaft': _MITTELBARE_TAETERSCHAFT,
        # Anstiftung – incitement (§ 26 StGB)
        'anstiftung': _ANSTIFTUNG,
        'anstifter': _ANSTIFTUNG,
        'bestimmung zur tat': _ANSTIFTUNG,
        'zur tat bestimmen': _ANSTIFTUNG,
        'incitement': _ANSTIFTUNG,
        '§ 26 stgb': _ANSTIFTUNG,
        # Beihilfe – aiding and abetting (§ 27 StGB)
        'beihilfe': _BEIHILFE,
        'gehilfe': _BEIHILFE,
        'hilfeleistung stgb': _BEIHILFE,
        'aiding and abetting': _BEIHILFE,
        '§ 27 stgb': _BEIHILFE,
        'strafmilderung beihilfe': _BEIHILFE,
        # Notwehr – self-defence (§ 32 StGB)
        'notwehr': _NOTWEHR,
        'nothilfe': _NOTWEHR,
        'notwehrlage': _NOTWEHR,
        'notwehrrecht': _NOTWEHR,
        'notwehrexzess': _NOTWEHR,
        'self-defence': _NOTWEHR,
        'selbstverteidigung': _NOTWEHR,
        '§ 32 stgb': _NOTWEHR,
        'putativnotwehr': _NOTWEHR,
        'rechtfertigungsgrund notwehr': _NOTWEHR,
        # Notstand – necessity (§§ 34-35 StGB)
        'notstand': _NOTSTAND,
        'rechtfertigender notstand': _NOTSTAND,
        'entschuldigender notstand': _NOTSTAND,
        '§ 34 stgb': _NOTSTAND,
        '§ 35 stgb': _NOTSTAND,
        'necessity': _NOTSTAND,
        'aggressivnotstand': _NOTSTAND,
        'defensivnotstand': _NOTSTAND,
        'übergesetzlicher notstand': _NOTSTAND,
    }

    doctrine = DOCTRINES.get(doctrine_name.lower())
    
    if not doctrine:
        return None
    
    return {
        'type': doctrine['type'],
        'domain': doctrine['domain'],
        'explanation': doctrine['explanation'].get(language, doctrine['explanation']['german']),
        'sources': doctrine['sources']
    }


def create_induction_pipeline(strict_mode: bool = True) -> DoctrineInductor:
    """
    Create a complete doctrine induction pipeline.
    
    This is the main entry point for external services.
    
    Args:
        strict_mode: Whether to enforce strict validation standards
        
    Returns:
        Configured DoctrineInductor ready for use
    """
    return create_doctrine_inductor(strict_mode=strict_mode)


def diagnose_question(question_text: str) -> Dict:
    """
    Diagnostic function to see how a question is processed.
    
    Args:
        question_text: The legal question
        
    Returns:
        Diagnostic information including field detection and authority resolution
    """
    return DoctrineTemplates.diagnose_question(question_text)


# Version compatibility helpers
def is_compatible_with_version(version: str) -> bool:
    """
    Check if the module is compatible with a given version.
    
    Args:
        version: Version string (e.g., "2.0.0")
        
    Returns:
        True if compatible
    """
    current_parts = __version__.split('.')
    target_parts = version.split('.')
    
    # Major version must match
    return current_parts[0] == target_parts[0]


# Quick access to default inductor
default_inductor = get_default_inductor()

# Export common templates for convenience
TEMPLATES = {
    "definition": DoctrineTemplates.definition(),
    "rule": DoctrineTemplates.rule(),
    "principle": DoctrineTemplates.principle(),
    "test": DoctrineTemplates.test(),
    "standard": DoctrineTemplates.standard(),
    "exception": DoctrineTemplates.exception(),
    "presumption": DoctrineTemplates.presumption()
}

# Add to __all__
__all__.extend([
    "create_induction_pipeline",
    "diagnose_question",
    "is_compatible_with_version",
    "default_inductor",
    "TEMPLATES"
])