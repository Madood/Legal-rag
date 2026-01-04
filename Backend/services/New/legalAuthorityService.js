// services/New/legalAuthorityService.js

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
    
    // IMPROVED: Statute patterns with better detection
    this.statutePatterns = {
      'StGB': {
        patterns: [
          /\bStGB\b/i,
          /\bStGB\s+§/i,
          /\bstrafgesetzbuch\b/i,
          /\bcriminal\s+code\b/i,
          /\bpenal\s+code\b/i,
          /\bstrafrecht\b/i,
          /\bcriminal\s+law\b/i,
          /§\s*\d+\s*(?:StGB|stgb)/i,
          /§\s*\d+\s*.*criminal/i,
          /§\s*\d+\s*.*penal/i
        ],
        field: 'criminal',
        displayName: 'Strafgesetzbuch (German Criminal Code)',
        keywords: ['straf', 'criminal', 'penal', 'theft', 'murder', 'robbery', 'prison', 'sentence', 'punishment']
      },
      
      'BGB': {
        patterns: [
          /\bBGB\b/i,
          /\bBGB\s+§/i,
          /\bbürgerliches\s+gesetzbuch\b/i,
          /\bcivil\s+code\b/i,
          /§\s*\d+\s*(?:BGB|bgb)/i,
          /§\s*\d+\s*.*civil/i
        ],
        field: 'civil',
        displayName: 'Bürgerliches Gesetzbuch (German Civil Code)',
        keywords: ['civil', 'contract', 'obligation', 'property', 'damages', 'liability', 'family', 'inheritance']
      },
      
      'HGB': {
        patterns: [
          /\bHGB\b/i,
          /\bHGB\s+§/i,
          /\bhandelsgesetzbuch\b/i,
          /\bcommercial\s+code\b/i,
          /§\s*\d+\s*(?:HGB|hgb)/i,
          /§\s*\d+\s*.*commercial/i
        ],
        field: 'commercial',
        displayName: 'Handelsgesetzbuch (German Commercial Code)',
        keywords: ['commercial', 'merchant', 'trade', 'business', 'company', 'firm', 'register']
      },
      
      'GG': {
        patterns: [
          /\bGG\b/i,
          /\bgrundgesetz\b/i,
          /\bconstitution\b/i,
          /\bbasic\s+law\b/i,
          /Artikel\s*\d+\s*(?:GG|gg)/i,
          /Article\s*\d+\s*.*constitution/i
        ],
        field: 'constitutional',
        displayName: 'Grundgesetz (German Basic Law)',
        keywords: ['constitution', 'basic law', 'grundrecht', 'freedom', 'democracy', 'state']
      },
      
      'EU-GDPR': {
        patterns: [
          /\bGDPR\b/i,
          /\bDSGVO\b/i,
          /\bdatenschutz-grundverordnung\b/i,
          /\bgeneral\s+data\s+protection\s+regulation\b/i,
          /Article\s*\d+\s*(?:GDPR|gdpr)/i
        ],
        field: 'data_protection',
        displayName: 'EU-Datenschutz-Grundverordnung (GDPR)',
        keywords: ['data protection', 'privacy', 'personal data', 'processing', 'consent']
      }
    };
    
    // IMPROVED: Doctrine mapping
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
     CORE: Lock statute before retrieval - IMPROVED
  -------------------------------------------------- */
  lockStatute(question) {
    console.log(`🔍 [Authority] Analyzing question for statute: "${question.substring(0, 60)}..."`);
    
    const lowerQuestion = question.toLowerCase();
    
    // Step 1: Check for explicit statute mentions with weighted scoring
    const statuteScores = {};
    
    for (const [statute, config] of Object.entries(this.statutePatterns)) {
      let score = 0;
      
      // Check patterns (highest weight)
      for (const pattern of config.patterns) {
        if (pattern.test(question)) {
          score += 10; // Pattern match gives high score
        }
      }
      
      // Check keywords in question
      for (const keyword of config.keywords) {
        if (lowerQuestion.includes(keyword.toLowerCase())) {
          score += 3; // Keyword match gives moderate score
        }
      }
      
      if (score > 0) {
        statuteScores[statute] = {
          score: score,
          field: config.field,
          displayName: config.displayName
        };
      }
    }
    
    // Step 2: Find the statute with highest score
    let bestStatute = null;
    let bestScore = 0;
    
    for (const [statute, data] of Object.entries(statuteScores)) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestStatute = statute;
      }
    }
    
    // Step 3: Handle results
    if (bestStatute && bestScore >= 10) {
      // High confidence match (pattern found)
      console.log(`🔒 [Authority] Locked statute: ${bestStatute} (${statuteScores[bestStatute].field}) - Score: ${bestScore}`);
      
      return {
        status: 'LOCKED',
        statute: bestStatute,
        field: statuteScores[bestStatute].field,
        source: 'explicit',
        confidence: Math.min(1.0, bestScore / 20),
        questionType: this.classifyQuestionType(question, bestStatute)
      };
    } else if (bestStatute && bestScore >= 3) {
      // Medium confidence match (keywords only)
      console.log(`🔍 [Authority] Implied statute: ${bestStatute} (${statuteScores[bestStatute].field}) - Score: ${bestScore}`);
      
      return {
        status: 'LOCKED',
        statute: bestStatute,
        field: statuteScores[bestStatute].field,
        source: 'implicit',
        confidence: Math.min(0.7, bestScore / 10),
        questionType: this.classifyQuestionType(question, bestStatute)
      };
    }
    
    // Step 4: Try paragraph-based inference
    const paragraphStatute = this.inferStatuteFromParagraph(question);
    if (paragraphStatute) {
      console.log(`🔍 [Authority] Inferred from paragraph: ${paragraphStatute.statute}`);
      return paragraphStatute;
    }
    
    // Step 5: Cannot determine statute
    console.log(`❌ [Authority] Cannot determine statute`);
    return {
      status: 'MISSING',
      clarification: this.generateMissingStatuteClarification(question)
    };
  }

  /* -------------------------------------------------
     IMPROVED: Paragraph-based inference
  -------------------------------------------------- */
  inferStatuteFromParagraph(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Extract paragraph number
    const paragraphMatch = question.match(/§\s*(\d+[a-z]?)/i);
    if (!paragraphMatch) return null;
    
    const paragraph = paragraphMatch[1];
    const num = parseInt(paragraph, 10);
    
    // Check context around the paragraph
    const contextBefore = question.substring(0, paragraphMatch.index).toLowerCase();
    const contextAfter = question.substring(paragraphMatch.index + paragraphMatch[0].length).toLowerCase();
    const fullContext = contextBefore + ' ' + contextAfter;
    
    // Check for statute mentions in context
    if (fullContext.includes('stgb') || fullContext.includes('criminal') || fullContext.includes('straf')) {
      return {
        status: 'LOCKED',
        statute: 'StGB',
        field: 'criminal',
        source: 'paragraph_context',
        confidence: 0.85,
        questionType: 'NORMATIVE'
      };
    }
    
    if (fullContext.includes('bgb') || fullContext.includes('civil') || fullContext.includes('bürgerlich')) {
      return {
        status: 'LOCKED',
        statute: 'BGB',
        field: 'civil',
        source: 'paragraph_context',
        confidence: 0.85,
        questionType: 'NORMATIVE'
      };
    }
    
    if (fullContext.includes('hgb') || fullContext.includes('commercial') || fullContext.includes('handel')) {
      return {
        status: 'LOCKED',
        statute: 'HGB',
        field: 'commercial',
        source: 'paragraph_context',
        confidence: 0.85,
        questionType: 'NORMATIVE'
      };
    }
    
    // Fallback to paragraph number ranges
    if (num >= 1 && num <= 358) { // StGB range
      return {
        status: 'LOCKED',
        statute: 'StGB',
        field: 'criminal',
        source: 'paragraph_range',
        confidence: 0.65,
        questionType: 'NORMATIVE'
      };
    }
    
    if (num >= 1 && num <= 372) { // HGB range
      return {
        status: 'LOCKED',
        statute: 'HGB',
        field: 'commercial',
        source: 'paragraph_range',
        confidence: 0.65,
        questionType: 'NORMATIVE'
      };
    }
    
    if (num >= 1 && num <= 2385) { // BGB range
      return {
        status: 'LOCKED',
        statute: 'BGB',
        field: 'civil',
        source: 'paragraph_range',
        confidence: 0.65,
        questionType: 'NORMATIVE'
      };
    }
    
    return null;
  }

  /* -------------------------------------------------
     IMPROVED: Question classification
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
    
    // Check for § or Article reference
    const hasLegalReference = /§\s*\d+|\barticle\s*\d+|\bartikel\s*\d+/i.test(lowerQuestion);
    
    if (hasLegalReference) {
      // Check if it's asking about an offense
      const offenseTerms = ['constitutes', 'regulated', 'defines', 'prescribes', 'provides', 'sanction', 'penalty', 'offense'];
      if (offenseTerms.some(term => lowerQuestion.includes(term))) {
        return 'NORMATIVE';
      }
      
      // Default for legal references
      return 'DEFINITION';
    }
    
    // Offense category questions
    const offenseTerms = [
      'espionage', 'fraud', 'theft', 'murder', 'robbery',
      'betrug', 'diebstahl', 'mord', 'spionage', 'raub'
    ];
    
    if (offenseTerms.some(term => lowerQuestion.includes(term))) {
      return 'OFFENSE';
    }
    
    // General questions about a specific statute
    if (statute && (lowerQuestion.includes('explain') || lowerQuestion.includes('what is') || lowerQuestion.includes('was ist'))) {
      return 'GENERAL_STATUTE';
    }
    
    return 'GENERAL';
  }

  /* -------------------------------------------------
     Field and hierarchy methods
  -------------------------------------------------- */
  getFieldFromStatute(statute) {
    const config = this.statutePatterns[statute];
    return config ? config.field : 'general';
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
     IMPROVED: Clarification generators
  -------------------------------------------------- */
  generateMissingStatuteClarification(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Try to suggest based on keywords
    let suggestion = '';
    
    if (lowerQuestion.includes('criminal') || lowerQuestion.includes('straf') || lowerQuestion.includes('penal')) {
      suggestion = '\n\n**Vorschlag:** Ihre Frage scheint sich auf Strafrecht zu beziehen. Bitte formulieren Sie: "Was regelt § 1 StGB?"';
    } else if (lowerQuestion.includes('commercial') || lowerQuestion.includes('handel') || lowerQuestion.includes('business')) {
      suggestion = '\n\n**Vorschlag:** Ihre Frage scheint sich auf Handelsrecht zu beziehen. Bitte formulieren Sie: "Was regelt § 1 HGB?"';
    } else if (lowerQuestion.includes('civil') || lowerQuestion.includes('bürgerlich') || lowerQuestion.includes('contract')) {
      suggestion = '\n\n**Vorschlag:** Ihre Frage scheint sich auf Zivilrecht zu beziehen. Bitte formulieren Sie: "Was regelt § 1 BGB?"';
    }
    
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
              `• "Erklären Sie Artikel 5 **GG**"` +
              suggestion +
              `\n\n*Ohne Gesetzesangabe kann keine präzise Antwort gegeben werden.*`,
      
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
               `• "Explain Article 5 **GG**"` +
               suggestion +
               `\n\n*Without statute reference, no precise answer can be given.*`
    };
  }

  generateAmbiguityClarification(statutes, question) {
    const statuteNames = statutes.map(s => this.statutePatterns[s]?.displayName || s).join(', ');
    
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
     IMPROVED: Validation methods
  -------------------------------------------------- */
  validateAnswer(question, answer, statute) {
    const lowerQuestion = question.toLowerCase();
    const lowerAnswer = answer.toLowerCase();
    
    const validations = [];
    
    // Check statute consistency
    const config = this.statutePatterns[statute];
    if (config) {
      // Check if question keywords match statute field
      const mismatchedKeywords = [];
      for (const keyword of config.keywords) {
        if (lowerQuestion.includes(keyword.toLowerCase()) && !lowerAnswer.includes(keyword.toLowerCase())) {
          mismatchedKeywords.push(keyword);
        }
      }
      
      if (mismatchedKeywords.length > 0) {
        validations.push({
          isValid: false,
          severity: 'warning',
          reason: `Answer missing keywords from question: ${mismatchedKeywords.join(', ')}`,
          recommendation: `Include relevant legal terminology`
        });
      }
    }
    
    // Check if answer contains statute reference
    if (statute && !lowerAnswer.includes(statute.toLowerCase())) {
      validations.push({
        isValid: false,
        severity: 'error',
        reason: `Answer does not mention the governing statute (${statute})`,
        recommendation: `Include ${statute} citation in answer`
      });
    }
    
    // Check for paragraph reference if question has one
    const questionParagraph = question.match(/§\s*(\d+[a-z]?)/i);
    if (questionParagraph) {
      const paragraph = questionParagraph[0];
      if (!lowerAnswer.includes(paragraph.toLowerCase())) {
        validations.push({
          isValid: false,
          severity: 'warning',
          reason: `Answer does not reference the paragraph from question (${paragraph})`,
          recommendation: `Include reference to ${paragraph}`
        });
      }
    }
    
    // If all validations passed
    if (validations.length === 0) {
      return {
        isValid: true,
        message: 'Answer validated against legal authority'
      };
    }
    
    // Check if there are any critical errors
    const hasError = validations.some(v => v.severity === 'error');
    
    return {
      isValid: !hasError,
      validations: validations,
      message: hasError ? 'Answer failed legal authority validation' : 'Answer has warnings but passes validation'
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
    const config = this.statutePatterns[statute];
    return config ? config.displayName : statute;
  }
  
  /**
   * Get all available statutes
   */
  getAvailableStatutes() {
    return Object.keys(this.statutePatterns);
  }
  
  /**
   * Debug method to test statute detection
   */
  testStatuteDetection(question) {
    console.log(`\n🧪 Testing statute detection for: "${question}"`);
    const result = this.lockStatute(question);
    
    console.log(`Result:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Statute: ${result.statute || 'none'}`);
    console.log(`  Field: ${result.field || 'none'}`);
    console.log(`  Source: ${result.source || 'none'}`);
    console.log(`  Confidence: ${result.confidence || 'none'}`);
    console.log(`  Question Type: ${result.questionType || 'none'}`);
    
    return result;
  }
}

module.exports = new LegalAuthorityService();