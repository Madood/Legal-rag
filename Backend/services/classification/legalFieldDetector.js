// services/legalFieldDetector.js

class LegalFieldDetector {
  constructor() {
    // Legal term to field mapping
    this.termToField = {
      // Criminal law (StGB)
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
      
      // Constitutional law (GG)
      'grundgesetz': 'constitutional',
      'grundrecht': 'constitutional',
      'verfassung': 'constitutional',
      'meinungsfreiheit': 'constitutional',
      'versammlungsfreiheit': 'constitutional',
      'eigentumsgarantie': 'constitutional',
      'menschenwürde': 'constitutional',
      'bundesverfassungsgericht': 'constitutional',
      
      // Commercial law (HGB)
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
      
      // Civil law (BGB)
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
      
      // Data protection (GDPR)
      'datenschutz': 'data_protection',
      'personenbezogen': 'data_protection',
      'einwilligung': 'data_protection',
      'datensicherheit': 'data_protection',
      'datenschutzbeauftragter': 'data_protection',
      'betroffenenrechte': 'data_protection',
      'datenschutzfolgenabschätzung': 'data_protection'
    };
    
    // Offense category mapping (criminal law only)
    this.offenseMapping = {
      'espionage': {
        statutes: ['StGB'],
        paragraphs: ['§ 94', '§ 95', '§ 96'],
        field: 'criminal',
        severity: 'severe'
      },
      'fraud': {
        statutes: ['StGB'],
        paragraphs: ['§ 263'],
        field: 'criminal',
        severity: 'medium'
      },
      'theft': {
        statutes: ['StGB'],
        paragraphs: ['§ 242', '§ 243'],
        field: 'criminal',
        severity: 'medium'
      },
      'murder': {
        statutes: ['StGB'],
        paragraphs: ['§ 211', '§ 212'],
        field: 'criminal',
        severity: 'severe'
      },
      'robbery': {
        statutes: ['StGB'],
        paragraphs: ['§ 249', '§ 250'],
        field: 'criminal',
        severity: 'severe'
      },
      'assault': {
        statutes: ['StGB'],
        paragraphs: ['§ 223', '§ 224'],
        field: 'criminal',
        severity: 'medium'
      },
      'insider trading': {
        statutes: ['WpHG'],
        paragraphs: ['§ 38'],
        field: 'commercial',
        severity: 'medium'
      }
    };
    
    // Common legal phrases that indicate field
    this.fieldIndicators = {
      'criminal': [
        'ist strafbar nach',
        'wird mit freiheitsstrafe bestraft',
        'wird mit geldstrafe bestraft',
        'begeht eine straftat',
        'wird verfolgt nach'
      ],
      'civil': [
        'hat anspruch auf',
        'ist verpflichtet zu',
        'muss schadensersatz leisten',
        'kann vom vertrag zurücktreten',
        'ist zur zahlung verpflichtet'
      ],
      'commercial': [
        'ist kaufmann im sinne des',
        'muss ins handelsregister eingetragen werden',
        'hat prokura für',
        'als handelsvertreter',
        'nach handelsbrauch'
      ],
      'constitutional': [
        'grundrecht auf',
        'garantiert durch artikel',
        'verfassungsrechtlich geschützt',
        'verstoß gegen das grundgesetz',
        'bundesverfassungsgericht entschied'
      ]
    };
    
    console.log('✅ LegalFieldDetector initialized');
  }

  /* -------------------------------------------------
     Main field detection
  -------------------------------------------------- */
  detectField(question) {
    const lowerQuestion = question.toLowerCase();
    
    console.log(`🔍 [FieldDetector] Analyzing: "${question.substring(0, 50)}..."`);
    
    // 1. Check for explicit statute abbreviations
    if (lowerQuestion.includes('stgb')) {
      return this.getFieldResult('criminal', 'StGB', 0.95);
    }
    
    if (lowerQuestion.includes('bgb')) {
      return this.getFieldResult('civil', 'BGB', 0.95);
    }
    
    if (lowerQuestion.includes('hgb')) {
      return this.getFieldResult('commercial', 'HGB', 0.95);
    }
    
    if (lowerQuestion.includes('gg')) {
      return this.getFieldResult('constitutional', 'GG', 0.95);
    }
    
    if (lowerQuestion.includes('gdpr') || lowerQuestion.includes('dsgvo')) {
      return this.getFieldResult('data_protection', 'EU-GDPR', 0.95);
    }
    
    // 2. Check for offense categories
    const offenseMatch = this.detectOffense(lowerQuestion);
    if (offenseMatch) {
      return offenseMatch;
    }
    
    // 3. Check for legal terms
    const termMatches = [];
    
    for (const [term, field] of Object.entries(this.termToField)) {
      if (lowerQuestion.includes(term)) {
        termMatches.push({ term, field, position: lowerQuestion.indexOf(term) });
      }
    }
    
    // Sort by position (earlier terms are more significant)
    termMatches.sort((a, b) => a.position - b.position);
    
    if (termMatches.length > 0) {
      const primaryMatch = termMatches[0];
      const statute = this.getStatuteForField(primaryMatch.field);
      
      return this.getFieldResult(
        primaryMatch.field, 
        statute, 
        0.8, // High confidence for term match
        { matchedTerm: primaryMatch.term }
      );
    }
    
    // 4. Check for paragraph ranges
    const paragraphMatch = this.inferFromParagraphRange(question);
    if (paragraphMatch) {
      return paragraphMatch;
    }
    
    // 5. No field detected
    console.log(`❌ [FieldDetector] No field detected`);
    return {
      field: null,
      statute: null,
      confidence: 0,
      method: 'none',
      details: 'Could not determine legal field'
    };
  }

  /* -------------------------------------------------
     Offense detection
  -------------------------------------------------- */
  detectOffense(question) {
    const lowerQuestion = question.toLowerCase();
    
    for (const [offense, data] of Object.entries(this.offenseMapping)) {
      if (lowerQuestion.includes(offense)) {
        console.log(`⚖️  [FieldDetector] Detected offense: ${offense}`);
        
        return {
          field: data.field,
          statutes: data.statutes,
          primaryStatute: data.statutes[0],
          paragraphs: data.paragraphs,
          offense: offense,
          confidence: 0.9,
          method: 'offense_mapping',
          severity: data.severity,
          details: `Offense "${offense}" maps to ${data.statutes.join(', ')}`
        };
      }
    }
    
    return null;
  }

  /* -------------------------------------------------
     Paragraph range inference
  -------------------------------------------------- */
  inferFromParagraphRange(question) {
    const paragraphMatch = question.match(/§\s*(\d+)/i);
    
    if (!paragraphMatch) return null;
    
    const paragraphNum = parseInt(paragraphMatch[1], 10);
    
    if (isNaN(paragraphNum)) return null;
    
    // HGB range
    if (paragraphNum >= 1 && paragraphNum <= 372) {
      console.log(`📊 [FieldDetector] Paragraph ${paragraphNum} → HGB range`);
      return this.getFieldResult('commercial', 'HGB', 0.85, { paragraph: paragraphNum });
    }
    
    // BGB range
    if (paragraphNum >= 1 && paragraphNum <= 2385) {
      console.log(`📊 [FieldDetector] Paragraph ${paragraphNum} → BGB range`);
      return this.getFieldResult('civil', 'BGB', 0.85, { paragraph: paragraphNum });
    }
    
    // StGB range
    if (paragraphNum >= 1 && paragraphNum <= 358) {
      console.log(`📊 [FieldDetector] Paragraph ${paragraphNum} → StGB range`);
      return this.getFieldResult('criminal', 'StGB', 0.85, { paragraph: paragraphNum });
    }
    
    return null;
  }

  /* -------------------------------------------------
     Field isolation
  -------------------------------------------------- */
  isolateField(field, allDocuments) {
    if (!field || !allDocuments || allDocuments.length === 0) {
      return [];
    }
    
    const statute = this.getStatuteForField(field);
    
    if (!statute) {
      console.log(`⚠️  [FieldDetector] No statute for field: ${field}`);
      return allDocuments; // Return all if can't isolate
    }
    
    // Filter documents by statute
    const filteredDocuments = allDocuments.filter(doc => 
      doc.metadata?.statute === statute
    );
    
    console.log(`🔒 [FieldDetector] Isolated ${filteredDocuments.length}/${allDocuments.length} documents for ${field} (${statute})`);
    
    return filteredDocuments;
  }

  /* -------------------------------------------------
     Content analysis for field reinforcement
  -------------------------------------------------- */
  analyzeContentForField(content, expectedField) {
    if (!content || typeof content !== 'string') {
      return { matches: 0, indicators: [] };
    }
    
    const lowerContent = content.toLowerCase();
    const indicators = this.fieldIndicators[expectedField] || [];
    const matches = [];
    
    indicators.forEach(indicator => {
      if (lowerContent.includes(indicator)) {
        matches.push({
          indicator,
          position: lowerContent.indexOf(indicator),
          confidence: 0.9
        });
      }
    });
    
    return {
      matches: matches.length,
      indicators: matches,
      confidence: Math.min(matches.length * 0.3, 1.0)
    };
  }

  /* -------------------------------------------------
     Helper methods
  -------------------------------------------------- */
  getStatuteForField(field) {
    const fieldToStatute = {
      'criminal': 'StGB',
      'civil': 'BGB',
      'commercial': 'HGB',
      'constitutional': 'GG',
      'data_protection': 'EU-GDPR'
    };
    
    return fieldToStatute[field] || null;
  }
  
  getFieldResult(field, statute, confidence, details = {}) {
    console.log(`✅ [FieldDetector] Detected: ${field} (${statute}), confidence: ${confidence}`);
    
    return {
      field,
      statute,
      confidence,
      method: details.method || 'term_detection',
      details: {
        ...details,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  getFieldDisplayName(field) {
    const displayNames = {
      'criminal': 'Strafrecht',
      'civil': 'Zivilrecht',
      'commercial': 'Handelsrecht',
      'constitutional': 'Verfassungsrecht',
      'data_protection': 'Datenschutzrecht',
      'general': 'Allgemeines Recht'
    };
    
    return displayNames[field] || field;
  }
  
  getStatuteDisplayName(statute) {
    const displayNames = {
      'StGB': 'Strafgesetzbuch',
      'BGB': 'Bürgerliches Gesetzbuch',
      'HGB': 'Handelsgesetzbuch',
      'GG': 'Grundgesetz',
      'EU-GDPR': 'EU-Datenschutz-Grundverordnung'
    };
    
    return displayNames[statute] || statute;
  }
}

module.exports = new LegalFieldDetector();