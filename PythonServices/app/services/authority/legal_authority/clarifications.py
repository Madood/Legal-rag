def missing_statute_clarification(question: str) -> dict:
    """Generate clarification when statute cannot be determined."""
    lower_question = question.lower()
    suggestion = ''
    
    if 'criminal' in lower_question or 'straf' in lower_question:
        suggestion = '\n\n**Suggestion:** Your question seems criminal law related. Try: "What does § 1 StGB regulate?"'
    elif 'data protection' in lower_question or 'privacy' in lower_question:
        suggestion = '\n\n**Suggestion:** Your question seems data protection related. Try: "What is the right of access under GDPR Article 15?"'
    
    return {
        'german': f"""**Statutenklärung erforderlich**

Ihre Frage enthält keine eindeutige Gesetzesangabe.

**Verfügbare Gesetze:**
• **StGB** - Strafrecht
• **BGB** - Zivilrecht
• **HGB** - Handelsrecht
• **GG** - Verfassungsrecht
• **EU-GDPR** - Datenschutzrecht

**Beispiele:**
• "Was regelt § 15 HGB?"
• "Welche Strafen sieht StGB § 242 vor?"
• "Was ist das Auskunftsrecht nach GDPR Artikel 15?"{suggestion}""",
        
        'english': f"""**Statute clarification required**

Your question does not contain a clear statute reference.

**Available statutes:**
• **StGB** - Criminal law
• **BGB** - Civil law
• **HGB** - Commercial law
• **GG** - Constitutional law
• **EU-GDPR** - Data protection law

**Examples:**
• "What does § 15 HGB regulate?"
• "What penalties does StGB § 242 provide?"
• "What is the right of access under GDPR Article 15?"{suggestion}"""
    }


def gdpr_clarification() -> dict:
    """Generate GDPR-specific clarification."""
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