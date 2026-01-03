// services/legalAuthorityService.js

class LegalAuthorityService {
  constructor() {
    // Legal hierarchy: GG > EU-GDPR > StGB > BGB > HGB
    this.legalHierarchy = {
      'GG': 100,     // Constitutional law
      'EU-GDPR': 90, // Supranational EU law
      'StGB': 80,    // Criminal law
      'BGB': 70,     // Civil law
      'HGB': 60      // Commercial law
    };
    
    // Legal fields isolation matrix
    this.fieldIsolation = {
      'criminal': ['StGB'],
      'constitutional': ['GG'],
      'civil': ['BGB'],
      'commercial': ['HGB'],
      'data_protection': ['EU-GDPR']
    };
    
    // Statute patterns for detection
    this.statutePatterns = {
      'StGB': /\bStGB\b|§\s*\d+\s*StGB|Strafgesetzbuch/i,
      'BGB': /\bBGB\b|§\s*\d+\s*BGB|Bürgerliches Gesetzbuch/i,
      'HGB': /\bHGB\b|§\s*\d+\s*HGB|Handelsgesetzbuch/i,
      'GG': /\bGG\b|Artikel\s*\d+\s*GG|Grundgesetz/i,
      'EU-GDPR': /\bGDPR\b|DSGVO|Datenschutz-Grundverordnung|Artikel\s*\d+\s*GDPR/i
    };
    
    // Doctrine mapping (no retrieval needed)
    this.doctrines = {
      'schuldprinzip': {
        type: 'PRINCIPLE',
        field: 'criminal',
        explanation: {
          german: `**Das Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Rechtsnatur:** Ein fundamentaler Grundsatz des deutschen Strafrechts.

**Verfassungsgrundlage:** Menschenwürde (Art. 1 GG) und Rechtsstaatsprinzip (Art. 20 GG).

**Kernaussage:** "Ohne Schuld keine Strafe" – Strafe erfordert persönliche Verantwortung.

**Praxis:** Vorsatzerfordernis (§ 15 StGB), Schuldfähigkeit (§ 20 StGB), Verbot der Erfolgshaftung.

*Kein einzelner Paragraph, sondern ein durchgängiges Prinzip.*`,
          english: `**The Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Legal Nature:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law principle (Art. 20 GG).

**Core Statement:** "No punishment without guilt" – punishment requires personal responsibility.

**Practice:** Requirement of intent (§ 15 StGB), criminal capacity (§ 20 StGB), prohibition of result-based liability.

*Not a single paragraph, but a pervasive principle.*`
        },
        sources: ['GG Art. 1', 'GG Art. 20', 'StGB implied']
      },
      'verhältnismäßigkeitsprinzip': {
        type: 'PRINCIPLE',
        field: 'constitutional',
        explanation: {
          german: 'Das Verhältnismäßigkeitsprinzip verlangt, dass staatliche Maßnahmen geeignet, erforderlich und angemessen sein müssen.',
          english: 'The proportionality principle requires that state measures must be suitable, necessary, and appropriate.'
        },
        sources: ['GG Art. 20']
      }
    };
    
    console.log('✅ LegalAuthorityService initialized');
  }

  /* -------------------------------------------------
     CORE: Lock statute before retrieval
  -------------------------------------------------- */
  lockStatute(question) {
    console.log(`🔍 [Authority] Analyzing question for statute: "${question}"`);
    
    const lowerQuestion = question.toLowerCase();
    
    // Step 1: Check for explicit statute mentions
    const explicitStatutes = [];
    
    for (const [statute, pattern] of Object.entries(this.statutePatterns)) {
      if (pattern.test(question)) {
        explicitStatutes.push(statute);
      }
    }
    
    // Step 2: Handle multiple explicit statutes
    if (explicitStatutes.length > 1) {
      console.log(`⚠️  Multiple statutes detected: ${explicitStatutes.join(', ')}`);
      return {
        status: 'AMBIGUOUS',
        statutes: explicitStatutes,
        clarification: this.generateAmbiguityClarification(explicitStatutes, question)
      };
    }
    
    // Step 3: Single explicit statute found
    if (explicitStatutes.length === 1) {
      const statute = explicitStatutes[0];
      const field = this.getFieldFromStatute(statute);
      console.log(`🔒 [Authority] Locked statute: ${statute} (${field})`);
      
      return {
        status: 'LOCKED',
        statute: statute,
        field: field,
        source: 'explicit',
        questionType: this.classifyQuestionType(question, statute)
      };
    }
    
    // Step 4: No explicit statute - try implicit detection
    const impliedStatute = this.inferStatuteFromQuestion(question);
    
    if (impliedStatute) {
      const field = this.getFieldFromStatute(impliedStatute);
      console.log(`🔍 [Authority] Implied statute: ${impliedStatute} (${field})`);
      
      return {
        status: 'LOCKED',
        statute: impliedStatute,
        field: field,
        source: 'implicit',
        questionType: this.classifyQuestionType(question, impliedStatute),
        confidence: 0.7 // Lower confidence for implicit detection
      };
    }
    
    // Step 5: Cannot determine statute
    console.log(`❌ [Authority] Cannot determine statute`);
    return {
      status: 'MISSING',
      clarification: this.generateMissingStatuteClarification(question)
    };
  }

  /* -------------------------------------------------
     Implicit statute inference
  -------------------------------------------------- */
  inferStatuteFromQuestion(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Check paragraph references
    const paragraphMatch = question.match(/§\s*(\d+[a-z]?)/i);
    if (paragraphMatch) {
      const paragraph = paragraphMatch[1];
      const num = parseInt(paragraph, 10);
      
      // HGB range
      if (num >= 1 && num <= 372) {
        return 'HGB'; // Commercial law paragraphs
      }
      
      // BGB range
      if (num >= 1 && num <= 2385) {
        return 'BGB'; // Civil law paragraphs
      }
      
      // StGB range
      if (num >= 1 && num <= 358) {
        return 'StGB'; // Criminal law paragraphs
      }
    }
    
    // Check article references
    const articleMatch = question.match(/(?:Artikel|Art\.|Article)\s*(\d+)/i);
    if (articleMatch) {
      const article = articleMatch[1];
      
      // GG articles
      if (article >= 1 && article <= 146) {
        return 'GG';
      }
      
      // GDPR articles
      if (article >= 1 && article <= 99) {
        return 'EU-GDPR';
      }
    }
    
    // Check for legal fields
    if (lowerQuestion.includes('strafbar') || lowerQuestion.includes('freiheitsstrafe') || 
        lowerQuestion.includes('geldstrafe') || lowerQuestion.includes('verbrechen')) {
      return 'StGB';
    }
    
    if (lowerQuestion.includes('kaufmann') || lowerQuestion.includes('handelsregister') || 
        lowerQuestion.includes('prokura') || lowerQuestion.includes('firma')) {
      return 'HGB';
    }
    
    if (lowerQuestion.includes('vertrag') || lowerQuestion.includes('miete') || 
        lowerQuestion.includes('kauf') || lowerQuestion.includes('schadensersatz')) {
      return 'BGB';
    }
    
    if (lowerQuestion.includes('grundrecht') || lowerQuestion.includes('meinungsfreiheit') || 
        lowerQuestion.includes('verfassung')) {
      return 'GG';
    }
    
    if (lowerQuestion.includes('datenschutz') || lowerQuestion.includes('personenbezogen')) {
      return 'EU-GDPR';
    }
    
    return null;
  }

  /* -------------------------------------------------
     Question classification
  -------------------------------------------------- */
  classifyQuestionType(question, statute = null) {
    const lowerQuestion = question.toLowerCase();
    
    // Doctrine questions
    const doctrineTerms = [
      'schuldprinzip', 'guilt principle', 'nulla poena sine culpa',
      'verhältnismäßigkeitsprinzip', 'proportionality principle',
      'rechtsstaatsprinzip', 'rule of law principle',
      'was ist das prinzip', 'explain the doctrine',
      'legal doctrine', 'rechtspri', 'grundsatz'
    ];
    
    if (doctrineTerms.some(term => lowerQuestion.includes(term))) {
      return 'DOCTRINE';
    }
    
    // System questions
    const systemTerms = [
      'common law system', 'civil law system', 'legal system',
      'german legal system', 'type of legal system',
      'is germany a common law', 'classification of legal system'
    ];
    
    if (systemTerms.some(term => lowerQuestion.includes(term))) {
      return 'SYSTEM';
    }
    
    // Normative questions (with paragraph/article reference)
    if (/§\s*\d+|\barticle\s*\d+|\bartikel\s*\d+/i.test(lowerQuestion)) {
      return 'NORMATIVE';
    }
    
    // Offense category questions
    const offenseTerms = [
      'espionage', 'fraud', 'theft', 'murder', 'robbery',
      'betrug', 'diebstahl', 'mord', 'spionage', 'raub'
    ];
    
    if (offenseTerms.some(term => lowerQuestion.includes(term))) {
      return 'OFFENSE';
    }
    
    // General legal question within a statute
    if (statute) {
      return 'GENERAL_STATUTE';
    }
    
    return 'GENERAL';
  }

  /* -------------------------------------------------
     Field and hierarchy methods
  -------------------------------------------------- */
  getFieldFromStatute(statute) {
    const fieldMap = {
      'StGB': 'criminal',
      'BGB': 'civil',
      'HGB': 'commercial',
      'GG': 'constitutional',
      'EU-GDPR': 'data_protection'
    };
    
    return fieldMap[statute] || 'general';
  }
  
  getStatutesForField(field) {
    return this.fieldIsolation[field] || [];
  }
  
  compareHierarchy(statuteA, statuteB) {
    const rankA = this.legalHierarchy[statuteA] || 0;
    const rankB = this.legalHierarchy[statuteB] || 0;
    
    if (rankA > rankB) return 1; // A is higher
    if (rankA < rankB) return -1; // B is higher
    return 0; // Equal
  }

  /* -------------------------------------------------
     Clarification generators
  -------------------------------------------------- */
  generateMissingStatuteClarification(question) {
    return {
      german: `**Statutenklärung erforderlich**\n\n` +
              `Ihre Frage enthält keine eindeutige Gesetzesangabe.\n\n` +
              `**Verfügbare Gesetze:**\n` +
              `• **StGB** (Strafgesetzbuch) - für Strafrecht\n` +
              `• **BGB** (Bürgerliches Gesetzbuch) - für Zivilrecht\n` +
              `• **HGB** (Handelsgesetzbuch) - für Handelsrecht\n` +
              `• **GG** (Grundgesetz) - für Verfassungsrecht\n` +
              `• **EU-GDPR** - für Datenschutzrecht\n\n` +
              `**Beispiele korrekter Fragestellung:**\n` +
              `• "Was regelt § 15 **HGB**?"\n` +
              `• "Welche Strafen sieht **StGB** § 242 vor?"\n` +
              `• "Erklären Sie Artikel 5 **GG**"\n\n` +
              `*Ohne Gesetzesangabe kann keine präzise Antwort gegeben werden.*`,
      
      english: `**Statute clarification required**\n\n` +
               `Your question does not contain a clear statute reference.\n\n` +
               `**Available statutes:**\n` +
               `• **StGB** (Criminal Code) - for criminal law\n` +
               `• **BGB** (Civil Code) - for civil law\n` +
               `• **HGB** (Commercial Code) - for commercial law\n` +
               `• **GG** (Basic Law) - for constitutional law\n` +
               `• **EU-GDPR** - for data protection law\n\n` +
               `**Examples of correct phrasing:**\n` +
               `• "What does § 15 **HGB** regulate?"\n` +
               `• "What penalties does **StGB** § 242 provide?"\n` +
               `• "Explain Article 5 **GG**"\n\n` +
               `*Without statute reference, no precise answer can be given.*`
    };
  }

  generateAmbiguityClarification(statutes, question) {
    const statuteNames = statutes.map(s => {
      const names = {
        'StGB': 'Strafgesetzbuch (StGB)',
        'BGB': 'Bürgerliches Gesetzbuch (BGB)',
        'HGB': 'Handelsgesetzbuch (HGB)',
        'GG': 'Grundgesetz (GG)',
        'EU-GDPR': 'EU-Datenschutz-Grundverordnung (GDPR)'
      };
      return names[s] || s;
    }).join(', ');
    
    return {
      german: `**Mehrdeutige Gesetzesangabe**\n\n` +
              `Ihre Frage bezieht sich auf mehrere Gesetze: ${statuteNames}\n\n` +
              `**Bitte spezifizieren Sie:**\n` +
              statutes.map(s => `• Frage mit "${s}" eindeutig machen`).join('\n') +
              `\n\n*In der deutschen Rechtsordnung sind Gesetze nicht austauschbar.*`,
      
      english: `**Ambiguous statute reference**\n\n` +
               `Your question references multiple statutes: ${statuteNames}\n\n` +
               `**Please specify:**\n` +
               statutes.map(s => `• Make question unambiguous with "${s}"`).join('\n') +
               `\n\n*In German law, statutes are not interchangeable.*`
    };
  }

  /* -------------------------------------------------
     Doctrine handling
  -------------------------------------------------- */
  getDoctrineExplanation(doctrineName, language = 'german') {
    const doctrine = this.doctrines[doctrineName.toLowerCase()];
    
    if (!doctrine) {
      return null;
    }
    
    return {
      type: doctrine.type,
      field: doctrine.field,
      explanation: doctrine.explanation[language] || doctrine.explanation.german,
      sources: doctrine.sources
    };
  }

  /* -------------------------------------------------
     Validation methods
  -------------------------------------------------- */
  validateAnswer(question, answer, statute) {
    const lowerQuestion = question.toLowerCase();
    const lowerAnswer = answer.toLowerCase();
    
    const validations = [];
    
    // Criminal law should not cite GDPR
    if ((lowerQuestion.includes('straf') || lowerQuestion.includes('criminal')) && 
        statute === 'EU-GDPR') {
      validations.push({
        isValid: false,
        reason: 'Criminal law question answered by data protection regulation',
        expected: 'StGB or GG',
        actual: 'EU-GDPR'
      });
    }
    
    // Constitutional questions should cite GG
    if ((lowerQuestion.includes('grundgesetz') || lowerQuestion.includes('constitution')) && 
        statute !== 'GG') {
      validations.push({
        isValid: false,
        reason: 'Constitutional question answered by non-constitutional statute',
        expected: 'GG',
        actual: statute
      });
    }
    
    // Commercial questions should cite HGB
    if ((lowerQuestion.includes('kaufmann') || lowerQuestion.includes('handel')) && 
        statute !== 'HGB') {
      validations.push({
        isValid: false,
        reason: 'Commercial law question answered by non-commercial statute',
        expected: 'HGB',
        actual: statute
      });
    }
    
    // Check if answer contains statute reference
    if (statute && !lowerAnswer.includes(statute.toLowerCase())) {
      validations.push({
        isValid: false,
        reason: `Answer does not mention the governing statute (${statute})`,
        recommendation: `Include ${statute} citation in answer`
      });
    }
    
    // If all validations passed
    if (validations.length === 0) {
      return {
        isValid: true,
        message: 'Answer validated against legal authority'
      };
    }
    
    return {
      isValid: false,
      validations: validations,
      message: 'Answer failed legal authority validation'
    };
  }

  /* -------------------------------------------------
     Utility methods
  -------------------------------------------------- */
  extractLegalReference(question) {
    const paragraphMatch = question.match(/§\s*(\d+[a-z]?)/i);
    const paragraph = paragraphMatch ? paragraphMatch[1] : null;
    
    const articleMatch = question.match(/(?:Artikel|Art\.|Article)\s*(\d+[a-z]?)/i);
    const article = articleMatch ? articleMatch[1] : null;
    
    const requestedReference = paragraph || article;
    const isArticle = !!article;
    
    return { paragraph, article, requestedReference, isArticle };
  }

  getStatuteDisplayName(statute) {
    const displayNames = {
      'StGB': 'Strafgesetzbuch (StGB)',
      'BGB': 'Bürgerliches Gesetzbuch (BGB)',
      'HGB': 'Handelsgesetzbuch (HGB)',
      'GG': 'Grundgesetz (GG)',
      'EU-GDPR': 'EU-Datenschutz-Grundverordnung (GDPR)'
    };
    
    return displayNames[statute] || statute;
  }
}

module.exports = new LegalAuthorityService();