// services/clarificationService.js

class ClarificationService {
  constructor() {
    // Clarification templates by language
    this.templates = {
      german: {
        MISSING_STATUTE: `**Statutenklärung erforderlich**\n\n` +
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
        
        AMBIGUOUS_REFERENCE: `**Mehrdeutiger Paragraph/Artikel**\n\n` +
                            `Ihre Frage nennt § {reference}, dieser existiert jedoch in mehreren Gesetzen:\n\n` +
                            `{statuteList}\n\n` +
                            `**Bitte spezifizieren Sie:**\n` +
                            `{specificationExamples}\n\n` +
                            `*In der deutschen Rechtsordnung sind Paragraphen nicht eindeutig ohne Gesetzesangabe.*`,
        
        MISSING_SOURCE: `**Quelle nicht verfügbar**\n\n` +
                       `Ihre Frage betrifft **{statuteName}**, jedoch ist dieses Gesetz derzeit nicht im System geladen.\n\n` +
                       `**Empfehlung:**\n` +
                       `• Laden Sie eine aktuelle Fassung des **{statuteName}** als PDF hoch\n` +
                       `• Starten Sie den Server neu\n\n` +
                       `*Das System kann nur aus geladenen Gesetzesquellen zitieren.*`,
        
        STATUTE_CONFLICT: `**Juristische Systematik beachtet**\n\n` +
                         `Ihre Frage betrifft **{expectedStatute}**, wurde aber von **{actualStatute}** beantwortet.\n\n` +
                         `**Grund:** {reason}\n\n` +
                         `**Empfehlung:**\n` +
                         `• Formulieren Sie die Frage spezifischer (z.B. mit Paragraphenangabe)\n` +
                         `• Oder fragen Sie nach einem konkreten Rechtsgebiet\n\n` +
                         `*Das System priorisiert juristische Korrektheit über einfache Antworten.*`,
        
        INSUFFICIENT_NORMS: `**Unzureichende normative Grundlage**\n\n` +
                           `Für **{statuteName}** benötigt das System:\n\n` +
                           `• Konkrete Paragraphenzitate (z.B. "§ 15 {statute}")\n` +
                           `• Normative Aussagen mit Rechtsfolgen\n` +
                           `• Keine Register-Metadaten oder Übersetzungs-Boilerplate\n\n` +
                           `**Gefunden:** {found} normative Textstellen\n` +
                           `**Erforderlich:** Mindestens {required}\n\n` +
                           `*Das System priorisiert judizierbare Normen über allgemeine Texte.*`
      },
      
      english: {
        MISSING_STATUTE: `**Statute clarification required**\n\n` +
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
                         `*Without statute reference, no precise answer can be given.*`,
        
        AMBIGUOUS_REFERENCE: `**Ambiguous paragraph/article**\n\n` +
                             `Your question mentions § {reference}, but this exists in multiple statutes:\n\n` +
                             `{statuteList}\n\n` +
                             `**Please specify:**\n` +
                             `{specificationExamples}\n\n` +
                             `*In German law, paragraphs are not unique without statute reference.*`,
        
        MISSING_SOURCE: `**Source not available**\n\n` +
                       `Your question concerns **{statuteName}**, but this law is not currently loaded in the system.\n\n` +
                       `**Recommendation:**\n` +
                       `• Upload a current version of **{statuteName}** as PDF\n` +
                       `• Restart the server\n\n` +
                       `*The system can only cite from loaded legal sources.*`,
        
        STATUTE_CONFLICT: `**Judicial Systematics Considered**\n\n` +
                         `Your question concerns **{expectedStatute}**, but was answered by **{actualStatute}**.\n\n` +
                         `**Reason:** {reason}\n\n` +
                         `**Recommendation:**\n` +
                         `• Phrase the question more specifically (e.g., with paragraph reference)\n` +
                         `• Or ask about a specific legal area\n\n` +
                         `*The system prioritizes judicial correctness over simple answers.*`,
        
        INSUFFICIENT_NORMS: `**Insufficient normative basis**\n\n` +
                           `For **{statuteName}**, the system requires:\n\n` +
                           `• Specific paragraph citations (e.g., "§ 15 {statute}")\n` +
                           `• Normative statements with legal consequences\n` +
                           `• No register metadata or translation boilerplate\n\n` +
                           `**Found:** {found} normative text passages\n` +
                           `**Required:** At least {required}\n\n` +
                           `*The system prioritizes adjudicable norms over general text.*`
      }
    };
    
    // Statute display names
    this.statuteDisplayNames = {
      'StGB': { german: 'Strafgesetzbuch (StGB)', english: 'Criminal Code (StGB)' },
      'BGB': { german: 'Bürgerliches Gesetzbuch (BGB)', english: 'Civil Code (BGB)' },
      'HGB': { german: 'Handelsgesetzbuch (HGB)', english: 'Commercial Code (HGB)' },
      'GG': { german: 'Grundgesetz (GG)', english: 'Basic Law (GG)' },
      'EU-GDPR': { german: 'EU-Datenschutz-Grundverordnung (GDPR)', english: 'EU Data Protection Regulation (GDPR)' }
    };
    
    console.log('✅ ClarificationService initialized');
  }

  /* -------------------------------------------------
     Main clarification generator
  -------------------------------------------------- */
  generateClarification(clarificationType, data, language = 'german') {
    console.log(`❓ [Clarification] Generating ${clarificationType} in ${language}`);
    
    const template = this.templates[language]?.[clarificationType];
    
    if (!template) {
      console.error(`No template for ${clarificationType} in ${language}`);
      return this.generateFallbackClarification(language);
    }
    
    // Process the template with data
    let processedTemplate = template;
    
    // Replace placeholders
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        if (processedTemplate.includes(placeholder)) {
          processedTemplate = processedTemplate.replace(
            new RegExp(placeholder, 'g'), 
            String(value)
          );
        }
      });
    }
    
    // Special processing for certain types
    if (clarificationType === 'AMBIGUOUS_REFERENCE' && data?.statutes) {
      processedTemplate = this.processAmbiguousReferenceTemplate(processedTemplate, data, language);
    }
    
    // Add standard footer
    processedTemplate += this.getClarificationFooter(language);
    
    return {
      type: clarificationType,
      language: language,
      message: processedTemplate,
      requiresUserAction: true,
      suggestedActions: this.getSuggestedActions(clarificationType, data, language),
      metadata: {
        generatedAt: new Date().toISOString(),
        data: data
      }
    };
  }

  /* -------------------------------------------------
     Process ambiguous reference template
  -------------------------------------------------- */
  processAmbiguousReferenceTemplate(template, data, language) {
    const { reference, statutes } = data;
    
    // Create statute list
    const statuteList = statutes.map(statute => {
      const displayName = this.getStatuteDisplayName(statute, language);
      return `• ${displayName}`;
    }).join('\n');
    
    // Create specification examples
    const specificationExamples = statutes.map(statute => {
      return `• "§ ${reference} **${statute}**"`;
    }).join('\n');
    
    return template
      .replace('{statuteList}', statuteList)
      .replace('{specificationExamples}', specificationExamples);
  }

  /* -------------------------------------------------
     Generate clarification from authority result
  -------------------------------------------------- */
  generateFromAuthorityResult(authorityResult, question, language = 'german') {
    if (!authorityResult || !authorityResult.status) {
      return this.generateFallbackClarification(language);
    }
    
    switch (authorityResult.status) {
      case 'MISSING':
        return this.generateClarification(
          'MISSING_STATUTE',
          { question: question.substring(0, 100) },
          language
        );
        
      case 'AMBIGUOUS':
        return this.generateClarification(
          'AMBIGUOUS_REFERENCE',
          {
            reference: this.extractReferenceFromQuestion(question),
            statutes: authorityResult.statutes,
            question: question.substring(0, 100)
          },
          language
        );
        
      default:
        return this.generateFallbackClarification(language);
    }
  }

  /* -------------------------------------------------
     Generate validation failure clarification
  -------------------------------------------------- */
  generateValidationClarification(validation, statute, language = 'german') {
    if (!validation || !validation.isValid) {
      const statuteName = this.getStatuteDisplayName(statute, language);
      
      if (validation?.reason?.includes('No § found')) {
        return this.generateClarification(
          'INSUFFICIENT_NORMS',
          {
            statuteName: statuteName,
            statute: statute,
            found: validation.found || 0,
            required: validation.required || 1
          },
          language
        );
      }
      
      if (validation?.reason?.includes('answered by')) {
        return this.generateClarification(
          'STATUTE_CONFLICT',
          {
            expectedStatute: this.getStatuteDisplayName(validation.expectedStatute, language),
            actualStatute: this.getStatuteDisplayName(validation.actualStatute, language),
            reason: validation.reason
          },
          language
        );
      }
    }
    
    return this.generateFallbackClarification(language);
  }

  /* -------------------------------------------------
     Generate missing source clarification
  -------------------------------------------------- */
  generateMissingSourceClarification(missingStatute, language = 'german') {
    const statuteName = this.getStatuteDisplayName(missingStatute, language);
    
    return this.generateClarification(
      'MISSING_SOURCE',
      {
        statuteName: statuteName,
        statute: missingStatute
      },
      language
    );
  }

  /* -------------------------------------------------
     Helper methods
  -------------------------------------------------- */
  extractReferenceFromQuestion(question) {
    const paragraphMatch = question.match(/§\s*(\d+[a-z]?)/i);
    if (paragraphMatch) return paragraphMatch[1];
    
    const articleMatch = question.match(/(?:Artikel|Art\.|Article)\s*(\d+[a-z]?)/i);
    if (articleMatch) return articleMatch[1];
    
    return 'XX';
  }
  
  getStatuteDisplayName(statute, language = 'german') {
    return this.statuteDisplayNames[statute]?.[language] || statute;
  }
  
  getClarificationFooter(language) {
    if (language === 'german') {
      return `\n\n---\n*Diese Klarstellung dient der juristischen Präzision. Bitte formulieren Sie Ihre Frage mit spezifischer Gesetzesangabe.*`;
    }
    
    return `\n\n---\n*This clarification serves legal precision. Please phrase your question with specific statute reference.*`;
  }
  
  getSuggestedActions(clarificationType, data, language) {
    const actions = [];
    
    if (clarificationType === 'MISSING_STATUTE') {
      actions.push({
        action: 'rephrase',
        description: language === 'german' ? 
          'Frage mit Gesetzesangabe umformulieren' : 
          'Rephrase question with statute reference',
        example: language === 'german' ? '§ 15 HGB' : '§ 15 HGB'
      });
    }
    
    if (clarificationType === 'AMBIGUOUS_REFERENCE' && data?.statutes) {
      data.statutes.forEach(statute => {
        actions.push({
          action: 'specify_statute',
          description: language === 'german' ? 
            `Mit "${statute}" spezifizieren` : 
            `Specify with "${statute}"`,
          example: language === 'german' ? 
            `"Was regelt § ${data.reference || 'XX'} ${statute}?"` :
            `"What does § ${data.reference || 'XX'} ${statute} regulate?"`
        });
      });
    }
    
    if (clarificationType === 'MISSING_SOURCE') {
      actions.push({
        action: 'upload_statute',
        description: language === 'german' ? 
          'Gesetz als PDF hochladen' : 
          'Upload statute as PDF',
        statute: data?.statute
      });
    }
    
    return actions;
  }
  
  generateFallbackClarification(language) {
    if (language === 'german') {
      return {
        type: 'FALLBACK',
        language: 'german',
        message: `**Klarstellung erforderlich**\n\n` +
                `Die Frage konnte nicht verarbeitet werden.\n\n` +
                `**Empfehlung:**\n` +
                `• Spezifische Gesetzesangabe hinzufügen (StGB, BGB, HGB, GG, GDPR)\n` +
                `• Paragraphen oder Artikelnummer angeben\n` +
                `• Rechtliches Fachgebiet benennen\n\n` +
                `*Für präzise Antworten sind spezifische rechtliche Referenzen notwendig.*`,
        requiresUserAction: true,
        suggestedActions: [
          {
            action: 'rephrase_with_statute',
            description: 'Mit Gesetzesangabe umformulieren',
            example: '§ 15 HGB'
          }
        ]
      };
    }
    
    return {
      type: 'FALLBACK',
      language: 'english',
      message: `**Clarification required**\n\n` +
              `The question could not be processed.\n\n` +
              `**Recommendation:**\n` +
              `• Add specific statute reference (StGB, BGB, HGB, GG, GDPR)\n` +
              `• Specify paragraph or article number\n` +
              `• Name the legal field\n\n` +
              `*For precise answers, specific legal references are necessary.*`,
      requiresUserAction: true,
      suggestedActions: [
        {
          action: 'rephrase_with_statute',
          description: 'Rephrase with statute reference',
          example: '§ 15 HGB'
        }
      ]
    };
  }

  /* -------------------------------------------------
     Generate structured refusal for chat service
  -------------------------------------------------- */
  generateStructuredRefusal(clarification, question, context = {}) {
    return {
      success: false,
      clarification: true,
      refusal: true,
      data: {
        clarification: clarification,
        originalQuestion: question,
        context: context,
        timestamp: new Date().toISOString(),
        guidance: {
          purpose: 'Ensure legal precision and prevent incorrect answers',
          benefit: 'More accurate and legally valid responses',
          nextSteps: clarification.suggestedActions || []
        }
      },
      metadata: {
        processingStage: 'authority_validation',
        decision: 'principled_refusal',
        confidence: 1.0,
        legalBasis: 'German law requires statute specificity for precise answers'
      }
    };
  }

  /* -------------------------------------------------
     Log clarification events
  -------------------------------------------------- */
  logClarificationEvent(eventType, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: eventType,
      details: details,
      service: 'ClarificationService'
    };
    
    console.log(`📝 [Clarification Log] ${eventType}:`, details);
    
    // In production, you would write to a log file or database
    return logEntry;
  }
}

module.exports = new ClarificationService();