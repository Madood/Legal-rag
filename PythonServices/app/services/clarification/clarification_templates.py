"""
Clarification templates.

Pure content layer - no logic, only templates.
Supports dynamic statute lists for uploaded documents.
"""

def missing_statute_template(available_statutes: list = None, suggestion: str = "") -> dict:
    """Template for when no statute is specified."""
    if available_statutes is None:
        available_statutes = [
            ("StGB", "Strafrecht", "Criminal law"),
            ("BGB", "Zivilrecht", "Civil law"),
            ("HGB", "Handelsrecht", "Commercial law"),
            ("GG", "Verfassungsrecht", "Constitutional law"),
            ("EU-GDPR", "Datenschutzrecht", "Data protection law")
        ]
    
    # Build statute lists
    german_statutes = "\n".join([f"• **{code}** - {name_de}" for code, name_de, _ in available_statutes])
    english_statutes = "\n".join([f"• **{code}** - {name_en}" for code, _, name_en in available_statutes])
    
    return {
        'german': f"""**Statutenklärung erforderlich**

Ihre Frage enthält keine eindeutige Gesetzesangabe.

**Verfügbare Gesetze:**
{german_statutes}

**Beispiele:**
• "Was regelt § 15 HGB?"
• "Welche Strafen sieht StGB § 242 vor?"
• "Was ist das Auskunftsrecht nach GDPR Artikel 15?"{suggestion}""",

        'english': f"""**Statute clarification required**

Your question does not contain a clear statute reference.

**Available statutes:**
{english_statutes}

**Examples:**
• "What does § 15 HGB regulate?"
• "What penalties does StGB § 242 provide?"
• "What is the right of access under GDPR Article 15?"{suggestion}"""
    }


def gdpr_clarification_template() -> dict:
    """Template for GDPR-specific clarifications."""
    return {
        'german': """**GDPR-Rechtsklarstellung erforderlich**

Ihre Frage betrifft die EU-Datenschutz-Grundverordnung (GDPR).

**Bitte spezifizieren Sie:**
• Das betroffene Recht (z.B. Auskunftsrecht, Löschungsrecht)
• Den konkreten Artikel (z.B. Artikel 15, Artikel 17)

**Beispiele:**
• "Auskunftsrecht nach Artikel 15 GDPR"
• "Recht auf Löschung (Artikel 17)"
• "Datenübertragbarkeit nach Artikel 20\"""",

        'english': """**GDPR rights clarification required**

Your question concerns the EU General Data Protection Regulation (GDPR).

**Please specify:**
• The relevant right (e.g., right of access, right to erasure)
• The specific article (e.g., Article 15, Article 17)

**Examples:**
• "Right of access under Article 15 GDPR"
• "Right to erasure (Article 17)"
• "Data portability under Article 20\""""
    }


def custom_document_template(document_name: str, detected_provisions: list = None) -> dict:
    """Template for clarification about uploaded custom documents."""
    if detected_provisions is None:
        detected_provisions = []
    
    provisions_text = ""
    if detected_provisions:
        provisions_text = "\n\n**Erkannte Bestimmungen:**\n" + "\n".join([f"• {p}" for p in detected_provisions])
        provisions_text_en = "\n\n**Detected provisions:**\n" + "\n".join([f"• {p}" for p in detected_provisions])
    else:
        provisions_text = ""
        provisions_text_en = ""
    
    return {
        'german': f"""**Dokumentspezifische Klärung erforderlich**

Ihre Frage bezieht sich auf das Dokument: **{document_name}**

**Bitte spezifizieren Sie:**
• Den genauen Abschnitt oder Artikel
• Die konkrete Bestimmungsnummer
• Die Seite oder Position im Dokument

**Beispiele:**
• "Was bedeutet Artikel 4.2 im Dokument?"
• "Erkläre §15 in {document_name}"
• "Welche Pflichten entstehen aus Kapitel 3?"{provisions_text}""",

        'english': f"""**Document-specific clarification required**

Your question refers to the document: **{document_name}**

**Please specify:**
• The exact section or article
• The specific provision number
• The page or position in the document

**Examples:**
• "What does Article 4.2 mean in the document?"
• "Explain §15 in {document_name}"
• "What obligations arise from Chapter 3?"{provisions_text_en if detected_provisions else ''}"""
    }