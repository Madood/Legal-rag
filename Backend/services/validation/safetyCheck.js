// services/validation/safetyCheck.js - UPDATED VERSION
// ⭐⭐ FIXED: Authority resolution moved to Python - simplified safety check

class SafetyCheck {
  constructor() {
    this.checks = [];
    console.log('✅ SafetyCheck initialized (simplified - authority moved to Python)');
  }

  async validateBeforeAnswer(question, ragResponse, authority = null) {
    const warnings = [];
    const errors = [];
    const recommendations = [];
    
    // 1. Basic question validation
    if (!question || question.trim().length < 3) {
      errors.push('QUESTION_TOO_SHORT');
    }
    
    if (question.length > 1000) {
      errors.push('QUESTION_TOO_LONG');
    }
    
    // 2. Check answer content
    if (!ragResponse.answer || ragResponse.answer.trim().length < 10) {
      errors.push('ANSWER_TOO_SHORT');
      return {
        isValid: false,
        score: 10,
        errors,
        warnings,
        recommendations: ['Generate more complete answer']
      };
    }
    
    // 3. Check architecture compliance
    if (!ragResponse.metadata?.architecture || ragResponse.metadata.architecture !== 'authority_python') {
      warnings.push('Answer not generated with authority-python architecture');
    }
    
    // 4. Check for Python service usage
    if (ragResponse.metadata?.python_used) {
      // Python was used - this is good
      if (ragResponse.metadata?.python_authoritative_found) {
        // Python found authoritative sources
        recommendations.push('Python authority service found authoritative sources');
      }
    } else {
      warnings.push('Python authority service not used - answer may lack authority validation');
    }
    
    // 5. Check answer structure
    const hasRule = ragResponse.answer.includes('**Regel:**') || ragResponse.answer.includes('**Rule:**');
    const hasMeaning = ragResponse.answer.includes('**Bedeutung:**') || ragResponse.answer.includes('**Meaning:**');
    
    if (!hasRule || !hasMeaning) {
      warnings.push('Answer structure may be incomplete');
    }
    
    // 6. Check for boilerplate contamination
    if (this.containsBoilerplate(ragResponse.answer)) {
      errors.push('Answer contains boilerplate text');
      recommendations.push('Check boilerplate filtering');
    }
    
    // 7. Check confidence level
    if (ragResponse.confidence < 0.3) {
      errors.push(`Low confidence (${(ragResponse.confidence * 100).toFixed(0)}%) - verify accuracy`);
      recommendations.push('Repeat question with specific statute and paragraph reference');
    } else if (ragResponse.confidence < 0.5) {
      warnings.push(`Medium confidence (${(ragResponse.confidence * 100).toFixed(0)}%)`);
    }
    
    // 8. Check if any chunks were used
    if (ragResponse.metadata?.chunksUsed === 0) {
      errors.push('No legal text found - answer may be generic');
    }
    
    // 9. Check for statute information (Python will provide this)
    const statute = ragResponse.metadata?.statute;
    if (statute) {
      recommendations.push(`Answer based on ${statute} - Python authority service validated`);
    } else {
      warnings.push('No statute identified - verify legal domain');
    }
    
    // 10. Check Python integration health
    if (ragResponse.metadata?.python_error) {
      errors.push(`Python service error: ${ragResponse.metadata.python_error}`);
      recommendations.push('Check Python authority service connection');
    }
    
    // Generate recommendations if none from above
    if (recommendations.length === 0 && (warnings.length > 0 || errors.length > 0)) {
      if (statute) {
        recommendations.push(`Use explicit ${statute} paragraph/article reference for precise answer`);
      } else {
        recommendations.push('Repeat question with specific statute reference');
      }
    }
    
    return {
      isValid: errors.length === 0,
      warnings: [...new Set(warnings)],
      errors: [...new Set(errors)],
      recommendations: [...new Set(recommendations)],
      score: this.calculateSafetyScore(warnings, errors, ragResponse.metadata),
      metadata: {
        architecture: ragResponse.metadata?.architecture || 'unknown',
        python_used: ragResponse.metadata?.python_used || false,
        python_authoritative: ragResponse.metadata?.python_authoritative_found || false,
        statute_identified: !!statute,
        chunks_used: ragResponse.metadata?.chunksUsed || 0
      }
    };
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
      'register notices',
      'this document is',
      'copyright',
      'all rights reserved'
    ];
    
    return boilerplateMarkers.some(marker => 
      text.toLowerCase().includes(marker)
    );
  }
  
  calculateSafetyScore(warnings, errors, metadata = {}) {
    let score = 100;
    
    // Base deductions
    score -= warnings.length * 5;
    score -= errors.length * 15;
    
    // Architecture compliance
    if (metadata.architecture === 'authority_python') {
      score += 10;
    }
    
    // Python service usage
    if (metadata.python_used) {
      score += 10;
    }
    
    if (metadata.python_authoritative_found) {
      score += 15;
    }
    
    // Confidence adjustments
    if (metadata.confidence) {
      if (metadata.confidence > 0.7) {
        score += 10;
      } else if (metadata.confidence < 0.3) {
        score -= 20;
      }
    }
    
    // Chunk usage
    if (metadata.chunksUsed && metadata.chunksUsed > 0) {
      score += 5;
    } else if (metadata.chunksUsed === 0) {
      score -= 20;
    }
    
    return Math.max(0, Math.min(100, score));
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
      statutes: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))]
    };
  }
  
  logSafetyEvent(eventType, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event: eventType,
      details,
      system: 'German-Legal-RAG',
      architecture: 'authority_python'
    };
    
    console.log(`🛡️  SAFETY LOG: ${timestamp} - ${eventType}`, details);
    
    return logEntry;
  }
  
  validateCrossStatuteContamination(response, documents) {
    const statute = response.metadata?.statute;
    if (!statute) return { isValid: true, note: 'No statute in response - Python will validate' };
    
    const citations = response.citations || [];
    const foreignCitations = citations.filter(citation => 
      citation.statute && citation.statute !== statute
    );
    
    if (foreignCitations.length > 0) {
      return {
        isValid: false,
        error: `Cross-statute contamination: ${statute} answer cites ${foreignCitations.map(c => c.statute).join(', ')}`,
        foreignCitations,
        recommendation: 'Python authority service will enforce strict field isolation'
      };
    }
    
    return { isValid: true };
  }
  
  generateSafetyReport(conversationHistory = []) {
    const totalQuestions = conversationHistory.length;
    const questionsWithPython = conversationHistory.filter(c => c.metadata?.python_used).length;
    const questionsWithAuthority = conversationHistory.filter(c => c.metadata?.python_authoritative_found).length;
    
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
      const statute = c.statute || c.metadata?.statute;
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
      architecture: 'authority_python',
      summary: {
        totalQuestions,
        questionsWithPython,
        questionsWithAuthority,
        pythonUsageRate: totalQuestions > 0 ? (questionsWithPython / totalQuestions) * 100 : 0,
        authorityRate: totalQuestions > 0 ? (questionsWithAuthority / totalQuestions) * 100 : 0,
        averageSafetyScore: Math.round(avgSafetyScore),
        averageConfidence: Math.round(avgConfidence * 100)
      },
      statutes: statuteCounts,
      errorAnalysis: errorCategories,
      pythonUsage: {
        pythonUsed: questionsWithPython,
        pythonAuthoritative: questionsWithAuthority,
        pythonErrorRate: conversationHistory.filter(c => c.metadata?.python_error).length
      },
      recommendations: this.generateSystemRecommendations(
        totalQuestions,
        questionsWithPython,
        avgSafetyScore,
        statuteCounts,
        errorCategories
      )
    };
  }
  
  categorizeError(error) {
    if (error.includes('Statute') || error.includes('Gesetz')) return 'STATUTE_ERROR';
    if (error.includes('Boilerplate')) return 'BOILERPLATE_ERROR';
    if (error.includes('Konfidenz') || error.includes('confidence')) return 'CONFIDENCE_ERROR';
    if (error.includes('Architektur') || error.includes('architecture')) return 'ARCHITECTURE_ERROR';
    if (error.includes('Python') || error.includes('python')) return 'PYTHON_ERROR';
    return 'OTHER_ERROR';
  }
  
  generateSystemRecommendations(totalQuestions, questionsWithPython, avgSafetyScore, statuteCounts, errorCategories) {
    const recommendations = [];
    
    if (totalQuestions > 0) {
      const pythonRate = (questionsWithPython / totalQuestions) * 100;
      
      if (pythonRate < 90) {
        recommendations.push({
          priority: 'HIGH',
          action: 'Improve Python integration',
          description: 'Python authority service not used for all questions.',
          metric: `${Math.round(pythonRate)}% Python usage rate`,
          target: '> 90%'
        });
      }
      
      if (avgSafetyScore < 70) {
        recommendations.push({
          priority: 'HIGH',
          action: 'Improve answer quality',
          description: 'Average safety score too low.',
          metric: `${Math.round(avgSafetyScore)} safety score`,
          target: '> 70'
        });
      }
      
      // Analyze error categories
      if (errorCategories.PYTHON_ERROR > 3) {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'Check Python service connection',
          description: 'Multiple Python service errors.',
          metric: `${errorCategories.PYTHON_ERROR} Python errors`,
          target: '< 2'
        });
      }
    }
    
    // Check Python dependency
    recommendations.push({
      priority: 'LOW',
      action: 'Ensure Python service is running',
      description: 'Authority resolution depends on Python service.',
      metric: 'Python service dependency',
      target: 'Always running'
    });
    
    return recommendations;
  }
  
  monitorPerformance(metrics) {
    const {
      processingTime,
      chunkCount,
      documentCount,
      confidence,
      safetyScore,
      pythonUsed,
      pythonAuthoritative
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
      python: {
        used: pythonUsed,
        authoritative: pythonAuthoritative,
        status: pythonAuthoritative ? 'authoritative' : pythonUsed ? 'used' : 'not_used'
      },
      architecture: 'authority_python'
    };
    
    // Log performance issues
    if (performance.processingTime.status === 'slow') {
      this.logSafetyEvent('PERFORMANCE_WARNING', {
        message: 'Processing time slow',
        processingTime,
        recommendation: 'Optimize Python service calls'
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
        recommendation: 'Review Python authority service configuration'
      });
    }
    
    return performance;
  }
  
  // New: Validate Python service health
  validatePythonServiceHealth(pythonIntegrationService) {
    try {
      if (!pythonIntegrationService || typeof pythonIntegrationService.healthCheck !== 'function') {
        return {
          service: 'PythonIntegrationService',
          status: 'unavailable',
          error: 'Python integration service not available',
          timestamp: new Date().toISOString()
        };
      }
      
      // Check if we can call Python service
      const health = pythonIntegrationService.healthCheck();
      
      return {
        service: 'PythonIntegrationService',
        status: health.status || 'unknown',
        python_service: health.python_service || false,
        error: health.error,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        service: 'PythonIntegrationService',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Quick validation for system startup
  validateSystemStartup(services) {
    const validation = {
      timestamp: new Date().toISOString(),
      services: {},
      overallStatus: 'checking'
    };
    
    // Check required services
    const requiredServices = [
      'pdfDocumentService',
      'embeddingService',
      'pythonIntegrationService'
    ];
    
    requiredServices.forEach(serviceName => {
      const service = services[serviceName];
      validation.services[serviceName] = {
        available: !!service,
        type: service ? typeof service : 'missing'
      };
    });
    
    // Check if we have documents
    if (services.pdfDocumentService) {
      const documents = services.pdfDocumentService.getAllDocuments();
      validation.documents = {
        count: documents.length,
        hasContent: documents.length > 0,
        statutes: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))]
      };
    }
    
    // Check Python service specifically
    if (services.pythonIntegrationService) {
      const pythonHealth = this.validatePythonServiceHealth(services.pythonIntegrationService);
      validation.python = pythonHealth;
    }
    
    // Determine overall status
    const missingServices = requiredServices.filter(name => !validation.services[name]?.available);
    
    if (missingServices.length > 0) {
      validation.overallStatus = 'degraded';
      validation.missingServices = missingServices;
    } else if (validation.documents && validation.documents.count === 0) {
      validation.overallStatus = 'no_documents';
    } else if (validation.python && validation.python.status !== 'healthy') {
      validation.overallStatus = 'python_unavailable';
    } else {
      validation.overallStatus = 'healthy';
    }
    
    return validation;
  }
}

module.exports = new SafetyCheck();