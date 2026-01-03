// services/questionClassifier.js

class QuestionClassifier {
  constructor() {
    // Question type patterns
    this.patterns = {
      DOCTRINE: [
        'schuldprinzip', 'guilt principle', 'nulla poena sine culpa',
        'verhältnismäßigkeitsprinzip', 'proportionality principle',
        'rechtsstaatsprinzip', 'rule of law principle',
        'was ist das prinzip', 'explain the doctrine',
        'legal doctrine', 'rechtspri', 'grundsatz',
        'legal principle', 'rechtsgrundsatz'
      ],
      
      SYSTEM: [
        'common law system', 'civil law system', 'legal system',
        'german legal system', 'type of legal system',
        'is germany a common law', 'classification of legal system',
        'rechtskreis', 'rechtsfamilie'
      ],
      
      NORMATIVE: [
        '§\\s*\\d', 'artikel\\s*\\d', 'article\\s*\\d',
        'paragraph\\s*\\d', 'section\\s*\\d',
        'was regelt §', 'what does article',
        'erklären sie §', 'explain section'
      ],
      
      OFFENSE: [
        'espionage', 'fraud', 'theft', 'murder', 'robbery', 'assault',
        'spionage', 'betrug', 'diebstahl', 'mord', 'raub', 'körperverletzung',
        'sexual offence', 'sexualstraftat', 'terrorism', 'terrorismus',
        'which crime', 'welche straftat'
      ],
      
      DEFINITION: [
        'what is', 'was ist', 'define', 'definition von',
        'meaning of', 'bedeutung von', 'erklären sie',
        'explain the term', 'begriffserklärung'
      ],
      
      COMPARISON: [
        'difference between', 'unterschied zwischen',
        'compare', 'vergleichen', 'similar to', 'ähnlich wie',
        'versus', 'vs', 'im vergleich zu'
      ],
      
      PROCEDURAL: [
        'how to', 'wie wird', 'procedure for', 'verfahren für',
        'steps to', 'schritte zur', 'process for', 'ablauf bei',
        'what are the requirements', 'voraussetzungen für'
      ]
    };
    
    // Complexity indicators
    this.complexityIndicators = {
      high: ['constitutional', 'fundamental', 'supreme court', 'verfassungsgericht',
             'european court', 'europäischer gerichtshof', 'human rights', 'menschenrechte'],
      medium: ['liability', 'haftung', 'contract', 'vertrag', 'damages', 'schaden',
               'obligation', 'verpflichtung'],
      low: ['definition', 'meaning', 'simple', 'basic', 'grundlegend']
    };
    
    // Language detection
    this.germanIndicators = ['der', 'die', 'das', 'und', 'für', 'mit', 'ist', 'sind', '§', 'artikel'];
    this.englishIndicators = ['the', 'a', 'an', 'and', 'for', 'with', 'is', 'are', 'section', 'article'];
    
    console.log('✅ QuestionClassifier initialized');
  }

  /* -------------------------------------------------
     Main classification
  -------------------------------------------------- */
  classify(question, statute = null) {
    const lowerQuestion = question.toLowerCase().trim();
    
    console.log(`🎯 [Classifier] Classifying: "${question.substring(0, 60)}..."`);
    
    // Step 1: Detect language
    const language = this.detectLanguage(lowerQuestion);
    
    // Step 2: Classify by type
    const type = this.classifyByType(lowerQuestion);
    
    // Step 3: Assess complexity
    const complexity = this.assessComplexity(lowerQuestion, type, statute);
    
    // Step 4: Check for legal reference
    const legalReference = this.extractLegalReference(question);
    
    // Step 5: Determine if statute-specific
    const isStatuteSpecific = statute !== null;
    
    // Step 6: Determine retrieval requirements
    const requiresRetrieval = this.determineRetrievalRequirement(type, legalReference);
    
    // Step 7: Generate structured classification
    const classification = {
      type,
      language,
      complexity,
      legalReference,
      isStatuteSpecific,
      requiresRetrieval,
      requiresExactReference: this.requiresExactReference(type, legalReference),
      requiresCitation: this.requiresCitation(type),
      requiresStatuteLock: this.requiresStatuteLock(type, statute),
      details: this.generateDetails(type, lowerQuestion, statute)
    };
    
    console.log(`📋 [Classifier] Result: ${type} (${language}), ${complexity} complexity`);
    console.log(`   Requires retrieval: ${requiresRetrieval}`);
    console.log(`   Statute specific: ${isStatuteSpecific}`);
    console.log(`   Legal reference: ${legalReference ? legalReference.requestedReference : 'none'}`);
    
    return classification;
  }

  /* -------------------------------------------------
     Type classification
  -------------------------------------------------- */
  classifyByType(question) {
    // Check for doctrine questions first (bypass retrieval)
    for (const pattern of this.patterns.DOCTRINE) {
      if (question.includes(pattern)) {
        return 'DOCTRINE';
      }
    }
    
    // Check for system questions (bypass retrieval)
    for (const pattern of this.patterns.SYSTEM) {
      if (question.includes(pattern)) {
        return 'SYSTEM';
      }
    }
    
    // Check for normative questions (require exact reference)
    for (const pattern of this.patterns.NORMATIVE) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(question)) {
        return 'NORMATIVE';
      }
    }
    
    // Check for offense questions
    for (const pattern of this.patterns.OFFENSE) {
      if (question.includes(pattern)) {
        return 'OFFENSE';
      }
    }
    
    // Check for definition questions
    for (const pattern of this.patterns.DEFINITION) {
      if (question.includes(pattern)) {
        return 'DEFINITION';
      }
    }
    
    // Check for comparison questions
    for (const pattern of this.patterns.COMPARISON) {
      if (question.includes(pattern)) {
        return 'COMPARISON';
      }
    }
    
    // Check for procedural questions
    for (const pattern of this.patterns.PROCEDURAL) {
      if (question.includes(pattern)) {
        return 'PROCEDURAL';
      }
    }
    
    // Default to general legal question
    return 'GENERAL';
  }

  /* -------------------------------------------------
     Language detection
  -------------------------------------------------- */
  detectLanguage(question) {
    let germanScore = 0;
    let englishScore = 0;
    
    this.germanIndicators.forEach(term => {
      if (question.includes(` ${term} `) || question.startsWith(`${term} `) || question.endsWith(` ${term}`)) {
        germanScore++;
      }
    });
    
    this.englishIndicators.forEach(term => {
      if (question.includes(` ${term} `) || question.startsWith(`${term} `) || question.endsWith(` ${term}`)) {
        englishScore++;
      }
    });
    
    // Check for German specific characters
    if (question.includes('ä') || question.includes('ö') || question.includes('ü') || question.includes('ß')) {
      germanScore += 3;
    }
    
    // Check for German legal terms
    if (question.includes('§') || question.includes('artikel')) {
      germanScore += 2;
    }
    
    return germanScore >= englishScore ? 'german' : 'english';
  }

  /* -------------------------------------------------
     Complexity assessment
  -------------------------------------------------- */
  assessComplexity(question, type, statute) {
    let complexity = 'medium'; // Default
    
    // Check for high complexity indicators
    for (const indicator of this.complexityIndicators.high) {
      if (question.includes(indicator)) {
        complexity = 'high';
        break;
      }
    }
    
    // Doctrine and system questions are high complexity
    if (type === 'DOCTRINE' || type === 'SYSTEM') {
      complexity = 'high';
    }
    
    // Constitutional law questions are high complexity
    if (statute === 'GG') {
      complexity = 'high';
    }
    
    // Check for low complexity indicators
    if (complexity !== 'high') {
      for (const indicator of this.complexityIndicators.low) {
        if (question.includes(indicator)) {
          complexity = 'low';
          break;
        }
      }
    }
    
    return complexity;
  }

  /* -------------------------------------------------
     Legal reference extraction
  -------------------------------------------------- */
  extractLegalReference(question) {
    const paragraphMatch = question.match(/§\s*(\d+[a-z]?)/i);
    const paragraph = paragraphMatch ? paragraphMatch[1] : null;
    
    const articleMatch = question.match(/(?:Artikel|Art\.|Article)\s*(\d+[a-z]?)/i);
    const article = articleMatch ? articleMatch[1] : null;
    
    const requestedReference = paragraph || article;
    const isArticle = !!article;
    
    // Determine statute from reference if possible
    let impliedStatute = null;
    if (requestedReference) {
      const num = parseInt(requestedReference, 10);
      
      if (!isNaN(num)) {
        // HGB range
        if (num >= 1 && num <= 372) {
          impliedStatute = 'HGB';
        }
        // BGB range
        else if (num >= 1 && num <= 2385) {
          impliedStatute = 'BGB';
        }
        // StGB range
        else if (num >= 1 && num <= 358) {
          impliedStatute = 'StGB';
        }
      }
    }
    
    return {
      paragraph,
      article,
      requestedReference,
      isArticle,
      impliedStatute,
      hasReference: !!requestedReference
    };
  }

  /* -------------------------------------------------
     Retrieval requirements
  -------------------------------------------------- */
  determineRetrievalRequirement(type, legalReference) {
    // Doctrine and system questions bypass retrieval
    if (type === 'DOCTRINE' || type === 'SYSTEM') {
      return false;
    }
    
    // Offense questions may use predefined mappings
    if (type === 'OFFENSE') {
      return false; // Will use offense mapping
    }
    
    // Normative questions require retrieval
    if (type === 'NORMATIVE') {
      return true;
    }
    
    // Questions with legal references require retrieval
    if (legalReference.hasReference) {
      return true;
    }
    
    // General legal questions require retrieval
    return true;
  }
  
  requiresExactReference(type, legalReference) {
    // Normative questions require exact reference matching
    if (type === 'NORMATIVE') {
      return true;
    }
    
    // Questions with specific references should match them
    if (legalReference.hasReference) {
      return true;
    }
    
    return false;
  }
  
  requiresCitation(type) {
    // Doctrine and system questions don't need paragraph citations
    if (type === 'DOCTRINE' || type === 'SYSTEM') {
      return false;
    }
    
    // All other legal questions should cite sources
    return true;
  }
  
  requiresStatuteLock(type, statute) {
    // If statute is already known, no need to lock
    if (statute) {
      return false;
    }
    
    // Normative questions require statute lock
    if (type === 'NORMATIVE') {
      return true;
    }
    
    // Offense questions need statute for mapping
    if (type === 'OFFENSE') {
      return true;
    }
    
    // General legal questions benefit from statute lock
    if (type === 'GENERAL' || type === 'DEFINITION' || type === 'COMPARISON' || type === 'PROCEDURAL') {
      return true;
    }
    
    return false;
  }

  /* -------------------------------------------------
     Detail generation
  -------------------------------------------------- */
  generateDetails(type, question, statute) {
    const details = {
      typeDescription: this.getTypeDescription(type),
      processingStrategy: this.getProcessingStrategy(type),
      expectedAnswerStructure: this.getExpectedAnswerStructure(type),
      qualityRequirements: this.getQualityRequirements(type)
    };
    
    // Add statute-specific details
    if (statute) {
      details.statuteContext = this.getStatuteContext(statute, type);
    }
    
    return details;
  }
  
  getTypeDescription(type) {
    const descriptions = {
      'DOCTRINE': 'Legal principle or doctrine explanation',
      'SYSTEM': 'Legal system classification question',
      'NORMATIVE': 'Question about specific legal norm (paragraph/article)',
      'OFFENSE': 'Criminal offense category question',
      'DEFINITION': 'Definition of legal term or concept',
      'COMPARISON': 'Comparison between legal concepts',
      'PROCEDURAL': 'Question about legal procedure',
      'GENERAL': 'General legal information question'
    };
    
    return descriptions[type] || 'Legal question';
  }
  
  getProcessingStrategy(type) {
    const strategies = {
      'DOCTRINE': 'Curated explanation, bypass retrieval',
      'SYSTEM': 'Curated system classification, bypass retrieval',
      'OFFENSE': 'Use offense mapping, minimal retrieval',
      'NORMATIVE': 'Exact reference retrieval within statute',
      'DEFINITION': 'Semantic retrieval within legal field',
      'COMPARISON': 'Multi-document retrieval and synthesis',
      'PROCEDURAL': 'Step-by-step retrieval with procedural chunks',
      'GENERAL': 'Semantic retrieval with field isolation'
    };
    
    return strategies[type] || 'Semantic retrieval';
  }
  
  getExpectedAnswerStructure(type) {
    const structures = {
      'DOCTRINE': 'Principle definition + constitutional basis + practical application',
      'SYSTEM': 'Classification + characteristics + comparison',
      'NORMATIVE': 'Exact norm + interpretation + legal consequences',
      'OFFENSE': 'Offense definition + statutory basis + penalties',
      'DEFINITION': 'Term definition + legal context + examples',
      'COMPARISON': 'Similarities + differences + practical implications',
      'PROCEDURAL': 'Steps + requirements + legal basis + timeline',
      'GENERAL': 'Answer + legal basis + citations'
    };
    
    return structures[type] || 'Structured legal answer';
  }
  
  getQualityRequirements(type) {
    const requirements = {
      'DOCTRINE': ['No false citations', 'Correct constitutional basis', 'Clear practical application'],
      'NORMATIVE': ['Exact paragraph match', 'Correct interpretation', 'Complete citation'],
      'OFFENSE': ['Correct statute mapping', 'Accurate penalty description', 'Clear offense elements'],
      'GENERAL': ['Statute-specific answer', 'Proper citations', 'Clear legal reasoning']
    };
    
    return requirements[type] || ['Accurate', 'Relevant', 'Well-cited'];
  }
  
  getStatuteContext(statute, type) {
    const contexts = {
      'StGB': 'German Criminal Code - Focus on offense elements and penalties',
      'BGB': 'German Civil Code - Focus on rights, obligations, and remedies',
      'HGB': 'German Commercial Code - Focus on merchants, companies, and trade',
      'GG': 'German Basic Law - Focus on fundamental rights and constitutional principles',
      'EU-GDPR': 'EU Data Protection Regulation - Focus on data privacy rights and obligations'
    };
    
    const context = contexts[statute] || 'Legal statute context';
    
    // Add type-specific focus
    if (type === 'NORMATIVE') {
      return `${context} - Exact norm interpretation required`;
    } else if (type === 'DEFINITION') {
      return `${context} - Term definition within statute`;
    }
    
    return context;
  }
}

module.exports = new QuestionClassifier();