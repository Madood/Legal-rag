// services/safetyCheck.js - ENHANCED FOR STATUTE-FIRST ARCHITECTURE

class SafetyCheck {
  constructor() {
    this.checks = [];
    console.log('✅ SafetyCheck initialized with STATUTE-FIRST validation');
  }

  async validateBeforeAnswer(question, ragResponse) {
    const warnings = [];
    const errors = [];
    const recommendations = [];
    
    // 1. Check architecture compliance
    if (!ragResponse.metadata?.architecture || ragResponse.metadata.architecture !== 'statute_first') {
      warnings.push('Antwort nicht mit Statute-First-Architektur generiert');
    }
    
    // 2. Check if statute was locked
    if (!ragResponse.metadata?.statuteLocked) {
      errors.push('Statute nicht gesperrt - Antwort könnte aus falschem Gesetz stammen');
    }
    
    // 3. Check if any chunks were used
    if (ragResponse.metadata?.chunksUsed === 0) {
      errors.push('Kein rechtlicher Text wurde gefunden. Antwort könnte generisch sein.');
    }
    
    // 4. Check confidence level
    if (ragResponse.confidence < 0.3) {
      warnings.push(`Niedrige Konfidenz (${(ragResponse.confidence * 100).toFixed(0)}%). Genauigkeit überprüfen.`);
      recommendations.push('Frage mit spezifischerer Gesetzesangabe wiederholen');
    }
    
    // 5. Check statute match with authority service
    const authority = require('./New/legalAuthorityService').lockStatute(question);
    if (authority.status === 'LOCKED' && ragResponse.metadata?.statute !== authority.statute) {
      errors.push(`Autoritätsauflösung (${authority.statute}) nicht mit Antwort-Statute (${ragResponse.metadata?.statute}) übereinstimmend`);
    }
    
    // 6. Check paragraph match if requested
    const paragraphInQuestion = this.extractParagraphFromQuestion(question);
    if (paragraphInQuestion && !ragResponse.metadata?.exactParagraphMatch) {
      warnings.push(`Angeforderter §${paragraphInQuestion} nicht exakt gefunden`);
      recommendations.push('Paragraphennummer im Kontext überprüfen');
    }
    
    // 7. Check for boilerplate contamination
    if (this.containsBoilerplate(ragResponse.answer)) {
      errors.push('Antwort enthält Boilerplate-Text');
      recommendations.push('Boilerplate-Filterung überprüfen');
    }
    
    // 8. Check answer structure
    const hasRule = ragResponse.answer.includes('**Regel:**') || ragResponse.answer.includes('**Rule:**');
    const hasMeaning = ragResponse.answer.includes('**Bedeutung:**') || ragResponse.answer.includes('**Meaning:**');
    
    if (!hasRule || !hasMeaning) {
      warnings.push('Antwortstruktur könnte unvollständig sein');
    }
    
    // 9. Check for hallucinations (basic)
    if (ragResponse.answer.includes('...') && ragResponse.answer.split('...').length > 3) {
      warnings.push('Antwort enthält möglicherweise unvollständige Informationen');
    }
    
    // 10. Check statute requirements
    if (ragResponse.metadata?.statute) {
      const statuteValidation = this.validateStatuteRequirements(
        ragResponse.metadata.statute,
        ragResponse.answer,
        ragResponse.metadata
      );
      
      if (!statuteValidation.isValid) {
        errors.push(...statuteValidation.errors);
        warnings.push(...statuteValidation.warnings);
      }
    }
    
    // Generate recommendations if none from above
    if (recommendations.length === 0 && (warnings.length > 0 || errors.length > 0)) {
      recommendations.push('Frage mit spezifischer Gesetzesangabe wiederholen');
      recommendations.push('Paragraphennummer angeben wenn bekannt');
    }
    
    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      score: this.calculateSafetyScore(warnings, errors, ragResponse.metadata),
      metadata: {
        architecture: ragResponse.metadata?.architecture || 'unknown',
        statuteLocked: ragResponse.metadata?.statuteLocked || false,
        authorityMatch: authority.status === 'LOCKED' && ragResponse.metadata?.statute === authority.statute
      }
    };
  }
  
  validateStatuteRequirements(statute, answer, metadata) {
    const errors = [];
    const warnings = [];
    
    const statuteRequirements = {
      'HGB': { requiresParagraph: true },
      'StGB': { requiresParagraph: true },
      'BGB': { requiresParagraph: true },
      'GG': { requiresArticle: true },
      'EU-GDPR': { requiresArticle: false }
    };
    
    const requirements = statuteRequirements[statute] || {};
    
    if (requirements.requiresParagraph && !answer.includes('§')) {
      warnings.push(`${statute} Antwort sollte Paragraphenreferenz enthalten`);
    }
    
    if (requirements.requiresArticle && !answer.match(/(?:Artikel|Art\.|Article)\s*\d+/)) {
      warnings.push(`${statute} Antwort sollte Artikelreferenz enthalten`);
    }
    
    // Check for statute name in answer
    const statuteNames = {
      'StGB': ['Strafgesetzbuch', 'StGB'],
      'BGB': ['Bürgerliches Gesetzbuch', 'BGB'],
      'HGB': ['Handelsgesetzbuch', 'HGB'],
      'GG': ['Grundgesetz', 'GG'],
      'EU-GDPR': ['Datenschutz-Grundverordnung', 'GDPR', 'DSGVO']
    };
    
    const names = statuteNames[statute] || [statute];
    const hasStatuteName = names.some(name => answer.includes(name));
    
    if (!hasStatuteName) {
      warnings.push(`Antwort erwähnt nicht das zuständige Gesetz (${statute})`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  extractStatuteFromQuestion(question) {
    const lower = question.toLowerCase();
    if (lower.includes('bgb') || lower.includes('bürgerliches gesetzbuch')) return 'BGB';
    if (lower.includes('hgb') || lower.includes('handelsgesetzbuch')) return 'HGB';
    if (lower.includes('stgb') || lower.includes('strafgesetzbuch')) return 'StGB';
    if (lower.includes('gg') || lower.includes('grundgesetz')) return 'GG';
    if (lower.includes('gdpr') || lower.includes('dsgvo')) return 'EU-GDPR';
    return null;
  }
  
  extractParagraphFromQuestion(question) {
    const match = question.match(/§\s*(\d+[a-z]?)/i);
    return match ? match[1] : null;
  }
  
  containsBoilerplate(text) {
    const boilerplateMarkers = [
      'service provided by',
      'bundesministerium der justiz',
      'official journal',
      'celex number',
      'reproduced',
      'ein service des',
      'Übersetzung',
      'Translation',
      'register notices'
    ];
    
    return boilerplateMarkers.some(marker => 
      text.toLowerCase().includes(marker)
    );
  }
  
  calculateSafetyScore(warnings, errors, metadata = {}) {
    let score = 100;
    
    // Base deductions
    score -= warnings.length * 10;
    score -= errors.length * 30;
    
    // Architecture bonuses/penalties
    if (metadata.architecture === 'statute_first') {
      score += 20;
    }
    
    if (metadata.statuteLocked) {
      score += 15;
    }
    
    // Confidence penalty
    if (metadata.confidence && metadata.confidence < 0.3) {
      score -= 20;
    } else if (metadata.confidence && metadata.confidence > 0.7) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  // Additional safety methods
  
  validateDocumentConsistency(documents) {
    const issues = [];
    
    documents.forEach((doc, index) => {
      if (!doc.metadata?.statute) {
        issues.push(`Dokument ${index + 1}: Kein Statute-Metadatum`);
      }
      
      if (!doc.chunks || doc.chunks.length === 0) {
        issues.push(`Dokument ${index + 1}: Keine Chunks vorhanden`);
      } else {
        const chunksWithoutEmbeddings = doc.chunks.filter(chunk => 
          !chunk.embeddings || chunk.embeddings.length === 0
        ).length;
        
        if (chunksWithoutEmbeddings > 0) {
          issues.push(`Dokument ${index + 1}: ${chunksWithoutEmbeddings} Chunks ohne Embeddings`);
        }
      }
      
      // Check for statute consistency in chunks
      const statute = doc.metadata?.statute;
      if (statute) {
        const statuteInChunks = doc.chunks?.some(chunk => 
          chunk.content && chunk.content.includes(statute)
        );
        
        if (!statuteInChunks) {
          issues.push(`Dokument ${index + 1}: Statute ${statute} nicht in Chunks gefunden`);
        }
      }
    });
    
    return {
      totalDocuments: documents.length,
      issues,
      isConsistent: issues.length === 0,
      statutes: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))]
    };
  }
  
  validateAuthorityResolution(questions = []) {
    const legalAuthorityService = require('./legalAuthorityService');
    const results = [];
    
    const testQuestions = questions.length > 0 ? questions : [
      "§ 15 HGB",
      "Artikel 5 GG",
      "Was regelt StGB § 242?",
      "Datenschutz nach GDPR",
      "Bürgerliches Gesetzbuch"
    ];
    
    testQuestions.forEach(question => {
      const authority = legalAuthorityService.lockStatute(question);
      results.push({
        question,
        authority,
        isValid: authority.status === 'LOCKED',
        expectedStatute: this.extractStatuteFromQuestion(question)
      });
    });
    
    const validCount = results.filter(r => r.isValid).length;
    
    return {
      total: results.length,
      valid: validCount,
      invalid: results.length - validCount,
      successRate: (validCount / results.length) * 100,
      results,
      status: validCount === results.length ? 'optimal' : validCount >= results.length * 0.7 ? 'acceptable' : 'needs_improvement'
    };
  }
  
  logSafetyEvent(eventType, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event: eventType,
      details,
      system: 'German-Legal-RAG',
      architecture: 'statute_first'
    };
    
    console.log(`🛡️  SAFETY LOG: ${timestamp} - ${eventType}`, {
      ...details,
      architecture: 'statute_first'
    });
    
    return logEntry;
  }
  
  // New: Validate cross-statute contamination
  validateCrossStatuteContamination(response, documents) {
    const statute = response.metadata?.statute;
    if (!statute) return { isValid: false, error: 'No statute in response' };
    
    const citations = response.citations || [];
    const foreignCitations = citations.filter(citation => 
      citation.statute && citation.statute !== statute
    );
    
    if (foreignCitations.length > 0) {
      return {
        isValid: false,
        error: `Cross-statute contamination: ${statute} answer cites ${foreignCitations.map(c => c.statute).join(', ')}`,
        foreignCitations,
        recommendation: 'Enable strict field isolation'
      };
    }
    
    return { isValid: true };
  }
  
  // New: Generate safety report
  generateSafetyReport(conversationHistory = []) {
    const totalQuestions = conversationHistory.length;
    const questionsWithAuthority = conversationHistory.filter(c => c.authority?.status === 'LOCKED').length;
    const questionsWithClarification = conversationHistory.filter(c => c.authority?.status !== 'LOCKED').length;
    
    const safetyScores = conversationHistory
      .map(c => c.safetyCheck?.score || 0)
      .filter(score => score > 0);
    
    const avgSafetyScore = safetyScores.length > 0 ? 
      safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length : 0;
    
    const confidences = conversationHistory
      .map(c => c.confidence || 0)
      .filter(confidence => confidence > 0);
    
    const avgConfidence = confidences.length > 0 ? 
      confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    
    // Statute distribution
    const statuteCounts = {};
    conversationHistory.forEach(c => {
      const statute = c.statute || c.authority?.statute;
      if (statute) {
        statuteCounts[statute] = (statuteCounts[statute] || 0) + 1;
      }
    });
    
    // Error and warning analysis
    const allErrors = conversationHistory.flatMap(c => c.safetyCheck?.errors || []);
    const allWarnings = conversationHistory.flatMap(c => c.safetyCheck?.warnings || []);
    
    const errorCategories = {};
    allErrors.forEach(error => {
      const category = this.categorizeError(error);
      errorCategories[category] = (errorCategories[category] || 0) + 1;
    });
    
    return {
      timestamp: new Date().toISOString(),
      architecture: 'statute_first',
      summary: {
        totalQuestions,
        questionsWithAuthority,
        questionsWithClarification,
        authorityLockRate: totalQuestions > 0 ? (questionsWithAuthority / totalQuestions) * 100 : 0,
        clarificationRate: totalQuestions > 0 ? (questionsWithClarification / totalQuestions) * 100 : 0
      },
      quality: {
        averageSafetyScore: Math.round(avgSafetyScore),
        averageConfidence: Math.round(avgConfidence * 100),
        highConfidenceQuestions: conversationHistory.filter(c => c.confidence > 0.7).length,
        lowConfidenceQuestions: conversationHistory.filter(c => c.confidence < 0.3).length,
        totalErrors: allErrors.length,
        totalWarnings: allWarnings.length
      },
      statutes: statuteCounts,
      errorAnalysis: errorCategories,
      recommendations: this.generateSystemRecommendations(
        totalQuestions,
        questionsWithAuthority,
        avgSafetyScore,
        statuteCounts,
        errorCategories
      )
    };
  }
  
  categorizeError(error) {
    if (error.includes('Statute') || error.includes('Gesetz')) return 'STATUTE_ERROR';
    if (error.includes('Paragraph') || error.includes('§')) return 'PARAGRAPH_ERROR';
    if (error.includes('Boilerplate')) return 'BOILERPLATE_ERROR';
    if (error.includes('Konfidenz') || error.includes('confidence')) return 'CONFIDENCE_ERROR';
    if (error.includes('Architektur') || error.includes('architecture')) return 'ARCHITECTURE_ERROR';
    if (error.includes('Text') || error.includes('content')) return 'CONTENT_ERROR';
    return 'OTHER_ERROR';
  }
  
  generateSystemRecommendations(totalQuestions, questionsWithAuthority, avgSafetyScore, statuteCounts, errorCategories) {
    const recommendations = [];
    
    if (totalQuestions > 0) {
      const authorityRate = (questionsWithAuthority / totalQuestions) * 100;
      
      if (authorityRate < 80) {
        recommendations.push({
          priority: 'HIGH',
          action: 'Improve authority resolution',
          description: 'Authority resolution rate niedrig. Trainingsfragen mit expliziten Gesetzesangaben verwenden.',
          metric: `${Math.round(authorityRate)}% authority lock rate`,
          target: '> 80%'
        });
      }
      
      if (avgSafetyScore < 70) {
        recommendations.push({
          priority: 'HIGH',
          action: 'Improve answer quality',
          description: 'Durchschnittliche Sicherheitsbewertung zu niedrig. Überprüfen Sie Boilerplate-Filter und Statute-Validierung.',
          metric: `${Math.round(avgSafetyScore)} safety score`,
          target: '> 70'
        });
      }
      
      // Analyze error categories
      if (errorCategories.STATUTE_ERROR > 5) {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'Enhance statute detection',
          description: 'Viele Statute-Fehler. Überprüfen Sie die Statute-Erkennungslogik in legalAuthorityService.',
          metric: `${errorCategories.STATUTE_ERROR} statute errors`,
          target: '< 3'
        });
      }
      
      if (errorCategories.BOILERPLATE_ERROR > 3) {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'Improve boilerplate filtering',
          description: 'Boilerplate-Kontamination in Antworten. Erweitern Sie die Boilerplate-Musterliste.',
          metric: `${errorCategories.BOILERPLATE_ERROR} boilerplate errors`,
          target: '0'
        });
      }
    }
    
    // Check statute coverage
    const expectedStatutes = ['StGB', 'BGB', 'HGB', 'GG', 'EU-GDPR'];
    const missingStatutes = expectedStatutes.filter(statute => !statuteCounts[statute]);
    
    if (missingStatutes.length > 0) {
      recommendations.push({
        priority: 'LOW',
        action: 'Expand statute coverage',
        description: `Fehlende Gesetze in Konversationen: ${missingStatutes.join(', ')}`,
        metric: `${missingStatutes.length} missing statutes`,
        target: 'All major statutes covered'
      });
    }
    
    // Default recommendation if no specific issues
    if (recommendations.length === 0 && totalQuestions > 10) {
      recommendations.push({
        priority: 'LOW',
        action: 'Maintain current architecture',
        description: 'System performt gut mit Statute-First-Architektur. Regelmäßige Überwachung fortsetzen.',
        metric: 'Good performance',
        target: 'Continued monitoring'
      });
    }
    
    return recommendations;
  }
  
  // New: Validate response against legal hierarchy
  validateLegalHierarchy(response, question) {
    const statute = response.metadata?.statute;
    if (!statute) return { isValid: false, error: 'No statute in response' };
    
    const legalAuthorityService = require('./legalAuthorityService');
    const hierarchy = legalAuthorityService.legalHierarchy || {};
    
    // Check if statute exists in hierarchy
    if (!hierarchy[statute]) {
      return {
        isValid: false,
        error: `Statute ${statute} not in legal hierarchy`,
        recommendation: 'Add statute to legal hierarchy'
      };
    }
    
    // For constitutional questions, ensure GG is used
    const lowerQuestion = question.toLowerCase();
    if ((lowerQuestion.includes('grundgesetz') || lowerQuestion.includes('constitution')) && statute !== 'GG') {
      return {
        isValid: false,
        error: 'Constitutional question answered by non-constitutional statute',
        expected: 'GG',
        actual: statute,
        recommendation: 'Force GG for constitutional questions'
      };
    }
    
    return {
      isValid: true,
      hierarchyRank: hierarchy[statute],
      statute: statute
    };
  }
  
  // New: Monitor system performance
  monitorPerformance(metrics) {
    const {
      processingTime,
      chunkCount,
      documentCount,
      confidence,
      safetyScore,
      architecture
    } = metrics;
    
    const performance = {
      timestamp: new Date().toISOString(),
      processingTime: {
        value: processingTime,
        status: processingTime < 2000 ? 'good' : processingTime < 5000 ? 'acceptable' : 'slow'
      },
      resources: {
        chunksProcessed: chunkCount,
        documentsUsed: documentCount,
        status: chunkCount > 0 && documentCount > 0 ? 'good' : 'insufficient'
      },
      quality: {
        confidence: confidence * 100,
        safetyScore: safetyScore,
        status: confidence > 0.5 && safetyScore > 70 ? 'good' : 'needs_attention'
      },
      architecture: architecture || 'unknown'
    };
    
    // Log performance issues
    if (performance.processingTime.status === 'slow') {
      this.logSafetyEvent('PERFORMANCE_WARNING', {
        message: 'Processing time slow',
        processingTime,
        recommendation: 'Optimize embedding generation or chunk size'
      });
    }
    
    if (performance.resources.status === 'insufficient') {
      this.logSafetyEvent('RESOURCE_WARNING', {
        message: 'Insufficient resources for answer',
        chunkCount,
        documentCount,
        recommendation: 'Load more documents or check chunk generation'
      });
    }
    
    if (performance.quality.status === 'needs_attention') {
      this.logSafetyEvent('QUALITY_WARNING', {
        message: 'Answer quality needs attention',
        confidence: confidence * 100,
        safetyScore,
        recommendation: 'Review question classification or retrieval parameters'
      });
    }
    
    return performance;
  }
}

module.exports = new SafetyCheck();