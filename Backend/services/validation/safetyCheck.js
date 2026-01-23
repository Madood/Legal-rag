// services/validation/safetyCheck.js - LEGAL ASSURANCE LAYER
// ⭐⭐ ENHANCED: From Validation to Legal Epistemology & Examiner Expectations

class SafetyCheck {
  constructor() {
    this.checks = [];
    this.initializeLegalMethodology();
    console.log('✅ SafetyCheck initialized (Legal Epistemology Layer)');
  }

  /**
   * Initialize German legal methodology framework
   */
  initializeLegalMethodology() {
    // Legal Severity Levels
    this.LEGAL_SEVERITY = {
      CRITICAL: {
        code: 'CRITICAL',
        weight: 30,
        description: 'Substantive legal error or doctrinal contradiction',
        examples: [
          'Mixing criminal and civil law principles',
          'Claiming unlimited ownership (contradicts § 903 Satz 2 BGB)',
          'Ignoring constitutional hierarchy (GG > BGB)'
        ]
      },
      MAJOR: {
        code: 'MAJOR',
        weight: 15,
        description: 'Incomplete but fundamentally correct legal reasoning',
        examples: [
          'Missing essential legal principle (e.g., Schuldprinzip in criminal law)',
          'Omitted mandatory doctrinal limitation',
          'Incomplete systematic positioning'
        ]
      },
      MINOR: {
        code: 'MINOR',
        weight: 5,
        description: 'Formal or presentational issues',
        examples: [
          'Missing citation format',
          'Incomplete source attribution',
          'Minor structural inconsistency'
        ]
      }
    };

    // Examiner Tolerance Zones by Domain
    this.EXAMINER_TOLERANCE = {
      property: {
        mandatoryConcepts: [
          'Schranken des Eigentums',
          'Differenzierung Eigentum/Besitz',
          'Systematik Sachenrecht'
        ],
        toleranceForIncompleteness: 'MEDIUM',
        requiredHierarchy: ['GG Art. 14', 'BGB Buch 3', 'Spezialgesetze']
      },
      contract: {
        mandatoryConcepts: [
          'Vertragsfreiheit + Grenzen',
          'Prinzip von Treu und Glauben (§ 242 BGB)',
          'Leistungsstörungen'
        ],
        toleranceForIncompleteness: 'HIGH',
        requiredHierarchy: ['GG Art. 2', 'BGB Buch 2', 'AGB-Recht']
      },
      criminal: {
        mandatoryConcepts: [
          'Schuldprinzip',
          'Legalitätsprinzip (Art. 103 Abs. 2 GG)',
          'Verhältnismäßigkeit der Strafe'
        ],
        toleranceForIncompleteness: 'LOW',
        requiredHierarchy: ['GG', 'StGB', 'StPO']
      },
      tort: {
        mandatoryConcepts: [
          'Verschuldensprinzip',
          'Kausalität',
          'Schadensersatzfunktionen'
        ],
        toleranceForIncompleteness: 'MEDIUM',
        requiredHierarchy: ['BGB §§ 823 ff.', 'Haftungsprivilegien']
      },
      constitutional: {
        mandatoryConcepts: [
          'Verhältnismäßigkeitsprüfung',
          'Wesensgehaltsgarantie (Art. 19 Abs. 2 GG)',
          'Grundrechtsdogmatik'
        ],
        toleranceForIncompleteness: 'VERY_LOW',
        requiredHierarchy: ['GG', 'Europarecht', 'Bundesrecht', 'Landesrecht']
      }
    };

    // Legal Source Hierarchy (German Law)
    this.LEGAL_HIERARCHY = [
      { level: 0, source: 'GG', description: 'Verfassungsrecht (höchste Rangstufe)' },
      { level: 1, source: 'EU-Recht', description: 'Vorrang vor nationalem Recht (Art. 23 GG)' },
      { level: 2, source: 'Bundesgesetze', description: 'Formelle Gesetze des Bundes' },
      { level: 3, source: 'Landesgesetze', description: 'Gesetze der Bundesländer' },
      { level: 4, source: 'Rechtsverordnungen', description: 'Verordnungsrecht' },
      { level: 5, source: 'Rechtsprechung', description: 'Judikative Auslegung' },
      { level: 6, source: 'Wissenschaft', description: 'Juristische Literatur' }
    ];
  }

  /**
   * Main validation with legal epistemology awareness
   */
  async validateBeforeAnswer(question, ragResponse, authority = null) {
    const doctrinalNotes = [];
    const methodologicalLimits = [];
    const authorityConstraints = [];
    const legalSeverities = [];

    // 1. Determine legal domain
    const legalDomain = this.detectLegalDomain(question, authority);
    
    // 2. Check examiner expectations for this domain
    const domainExpectations = this.checkDomainExpectations(legalDomain, ragResponse.answer);
    doctrinalNotes.push(...domainExpectations.notes);
    if (domainExpectations.severity) {
      legalSeverities.push(domainExpectations.severity);
    }

    // 3. Validate hierarchy awareness
    const hierarchyValidation = this.validateLegalHierarchy(ragResponse.answer, legalDomain);
    doctrinalNotes.push(...hierarchyValidation.notes);
    if (hierarchyValidation.severity) {
      legalSeverities.push(hierarchyValidation.severity);
    }

    // 4. Distinguish INCOMPLETE vs INCORRECT
    const correctnessAnalysis = this.analyzeLegalCorrectness(ragResponse.answer, legalDomain, authority);
    doctrinalNotes.push(...correctnessAnalysis.doctrinalNotes);
    methodologicalLimits.push(...correctnessAnalysis.methodologicalLimits);
    legalSeverities.push(...correctnessAnalysis.severities);

    // 5. Assess examiner tolerance
    const toleranceAssessment = this.assessExaminerTolerance(
      legalDomain,
      ragResponse.answer,
      ragResponse.confidence,
      authority?.authority_mode
    );
    doctrinalNotes.push(...toleranceAssessment.notes);

    // 6. Basic technical checks (existing logic)
    const technicalValidation = this.performTechnicalChecks(question, ragResponse, authority);
    methodologicalLimits.push(...technicalValidation.methodologicalLimits);
    authorityConstraints.push(...technicalValidation.authorityConstraints);

    // 7. Calculate risk profiles
    const riskProfile = this.calculateRiskProfiles(
      doctrinalNotes,
      methodologicalLimits,
      authorityConstraints,
      legalSeverities,
      authority
    );

    // 8. Generate legal assurance assessment
    const legalAssurance = this.generateLegalAssurance(
      riskProfile,
      legalDomain,
      ragResponse.confidence,
      authority
    );

    return {
      ...legalAssurance,
      metadata: {
        legalDomain,
        legalMethodology: 'german_civil_law',
        architecture: 'doctrinal_templates_v2',
        examinerExpectations: this.EXAMINER_TOLERANCE[legalDomain]?.mandatoryConcepts || [],
        doctrinalCoverage: this.calculateDoctrinalCoverage(ragResponse.answer, legalDomain)
      }
    };
  }

  /**
   * Detect legal domain with German methodology
   */
  detectLegalDomain(question, authority) {
    // Priority 1: Authority-based detection
    if (authority?.statute) {
      switch (authority.statute) {
        case 'BGB':
          if (authority.paragraph >= 903 && authority.paragraph <= 1011) return 'property';
          if (authority.paragraph >= 433 && authority.paragraph <= 534) return 'contract';
          if (authority.paragraph >= 823 && authority.paragraph <= 853) return 'tort';
          return 'civil';
        case 'StGB':
          return 'criminal';
        case 'GG':
          return 'constitutional';
        case 'HGB':
          return 'commercial';
        default:
          return 'general';
      }
    }

    // Priority 2: Content-based detection
    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes('eigentum') || lowerQuestion.includes('besitz') || lowerQuestion.includes('sachenrecht')) {
      return 'property';
    }
    if (lowerQuestion.includes('vertrag') || lowerQuestion.includes('schuldrecht')) {
      return 'contract';
    }
    if (lowerQuestion.includes('straf') || lowerQuestion.includes('stgb')) {
      return 'criminal';
    }
    if (lowerQuestion.includes('grundgesetz') || lowerQuestion.includes('grundrecht')) {
      return 'constitutional';
    }
    if (lowerQuestion.includes('delikt') || lowerQuestion.includes('haftung')) {
      return 'tort';
    }

    return 'general';
  }

  /**
   * Check domain-specific examiner expectations
   */
  checkDomainExpectations(domain, answer) {
    const expectations = this.EXAMINER_TOLERANCE[domain];
    if (!expectations) return { notes: [], severity: null };

    const notes = [];
    let severity = null;

    // Check each mandatory concept
    expectations.mandatoryConcepts.forEach(concept => {
      if (!answer.includes(concept)) {
        const note = `Domain "${domain}" expected to mention: ${concept}`;
        notes.push(note);
        
        // Determine severity based on concept importance
        if (concept.includes('Schranken') || concept.includes('Prinzip')) {
          severity = this.LEGAL_SEVERITY.MAJOR;
        }
      }
    });

    // Check hierarchy awareness
    expectations.requiredHierarchy.forEach(hierarchyElement => {
      if (domain === 'constitutional' && !answer.includes('GG')) {
        notes.push('Constitutional discussion must reference Grundgesetz hierarchy');
        severity = this.LEGAL_SEVERITY.CRITICAL;
      }
    });

    return { notes, severity };
  }

  /**
   * Validate legal hierarchy awareness
   */
  validateLegalHierarchy(answer, domain) {
    const notes = [];
    let severity = null;

    // Check if answer acknowledges legal hierarchy
    const hasHierarchyAwareness = this.LEGAL_HIERARCHY.some(level => 
      answer.includes(level.source) || answer.includes(level.description)
    );

    if (!hasHierarchyAwareness) {
      notes.push('Answer lacks explicit legal hierarchy awareness');
      if (domain === 'constitutional') {
        severity = this.LEGAL_SEVERITY.MAJOR;
      }
    }

    // Detect hierarchy violations
    const lowerAnswer = answer.toLowerCase();
    if (lowerAnswer.includes('bgb') && lowerAnswer.includes('stgb') && !lowerAnswer.includes('unterschied')) {
      notes.push('Civil and criminal law mentioned without clear differentiation');
      severity = this.LEGAL_SEVERITY.CRITICAL;
    }

    return { notes, severity };
  }

  /**
   * Distinguish INCOMPLETE vs INCORRECT
   */
  analyzeLegalCorrectness(answer, domain, authority) {
    const doctrinalNotes = [];
    const methodologicalLimits = [];
    const severities = [];

    // Analyze completeness
    const completenessScore = this.assessCompleteness(answer, domain);
    if (completenessScore < 0.7) {
      doctrinalNotes.push(`Answer is incomplete for ${domain} domain (coverage: ${(completenessScore * 100).toFixed(0)}%)`);
      severities.push(this.LEGAL_SEVERITY.MAJOR);
    }

    // Detect incorrect statements
    const incorrectStatements = this.detectLegalIncorrectness(answer, domain);
    if (incorrectStatements.length > 0) {
      doctrinalNotes.push(...incorrectStatements);
      severities.push(this.LEGAL_SEVERITY.CRITICAL);
    }

    // Check if answer confuses conceptual levels
    const conceptualClarity = this.assessConceptualClarity(answer, domain);
    if (!conceptualClarity.isClear) {
      methodologicalLimits.push(conceptualClarity.issue);
      if (conceptualClarity.severity === 'critical') {
        severities.push(this.LEGAL_SEVERITY.CRITICAL);
      }
    }

    return { doctrinalNotes, methodologicalLimits, severities };
  }

  /**
   * Assess examiner tolerance based on domain and authority mode
   */
  assessExaminerTolerance(domain, answer, confidence, authorityMode) {
    const notes = [];
    const tolerance = this.EXAMINER_TOLERANCE[domain]?.toleranceForIncompleteness || 'MEDIUM';

    // Adjust tolerance based on authority mode
    let effectiveTolerance = tolerance;
    if (authorityMode === 'exact') {
      effectiveTolerance = 'LOW'; // Exact mode demands precision
    } else if (authorityMode === 'none') {
      effectiveTolerance = 'HIGH'; // Conceptual questions allow more leeway
    }

    // Apply tolerance rules
    const wordCount = answer.split(/\s+/).length;
    const normCount = (answer.match(/§/g) || []).length;

    if (effectiveTolerance === 'LOW' && normCount === 0) {
      notes.push('Low tolerance mode requires explicit legal references');
    }

    if (effectiveTolerance === 'VERY_LOW' && wordCount < 100) {
      notes.push('Very low tolerance for brevity in this domain');
    }

    return { notes, effectiveTolerance };
  }

  /**
   * Perform technical checks (existing logic adapted)
   */
  performTechnicalChecks(question, ragResponse, authority) {
    const methodologicalLimits = [];
    const authorityConstraints = [];

    // Basic validation
    if (!ragResponse.answer || ragResponse.answer.trim().length < 10) {
      methodologicalLimits.push('ANSWER_TOO_SHORT');
    }

    // Authority mode awareness
    if (authority?.authority_mode === 'none' && ragResponse.confidence > 0.7) {
      methodologicalLimits.push('High confidence without statute may indicate overclaiming');
    }

    // Check Python integration
    if (!ragResponse.metadata?.python_service_used) {
      authorityConstraints.push('Authority validation bypassed (Python service not used)');
    }

    return { methodologicalLimits, authorityConstraints };
  }

  /**
   * Calculate risk profiles
   */
  calculateRiskProfiles(doctrinalNotes, methodologicalLimits, authorityConstraints, legalSeverities, authority) {
    // Calculate doctrinal risk
    const doctrinalRisk = legalSeverities.reduce((sum, severity) => 
      sum + severity.weight, 0
    );

    // Calculate methodological risk
    const methodologicalRisk = methodologicalLimits.length * 5;

    // Calculate authority risk
    let authorityRisk = 0;
    if (authority?.authority_mode === 'none') authorityRisk += 10;
    if (authorityConstraints.length > 0) authorityRisk += authorityConstraints.length * 7;

    // Determine overall risk level
    const totalRisk = doctrinalRisk + methodologicalRisk + authorityRisk;
    let riskLevel = 'LOW';
    if (totalRisk > 30) riskLevel = 'MEDIUM';
    if (totalRisk > 60) riskLevel = 'HIGH';
    if (totalRisk > 90) riskLevel = 'CRITICAL';

    return {
      doctrinalRisk: {
        score: doctrinalRisk,
        level: doctrinalRisk > 20 ? 'HIGH' : doctrinalRisk > 10 ? 'MEDIUM' : 'LOW',
        notes: doctrinalNotes
      },
      methodologicalRisk: {
        score: methodologicalRisk,
        level: methodologicalRisk > 15 ? 'HIGH' : methodologicalRisk > 5 ? 'MEDIUM' : 'LOW',
        limits: methodologicalLimits
      },
      authorityRisk: {
        score: authorityRisk,
        level: authorityRisk > 15 ? 'HIGH' : authorityRisk > 5 ? 'MEDIUM' : 'LOW',
        constraints: authorityConstraints
      },
      overallRisk: {
        score: totalRisk,
        level: riskLevel,
        severityBreakdown: legalSeverities.map(s => s.code)
      }
    };
  }

  /**
   * Generate comprehensive legal assurance
   */
  generateLegalAssurance(riskProfile, legalDomain, confidence, authority) {
    const isAcceptable = riskProfile.overallRisk.level !== 'CRITICAL';
    
    // Determine legal defensibility
    let legalDefensibility = 'HIGH';
    if (riskProfile.doctrinalRisk.level === 'HIGH') legalDefensibility = 'MEDIUM';
    if (riskProfile.doctrinalRisk.level === 'HIGH' && riskProfile.authorityRisk.level === 'HIGH') {
      legalDefensibility = 'LOW';
    }

    // Generate recommendations
    const recommendations = this.generateLegalRecommendations(riskProfile, legalDomain);

    return {
      isLegallySound: isAcceptable,
      legalDefensibility,
      confidenceAdjusted: this.adjustConfidenceForLegalRisk(confidence, riskProfile),
      riskProfile,
      doctrinalAssessment: {
        domain: legalDomain,
        completeness: this.assessDoctrinalCompleteness(riskProfile),
        correctness: riskProfile.doctrinalRisk.level === 'LOW' ? 'HIGH' : 'MEDIUM'
      },
      examinerReadiness: this.assessExaminerReadiness(riskProfile, authority),
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Assess doctrinal completeness
   */
  assessDoctrinalCompleteness(riskProfile) {
    const { doctrinalRisk, methodologicalRisk } = riskProfile;
    
    if (doctrinalRisk.level === 'LOW' && methodologicalRisk.level === 'LOW') {
      return 'COMPREHENSIVE';
    } else if (doctrinalRisk.level === 'MEDIUM' || methodologicalRisk.level === 'MEDIUM') {
      return 'ADEQUATE';
    } else {
      return 'PARTIAL';
    }
  }

  /**
   * Assess readiness for examiner scrutiny
   */
  assessExaminerReadiness(riskProfile, authority) {
    const { doctrinalRisk, authorityRisk, overallRisk } = riskProfile;
    
    // Critical factors for examiners
    const criticalFactors = [];
    if (doctrinalRisk.notes.some(note => note.includes('hierarchy'))) {
      criticalFactors.push('HIERARCHY_VIOLATION');
    }
    if (doctrinalRisk.notes.some(note => note.includes('Schranken') && !note.includes('mentioned'))) {
      criticalFactors.push('MISSING_LIMITATIONS');
    }
    if (authority?.authority_mode === 'none' && authorityRisk.level === 'HIGH') {
      criticalFactors.push('NO_LEGAL_BASIS');
    }

    if (criticalFactors.length > 0 || overallRisk.level === 'CRITICAL') {
      return 'NOT_READY';
    } else if (overallRisk.level === 'HIGH' || criticalFactors.length > 1) {
      return 'NEEDS_REVIEW';
    } else if (overallRisk.level === 'MEDIUM') {
      return 'ACCEPTABLE';
    } else {
      return 'EXAMINER_READY';
    }
  }

  /**
   * Generate legal recommendations
   */
  generateLegalRecommendations(riskProfile, legalDomain) {
    const recommendations = [];
    const { doctrinalRisk, methodologicalRisk, authorityRisk } = riskProfile;

    // Doctrinal recommendations
    if (doctrinalRisk.level === 'MEDIUM' || doctrinalRisk.level === 'HIGH') {
      recommendations.push({
        category: 'DOCTRINAL',
        priority: doctrinalRisk.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
        action: 'Strengthen legal reasoning structure',
        details: `Address: ${doctrinalRisk.notes.slice(0, 2).join(', ')}`
      });
    }

    // Domain-specific recommendations
    const expectations = this.EXAMINER_TOLERANCE[legalDomain];
    if (expectations) {
      recommendations.push({
        category: 'DOMAIN_EXPECTATIONS',
        priority: 'MEDIUM',
        action: 'Ensure coverage of mandatory concepts',
        details: `Expected: ${expectations.mandatoryConcepts.slice(0, 2).join(', ')}`
      });
    }

    // Authority recommendations
    if (authorityRisk.level === 'HIGH') {
      recommendations.push({
        category: 'AUTHORITY',
        priority: 'HIGH',
        action: 'Improve legal foundation',
        details: 'Specify exact statute and paragraph for authoritative answer'
      });
    }

    return recommendations;
  }

  /**
   * Adjust confidence based on legal risk
   */
  adjustConfidenceForLegalRisk(confidence, riskProfile) {
    let adjusted = confidence;
    
    // Reduce confidence based on doctrinal risk
    if (riskProfile.doctrinalRisk.level === 'HIGH') adjusted *= 0.6;
    else if (riskProfile.doctrinalRisk.level === 'MEDIUM') adjusted *= 0.8;
    
    // Further reduction for authority risk
    if (riskProfile.authorityRisk.level === 'HIGH') adjusted *= 0.7;
    else if (riskProfile.authorityRisk.level === 'MEDIUM') adjusted *= 0.9;
    
    // Ensure not below minimum
    return Math.max(0.1, Math.min(1.0, adjusted));
  }

  /**
   * Helper methods
   */
  assessCompleteness(answer, domain) {
    const expectations = this.EXAMINER_TOLERANCE[domain];
    if (!expectations) return 0.5;
    
    const mandatoryConcepts = expectations.mandatoryConcepts;
    const foundCount = mandatoryConcepts.filter(concept => 
      answer.toLowerCase().includes(concept.toLowerCase())
    ).length;
    
    return mandatoryConcepts.length > 0 ? foundCount / mandatoryConcepts.length : 0.5;
  }

  detectLegalIncorrectness(answer, domain) {
    const incorrectStatements = [];
    const lowerAnswer = answer.toLowerCase();
    
    // Domain-specific incorrect patterns
    const incorrectPatterns = {
      property: [
        { pattern: 'eigentum ist unbeschränkt', correction: 'Eigentum unterliegt Schranken (§ 903 Satz 2 BGB)' },
        { pattern: 'besitz ist eigentum', correction: 'Besitz ≠ Eigentum (§ 854 vs § 903 BGB)' }
      ],
      criminal: [
        { pattern: 'strafrecht ohne schuld', correction: 'Strafrecht folgt dem Schuldprinzip' },
        { pattern: 'strafe ohne gesetzliche grundlage', correction: 'nulla poena sine lege (Art. 103 Abs. 2 GG)' }
      ],
      constitutional: [
        { pattern: 'grundrechte sind schrankenlos', correction: 'Grundrechte unterliegen der verfassungsmäßigen Ordnung' }
      ]
    };
    
    const patterns = incorrectPatterns[domain] || [];
    patterns.forEach(({ pattern, correction }) => {
      if (lowerAnswer.includes(pattern)) {
        incorrectStatements.push(`Legally incorrect: "${pattern}" - Correct: ${correction}`);
      }
    });
    
    return incorrectStatements;
  }

  assessConceptualClarity(answer, domain) {
    const lowerAnswer = answer.toLowerCase();
    
    // Check for conceptual confusion
    if (domain === 'property' && lowerAnswer.includes('besitz') && lowerAnswer.includes('eigentum')) {
      const hasClarification = lowerAnswer.includes('unterschied') || lowerAnswer.includes('verschieden');
      if (!hasClarification) {
        return {
          isClear: false,
          issue: 'Distinction between Besitz and Eigentum not clearly articulated',
          severity: 'medium'
        };
      }
    }
    
    if (domain === 'contract' && lowerAnswer.includes('willenserklärung')) {
      const hasElements = lowerAnswer.includes('handlung') && lowerAnswer.includes('erfolg') && lowerAnswer.includes('bewusstsein');
      if (!hasElements) {
        return {
          isClear: false,
          issue: 'Willenserklärung elements incomplete',
          severity: 'low'
        };
      }
    }
    
    return { isClear: true, issue: null, severity: null };
  }

  calculateDoctrinalCoverage(answer, domain) {
    const coverage = {
      legalPrinciples: 0,
      normReferences: 0,
      systematicPositioning: 0,
      limitationsAcknowledged: 0
    };
    
    const lowerAnswer = answer.toLowerCase();
    
    // Count legal principles
    if (lowerAnswer.includes('prinzip') || lowerAnswer.includes('grundsatz')) coverage.legalPrinciples++;
    
    // Count norm references
    coverage.normReferences = (lowerAnswer.match(/§/g) || []).length;
    
    // Check systematic positioning
    if (domain === 'property' && lowerAnswer.includes('sachenrecht')) coverage.systematicPositioning = 1;
    if (domain === 'contract' && lowerAnswer.includes('schuldrecht')) coverage.systematicPositioning = 1;
    
    // Check limitations
    if (lowerAnswer.includes('schranken') || lowerAnswer.includes('grenzen') || lowerAnswer.includes('beschränkung')) {
      coverage.limitationsAcknowledged = 1;
    }
    
    return coverage;
  }

  // Existing methods (adapted for new terminology)
  logSafetyEvent(eventType, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event: eventType,
      details,
      system: 'German-Legal-RAG',
      architecture: 'legal_epistemology_layer',
      methodology: 'german_civil_law'
    };
    
    console.log(`⚖️  LEGAL ASSURANCE: ${timestamp} - ${eventType}`, details);
    
    return logEntry;
  }

  validateDocumentConsistency(documents) {
    const issues = [];
    
    documents.forEach((doc, index) => {
      if (!doc.chunks || doc.chunks.length === 0) {
        issues.push(`Document ${index + 1}: No chunks available`);
      }
      
      // Basic content check
      if (!doc.content || doc.content.length < 50) {
        issues.push(`Document ${index + 1}: Content too short or missing`);
      }
    });
    
    return {
      totalDocuments: documents.length,
      issues,
      isConsistent: issues.length === 0,
      statutes: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))],
      legalDomains: this.extractLegalDomains(documents)
    };
  }

  extractLegalDomains(documents) {
    const domains = new Set();
    documents.forEach(doc => {
      if (doc.metadata?.statute) {
        const statute = doc.metadata.statute;
        if (statute === 'BGB') domains.add('civil');
        if (statute === 'StGB') domains.add('criminal');
        if (statute === 'GG') domains.add('constitutional');
        if (statute === 'HGB') domains.add('commercial');
      }
    });
    return Array.from(domains);
  }

  /**
   * Generate comprehensive legal methodology report
   */
  generateLegalMethodologyReport(conversationHistory = []) {
    const report = {
      timestamp: new Date().toISOString(),
      methodologyFramework: 'German Civil Law Epistemology',
      assessmentCriteria: Object.keys(this.LEGAL_SEVERITY).map(key => ({
        level: key,
        ...this.LEGAL_SEVERITY[key]
      })),
      domainExpectations: Object.entries(this.EXAMINER_TOLERANCE).map(([domain, config]) => ({
        domain,
        mandatoryConcepts: config.mandatoryConcepts,
        tolerance: config.toleranceForIncompleteness
      })),
      performanceAnalysis: this.analyzeLegalPerformance(conversationHistory),
      institutionalReadiness: this.assessInstitutionalReadiness(conversationHistory)
    };
    
    return report;
  }

  analyzeLegalPerformance(conversationHistory) {
    const legalDomains = new Set();
    const severityCounts = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
    const domainPerformance = {};
    
    conversationHistory.forEach(entry => {
      const domain = entry.safetyCheck?.metadata?.legalDomain || 'unknown';
      legalDomains.add(domain);
      
      // Count severities
      const safetyCheck = entry.safetyCheck;
      if (safetyCheck?.riskProfile?.overallRisk?.severityBreakdown) {
        safetyCheck.riskProfile.overallRisk.severityBreakdown.forEach(severity => {
          severityCounts[severity] = (severityCounts[severity] || 0) + 1;
        });
      }
      
      // Track domain performance
      if (!domainPerformance[domain]) {
        domainPerformance[domain] = {
          count: 0,
          avgConfidence: 0,
          avgLegalDefensibility: 0
        };
      }
      
      domainPerformance[domain].count++;
      domainPerformance[domain].avgConfidence += entry.confidence || 0;
      domainPerformance[domain].avgLegalDefensibility += 
        safetyCheck?.legalDefensibility === 'HIGH' ? 1 : 
        safetyCheck?.legalDefensibility === 'MEDIUM' ? 0.5 : 0;
    });
    
    // Calculate averages
    Object.keys(domainPerformance).forEach(domain => {
      const perf = domainPerformance[domain];
      perf.avgConfidence = perf.count > 0 ? (perf.avgConfidence / perf.count) : 0;
      perf.avgLegalDefensibility = perf.count > 0 ? (perf.avgLegalDefensibility / perf.count) : 0;
    });
    
    return {
      domainsCovered: Array.from(legalDomains),
      severityDistribution: severityCounts,
      domainPerformance,
      overallLegalSoundness: conversationHistory.filter(
        c => c.safetyCheck?.isLegallySound
      ).length / Math.max(1, conversationHistory.length)
    };
  }

  assessInstitutionalReadiness(conversationHistory) {
    const criticalSeverityCount = conversationHistory.filter(
      c => c.safetyCheck?.riskProfile?.overallRisk?.severityBreakdown?.includes('CRITICAL')
    ).length;
    
    const highDefensibilityCount = conversationHistory.filter(
      c => c.safetyCheck?.legalDefensibility === 'HIGH'
    ).length;
    
    const examinerReadyCount = conversationHistory.filter(
      c => c.safetyCheck?.examinerReadiness === 'EXAMINER_READY'
    ).length;
    
    const total = conversationHistory.length;
    
    const readinessScores = {
      criticalIssueRate: total > 0 ? criticalSeverityCount / total : 0,
      highDefensibilityRate: total > 0 ? highDefensibilityCount / total : 0,
      examinerReadyRate: total > 0 ? examinerReadyCount / total : 0
    };
    
    let institutionalRating = 'PROTOTYPE';
    if (readinessScores.criticalIssueRate < 0.1 && 
        readinessScores.highDefensibilityRate > 0.8 &&
        readinessScores.examinerReadyRate > 0.7) {
      institutionalRating = 'PRODUCTION_READY';
    } else if (readinessScores.criticalIssueRate < 0.2 &&
               readinessScores.highDefensibilityRate > 0.6) {
      institutionalRating = 'BETA';
    }
    
    return {
      readinessScores,
      institutionalRating,
      recommendations: this.generateInstitutionalRecommendations(readinessScores)
    };
  }

  generateInstitutionalRecommendations(readinessScores) {
    const recommendations = [];
    
    if (readinessScores.criticalIssueRate > 0.1) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Reduce critical legal errors',
        target: 'Critical issue rate < 10%',
        current: `${(readinessScores.criticalIssueRate * 100).toFixed(1)}%`
      });
    }
    
    if (readinessScores.highDefensibilityRate < 0.8) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Improve legal defensibility',
        target: 'High defensibility rate > 80%',
        current: `${(readinessScores.highDefensibilityRate * 100).toFixed(1)}%`
      });
    }
    
    if (readinessScores.examinerReadyRate < 0.7) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Enhance examiner readiness',
        target: 'Examiner ready rate > 70%',
        current: `${(readinessScores.examinerReadyRate * 100).toFixed(1)}%`
      });
    }
    
    return recommendations;
  }
}

module.exports = new SafetyCheck();