// services/chatService.js - UPDATED WITH AUTHORITY LAYER AND PYTHON INTEGRATION

const documentService = require("./pdfDocumentService");
const ragService = require("./ragService");
const safetyCheck = require("./safetyCheck");
const legalAuthorityService = require("./New/legalAuthorityService");
const clarificationService = require("./New/clarificationService");
// ⭐⭐ NEW: Import Python integration service
const pythonIntegrationService = require("./pythonIntegrationService");

class ChatService {
  constructor() {
    this.conversationHistory = [];
    console.log('✅ ChatService initialized with AUTHORITY LAYER and PYTHON INTEGRATION');
  }

  async processQuestion(question, context = {}) {
    try {
      console.log(`\n🤔 Processing with AUTHORITY-PYTHON ARCHITECTURE: "${question}"`);
      
      // ⭐⭐ STEP 1: Get all documents
      const allDocuments = documentService.getAllDocuments();
      
      if (!allDocuments || allDocuments.length === 0) {
        return {
          success: false,
          error: "Keine Dokumente verfügbar. Bitte laden Sie zuerst deutsche Rechtsdokumente hoch.",
          details: "Document service returned empty list"
        };
      }
      
      // ⭐⭐ STEP 2: Check authority BEFORE RAG processing
      console.log(`🔍 [ChatService] Checking authority for question...`);
      const authority = legalAuthorityService.lockStatute(question);
      
      // Handle non-locked statutes (principled refusal)
      if (authority.status !== 'LOCKED') {
        console.log(`❌ [ChatService] Authority failed: ${authority.status}`);
        const clarification = clarificationService.generateFromAuthorityResult(
          authority, 
          question, 
          'german'
        );
        
        // Log the clarification event
        safetyCheck.logSafetyEvent('AUTHORITY_CLARIFICATION', {
          question,
          authorityStatus: authority.status,
          clarificationType: clarification.type,
          timestamp: new Date().toISOString()
        });
        
        return clarificationService.generateStructuredRefusal(
          clarification,
          question,
          { documentsAvailable: allDocuments.length }
        );
      }
      
      console.log(`✅ Authority locked: ${authority.statute} (${authority.field})`);
      
      // ⭐⭐ STEP 3: Question classification
      const questionClassifier = require('./New/questionClassifier');
      const classification = questionClassifier.classify(question, authority.statute);
      console.log(`🎯 Question classification: ${classification.type}`);
      
      // ⭐⭐ STEP 4: Handle doctrine/system questions separately
      if (classification.type === 'DOCTRINE' || classification.type === 'SYSTEM') {
        console.log(`⚖️ Processing as ${classification.type} question (bypassing Python)`);
        return this.handleDoctrineOrSystemQuestion(question, authority, classification);
      }
      
      // ⭐⭐ STEP 5: Use Python for authoritative retrieval
      console.log(`🤖 Using Python for authoritative retrieval...`);
      
      // Get all documents with authority metadata
      const documentsWithAuthority = this.prepareDocumentsForPython(allDocuments);
      
      // Create authority constraints based on question type
      const authorityConstraints = this.createAuthorityConstraints(
        authority.statute,
        classification.type
      );
      
      // Use Python service for authoritative search
      let pythonResults = null;
      let pythonError = null;
      
      try {
        console.log(`📡 Calling Python authoritative search...`);
        pythonResults = await pythonIntegrationService.authoritativeSearch({
          query: {
            text: question,
            statute: authority.statute,
            question_type: classification.type.toUpperCase()
          },
          authority_constraints: authorityConstraints,
          documents: documentsWithAuthority,
          options: {
            max_results: 30,
            similarity_threshold: 0.15
          }
        });
        
        console.log(`✅ Python returned ${pythonResults.results?.length || 0} results`);
        
      } catch (error) {
        console.log(`⚠️ Python service error: ${error.message}`);
        pythonError = error;
        // Fall back to standard RAG if Python fails
      }
      
      // ⭐⭐ STEP 6: Process with RAG service (with Python results if available)
      const ragResponse = await ragService.generateResponse(
        question,
        allDocuments,
        {
          language: "german",
          statute: authority.statute,
          field: authority.field,
          questionType: classification.type,
          pythonResults: pythonResults,
          usePythonResults: !pythonError && pythonResults?.results?.length > 0
        }
      );
      
      // Add Python service metadata to RAG response
      if (pythonResults && !pythonError) {
        ragResponse.python_service_used = true;
        ragResponse.python_results = pythonResults.results?.length || 0;
        ragResponse.python_processing_time = pythonResults.processing_time || 0;
        
        // Mark if all results are authoritative
        const allAuthoritative = pythonResults.authority_summary?.all_authoritative || 
                                this.checkAllAuthoritative(pythonResults.results);
        ragResponse.all_authoritative = allAuthoritative;
        
        // Add top authority rank
        if (pythonResults.results && pythonResults.results.length > 0) {
          const topRank = Math.min(...pythonResults.results.map(r => 
            r.metadata?.authority_rank || 100
          ));
          ragResponse.top_authority_rank = topRank;
        }
      } else if (pythonError) {
        ragResponse.python_service_error = pythonError.message;
      }
      
      // ⭐⭐ STEP 7: Safety check (enhanced)
      const safetyValidation = ragResponse.safetyCheck || await safetyCheck.validateBeforeAnswer(question, ragResponse);
      
      // ⭐⭐ STEP 8: Structure the answer with authority context
      const structuredAnswer = this.structureAnswerWithAuthority(
        ragResponse, 
        question, 
        safetyValidation, 
        authority,
        classification
      );
      
      // ⭐⭐ STEP 9: Add to conversation history with authority metadata
      const conversationEntry = {
        question: question,
        answer: structuredAnswer.fullAnswer,
        structuredAnswer: structuredAnswer,
        sources: ragResponse.citations,
        timestamp: new Date().toISOString(),
        confidence: ragResponse.confidence,
        legalDomain: ragResponse.metadata?.legalDomain || 'general',
        statute: ragResponse.metadata?.statute || null,
        authority: authority,
        classification: classification,
        safetyCheck: safetyValidation,
        python_used: !!pythonResults && !pythonError,
        python_results: pythonResults?.results?.length || 0
      };

      this.conversationHistory.push(conversationEntry);

      // Keep only last 20 conversations
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // Log safety event with authority info
      safetyCheck.logSafetyEvent('QUESTION_PROCESSED', {
        question,
        statute: authority.statute,
        confidence: ragResponse.confidence,
        authoritySource: authority.source,
        safetyScore: safetyValidation.score,
        architecture: 'authority_python',
        python_used: !!pythonResults && !pythonError
      });

      // Log processing
      this.logProcessing(question, ragResponse, authority, classification, pythonResults);
      
      return {
        success: true,
        data: {
          answer: structuredAnswer.fullAnswer,
          structuredAnswer: structuredAnswer,
          sources: ragResponse.citations,
          confidence: ragResponse.confidence,
          conversationId: Date.now().toString(),
          legalDomain: ragResponse.metadata?.legalDomain || 'general',
          statute: ragResponse.metadata?.statute || null,
          authority: authority,
          classification: classification,
          safetyCheck: safetyValidation,
          metadata: {
            documentsUsed: ragResponse.documentsUsed || 0,
            processingTime: ragResponse.metadata?.processingTime || 0,
            language: "german",
            exactParagraphMatch: ragResponse.metadata?.exactParagraphMatch || false,
            chunksUsed: ragResponse.metadata?.chunksUsed || 0,
            safetyPassed: safetyValidation.isValid,
            safetyScore: safetyValidation.score,
            warnings: safetyValidation.warnings,
            errors: safetyValidation.errors,
            architecture: 'authority_python',
            statuteLocked: ragResponse.metadata?.statuteLocked || false,
            python_service_used: ragResponse.python_service_used || false,
            python_results: ragResponse.python_results || 0,
            python_processing_time: ragResponse.python_processing_time || 0,
            all_authoritative: ragResponse.all_authoritative || false,
            top_authority_rank: ragResponse.top_authority_rank || 100
          },
        },
      };
    } catch (error) {
      console.error("Error processing question:", error);
      
      // Log safety event for error
      safetyCheck.logSafetyEvent('PROCESSING_ERROR', {
        question,
        error: error.message,
        timestamp: new Date().toISOString(),
        python_error: error.message.includes('python') || error.message.includes('Python')
      });
      
      return {
        success: false,
        error: "Fehler bei der Verarbeitung der Frage",
        details: error.message,
      };
    }
  }

  /* -------------------------------------------------
     NEW METHODS FOR PYTHON INTEGRATION
  -------------------------------------------------- */
  
  prepareDocumentsForPython(documents) {
    // Prepare documents for Python service
    return documents.map(doc => {
      // Extract chunks if needed
      let chunks = doc.chunks || [];
      
      // If chunks are strings, convert to objects
      if (chunks.length > 0 && typeof chunks[0] === 'string') {
        chunks = chunks.map((content, index) => ({
          content: content,
          chunk_index: index
        }));
      }
      
      return {
        id: doc.id || doc.filename,
        filename: doc.filename,
        content: doc.content || '',
        chunks: chunks,
        metadata: {
          title: doc.title || doc.metadata?.title || doc.filename,
          statute: doc.metadata?.statute || doc.statute || 'unknown',
          language: doc.metadata?.language || 'german',
          authority_metadata: doc.authority_metadata || doc.metadata?.authority_metadata || {
            source_type: 'unknown',
            authority_rank: 100
          }
        },
        authority_metadata: doc.authority_metadata || doc.metadata?.authority_metadata || {
          source_type: 'unknown',
          authority_rank: 100
        }
      };
    });
  }

  createAuthorityConstraints(statute, questionType) {
    // Define authority constraints based on statute and question type
    const constraints = {
      min_authority_rank: 5, // Default: rank 5 or better
      allowed_source_types: [],
      require_normative_content: questionType === 'NORMATIVE',
      language_priority: ["german", "english"]
    };
    
    // Statute-specific constraints
    switch(statute) {
      case 'GG':
        // Constitutional questions need highest authority
        constraints.min_authority_rank = 3;
        constraints.allowed_source_types = ['PRIMARY_LEGISLATION', 'CONSTITUTION'];
        break;
        
      case 'StGB':
        // Criminal law needs high authority
        constraints.min_authority_rank = 4;
        constraints.allowed_source_types = ['PRIMARY_LEGISLATION'];
        break;
        
      case 'BGB':
        // Civil code needs good authority
        constraints.min_authority_rank = 5;
        constraints.allowed_source_types = ['PRIMARY_LEGISLATION', 'OFFICIAL_COMMENTARY'];
        break;
        
      case 'HGB':
        // Commercial code can accept translations
        constraints.min_authority_rank = 6;
        constraints.allowed_source_types = ['PRIMARY_LEGISLATION', 'OFFICIAL_TRANSLATION'];
        break;
        
      case 'EU-GDPR':
        // GDPR needs EU official texts
        constraints.min_authority_rank = 3;
        constraints.allowed_source_types = ['EU_REGULATION', 'OFFICIAL_TRANSLATION'];
        break;
    }
    
    // Question type adjustments
    if (questionType === 'NORMATIVE') {
      constraints.min_authority_rank = Math.min(constraints.min_authority_rank, 4);
      constraints.require_normative_content = true;
    }
    
    return constraints;
  }

  checkAllAuthoritative(results) {
    if (!results || results.length === 0) return false;
    
    // Check if all results have high authority (rank ≤ 3)
    return results.every(result => {
      const rank = result.metadata?.authority_rank || 100;
      return rank <= 3;
    });
  }

  handleDoctrineOrSystemQuestion(question, authority, classification) {
    console.log(`⚖️ Handling ${classification.type} question`);
    
    // Get standard RAG response for doctrine/system questions
    return ragService.generateResponse(
      question,
      [],
      {
        language: "german",
        statute: authority.statute,
        field: authority.field,
        questionType: classification.type,
        bypassRetrieval: true
      }
    );
  }

  structureAnswerWithAuthority(ragResponse, question, safetyValidation, authority, classification) {
    // Extract paragraph from question
    const paragraphMatch = question.match(/§\s*(\d+[a-z]?)/i);
    const requestedParagraph = paragraphMatch ? paragraphMatch[1] : null;
    
    // Start with the RAG answer
    let fullAnswer = ragResponse.answer;
    
    // Add authority context if available
    if (authority && authority.statute) {
      const statuteName = legalAuthorityService.getStatuteDisplayName(authority.statute);
      if (!fullAnswer.includes(statuteName)) {
        fullAnswer = `⚖️ **Gesetz:** ${statuteName}\n\n${fullAnswer}`;
      }
    }
    
    // Add authority badge if all sources are authoritative
    if (ragResponse.all_authoritative) {
      fullAnswer = `🎖️ **AUTHORITATIVE ANSWER** 🎖️\n\n${fullAnswer}`;
    }
    
    // Add citations if available
    if (ragResponse.citations && ragResponse.citations.length > 0) {
      fullAnswer += `\n\n**Quellen:**\n`;
      ragResponse.citations.forEach((citation, index) => {
        const authorityInfo = citation.authority ? 
          ` [${citation.authority.type} Rank:${citation.authority.rank}]` : '';
        fullAnswer += `${index + 1}. ${citation.document}${authorityInfo}\n`;
      });
    }
    
    // Add safety warnings if any
    if (!safetyValidation.isValid || safetyValidation.errors.length > 0) {
      fullAnswer += `\n\n⚠️  **Einschränkung der Antwortgenauigkeit**\n`;
      safetyValidation.errors.forEach(error => {
        fullAnswer += `• ${error}\n`;
      });
    }
    
    // Add warnings if any
    if (safetyValidation.warnings.length > 0) {
      fullAnswer += `\n\n📋 **Hinweise:**\n`;
      safetyValidation.warnings.forEach(warning => {
        fullAnswer += `• ${warning}\n`;
      });
    }
    
    // Add Python service info
    if (ragResponse.python_service_used) {
      fullAnswer += `\n\n🤖 *Diese Antwort verwendet die autoritative Python-Suche.*`;
      if (ragResponse.all_authoritative) {
        fullAnswer += ` Alle Quellen sind hochrangig.`;
      }
    }
    
    // Add confidence note
    if (ragResponse.confidence < 0.5) {
      fullAnswer += `\n\n*Hinweis: Die Antwort hat niedrige Konfidenz (${(ragResponse.confidence * 100).toFixed(0)}%). Bitte überprüfen Sie die Rechtslage.*`;
    }
    
    // Add safety score if low
    if (safetyValidation.score < 70) {
      fullAnswer += `\n\n🛡️  **Sicherheitsbewertung: ${safetyValidation.score}/100**`;
    }
    
    return {
      rule: this.extractRuleFromAnswer(ragResponse.answer),
      meaning: this.extractMeaningFromAnswer(ragResponse.answer),
      effect: this.extractEffectFromAnswer(ragResponse.answer),
      citations: ragResponse.citations,
      fullAnswer: fullAnswer.trim(),
      domain: ragResponse.metadata?.legalDomain || 'general',
      statute: ragResponse.metadata?.statute || null,
      confidence: ragResponse.confidence,
      requestedParagraph: requestedParagraph,
      exactParagraphMatch: ragResponse.metadata?.exactParagraphMatch || false,
      safetyCheck: safetyValidation,
      authority: authority,
      classification: classification,
      metadata: {
        documentsUsed: ragResponse.documentsUsed || 0,
        chunksUsed: ragResponse.metadata?.chunksUsed || 0,
        processingTime: ragResponse.metadata?.processingTime || 0,
        pythonServiceUsed: ragResponse.python_service_used || false,
        allAuthoritative: ragResponse.all_authoritative || false,
        topAuthorityRank: ragResponse.top_authority_rank || 100
      }
    };
  }

  logProcessing(question, ragResponse, authority, classification, pythonResults = null) {
    console.log('\n📊 PROCESSING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Question: ${question.substring(0, 80)}...`);
    console.log(`Statute: ${authority.statute} (${authority.field})`);
    console.log(`Classification: ${classification.type}`);
    console.log(`Confidence: ${(ragResponse.confidence * 100).toFixed(0)}%`);
    console.log(`Documents used: ${ragResponse.documentsUsed || 0}`);
    console.log(`Chunks used: ${ragResponse.metadata?.chunksUsed || 0}`);
    console.log(`Processing time: ${ragResponse.metadata?.processingTime || 0}ms`);
    
    if (pythonResults) {
      console.log(`Python results: ${pythonResults.results?.length || 0}`);
      console.log(`Python processing: ${pythonResults.processing_time?.toFixed(2) || 0}s`);
      console.log(`All authoritative: ${ragResponse.all_authoritative || false}`);
    }
    
    if (ragResponse.citations && ragResponse.citations.length > 0) {
      console.log('\n📚 Top citations:');
      ragResponse.citations.slice(0, 3).forEach((citation, i) => {
        console.log(`  ${i+1}. ${citation.document.substring(0, 60)}...`);
      });
    }
  }

  /* -------------------------------------------------
     EXISTING METHODS (UPDATED)
  -------------------------------------------------- */

  structureAnswer(ragResponse, question, safetyValidation, authority = null) {
    // Keep for backward compatibility
    return this.structureAnswerWithAuthority(
      ragResponse, 
      question, 
      safetyValidation, 
      authority, 
      { type: 'GENERAL' }
    );
  }

  extractRuleFromAnswer(answer) {
    const ruleMatch = answer.match(/Regel:\s*\n(.*?)(?=\n\n|$)/s);
    if (ruleMatch && ruleMatch[1]) {
      return ruleMatch[1].trim();
    }
    
    // Fallback: first paragraph
    const paragraphs = answer.split('\n\n');
    for (const paragraph of paragraphs) {
      if (paragraph.includes('§') || paragraph.includes('Artikel')) {
        return paragraph.trim();
      }
    }
    
    return paragraphs[0]?.trim() || answer.substring(0, 200);
  }

  extractMeaningFromAnswer(answer) {
    const meaningMatch = answer.match(/Bedeutung:\s*\n(.*?)(?=\n\n|$)/s);
    if (meaningMatch && meaningMatch[1]) {
      return meaningMatch[1].trim();
    }
    
    return 'Allgemeine rechtliche Bedeutung gemäß der zitierten Norm.';
  }

  extractEffectFromAnswer(answer) {
    const effectMatch = answer.match(/Rechtsfolge:\s*\n(.*?)(?=\n\n|$)/s);
    if (effectMatch && effectMatch[1]) {
      return effectMatch[1].trim();
    }
    
    return 'Rechtliche Konsequenzen ergeben sich aus dem Gesetzestext.';
  }

  getConversationHistory(limit = 10) {
    return this.conversationHistory.slice(-limit);
  }

  clearHistory() {
    this.conversationHistory = [];
    return { success: true, message: "Verlauf gelöscht" };
  }

  getStats() {
    const documents = documentService.getAllDocuments();
    const stats = {
      documents: documents.map(doc => ({
        title: doc.title || doc.filename,
        type: doc.type || doc.metadata?.documentType,
        pages: doc.pages || 0,
        chunks: doc.chunks || 0,
        statute: doc.metadata?.statute || 'Unbekannt',
        authority: doc.authority_metadata?.source_type || 'unknown'
      })),
      conversationCount: this.conversationHistory.length,
      recentQuestions: this.conversationHistory.slice(-5).map(c => ({
        question: c.question,
        statute: c.statute,
        authority: c.authority?.statute || 'none',
        confidence: c.confidence,
        safetyScore: c.safetyCheck?.score || 0,
        python_used: c.python_used || false
      })),
      safetyStats: {
        totalQuestions: this.conversationHistory.length,
        highConfidence: this.conversationHistory.filter(c => c.confidence > 0.7).length,
        lowConfidence: this.conversationHistory.filter(c => c.confidence < 0.3).length,
        averageSafetyScore: this.conversationHistory.reduce((sum, c) => 
          sum + (c.safetyCheck?.score || 0), 0) / this.conversationHistory.length || 0,
        authorityLocks: this.conversationHistory.filter(c => c.authority?.status === 'LOCKED').length,
        clarifications: this.conversationHistory.filter(c => c.authority?.status !== 'LOCKED').length,
        pythonUsed: this.conversationHistory.filter(c => c.python_used).length,
        authoritativeAnswers: this.conversationHistory.filter(c => 
          c.structuredAnswer?.metadata?.allAuthoritative
        ).length
      }
    };

    return stats;
  }
  
  // Additional method for system health check
  async healthCheck() {
    try {
      const documents = documentService.getAllDocuments();
      const documentConsistency = safetyCheck.validateDocumentConsistency(documents);
      
      // Check authority service
      const authorityTest = legalAuthorityService.lockStatute("Was regelt § 15 HGB?");
      
      // Check Python service
      let pythonStatus = 'unknown';
      try {
        await pythonIntegrationService.testConnection();
        pythonStatus = 'connected';
      } catch (error) {
        pythonStatus = 'disconnected';
      }
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        architecture: 'authority_python',
        documents: {
          count: documents.length,
          consistent: documentConsistency.isConsistent,
          issues: documentConsistency.issues.length,
          statutes: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))],
          documents_with_authority: documents.filter(d => d.authority_metadata).length
        },
        conversations: {
          count: this.conversationHistory.length,
          recent: this.conversationHistory.slice(-3).map(c => c.question)
        },
        authority: {
          service: 'operational',
          testResult: authorityTest.status,
          statutesDetected: Object.keys(legalAuthorityService.statutePatterns || {})
        },
        python_service: {
          status: pythonStatus,
          endpoint: pythonIntegrationService.getEndpoint()
        },
        safety: {
          lastCheck: new Date().toISOString(),
          score: documentConsistency.isConsistent ? 100 : 70
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        architecture: 'authority_python'
      };
    }
  }
  
  // New method: Test authority resolution
  async testAuthorityResolution(questions = []) {
    const testQuestions = questions.length > 0 ? questions : [
      "Was regelt § 15 HGB?",
      "Erklären Sie Artikel 5 GG",
      "Was ist das Schuldprinzip?",
      "Welche Strafe sieht StGB § 242 vor?",
      "Wie ist das deutsche Rechtssystem aufgebaut?",
      "Was bedeutet Datenschutz nach GDPR?"
    ];
    
    const results = [];
    
    for (const question of testQuestions) {
      const authority = legalAuthorityService.lockStatute(question);
      const classification = require('./New/questionClassifier').classify(question);
      
      results.push({
        question,
        authority,
        classification,
        requiresClarification: authority.status !== 'LOCKED',
        suggestion: authority.status !== 'LOCKED' ? 
          clarificationService.generateFromAuthorityResult(authority, question, 'german') : 
          null
      });
    }
    
    return {
      timestamp: new Date().toISOString(),
      totalQuestions: results.length,
      lockedStatutes: results.filter(r => r.authority.status === 'LOCKED').length,
      requiresClarification: results.filter(r => r.authority.status !== 'LOCKED').length,
      results
    };
  }
  
  // New method: Test Python integration
  async testPythonIntegration() {
    try {
      console.log('🧪 Testing Python integration...');
      
      // Test connection
      const connectionTest = await pythonIntegrationService.testConnection();
      
      // Test with a simple search
      const documents = this.prepareDocumentsForPython(documentService.getAllDocuments());
      
      const testResult = await pythonIntegrationService.authoritativeSearch({
        query: {
          text: "Was regelt § 280 BGB?",
          statute: "BGB",
          question_type: "NORMATIVE"
        },
        authority_constraints: {
          min_authority_rank: 5,
          allowed_source_types: ['PRIMARY_LEGISLATION'],
          require_normative_content: true
        },
        documents: documents.slice(0, 3), // Only test with first 3 docs
        options: {
          max_results: 5,
          similarity_threshold: 0.1
        }
      });
      
      return {
        success: true,
        connection: connectionTest,
        search_test: {
          results: testResult.results?.length || 0,
          processing_time: testResult.processing_time,
          authority_summary: testResult.authority_summary
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new ChatService();