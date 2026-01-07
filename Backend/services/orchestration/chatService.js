const documentService = require("../ingestion/pdfDocumentService");
const ragService = require("../retrieval/ragService");
const safetyCheck = require("../validation/safetyCheck");
const pythonIntegrationService = require("../retrieval/pythonIntegrationService");

class ChatService {
  constructor() {
    this.conversationHistory = [];
    console.log('✅ ChatService initialized with PYTHON AUTHORITY INTEGRATION');
  }

  async processQuestion(question, context = {}) {
    try {
      console.log(`\n🤔 Processing with PYTHON AUTHORITY ARCHITECTURE: "${question}"`);
      
      // STEP 1: Get all documents
      const allDocuments = documentService.getAllDocuments();
      
      if (!allDocuments || allDocuments.length === 0) {
        return {
          success: false,
          error: "Keine Dokumente verfügbar. Bitte laden Sie zuerst deutsche Rechtsdokumente hoch.",
          details: "Document service returned empty list"
        };
      }
      
      // ===========================================================================
      // STEP 2: Use PYTHON for authority resolution (replaces legalAuthorityService)
      // ===========================================================================
      console.log(`🔍 [ChatService] Resolving authority via Python service...`);
      let authority = null;
      let pythonAuthorityError = null;
      
      try {
        const authorityResult = await pythonIntegrationService.resolveAuthority(question);
        
        if (authorityResult.success && authorityResult.authority) {
          authority = authorityResult.authority;
          console.log(`✅ Python authority resolved: ${authority.statute || 'NO_STATUTE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);
        } else {
          // Python failed to resolve authority
          console.log(`⚠️ Python authority resolution failed or no statute found`);
          
          // Create minimal authority object for fallback
          authority = {
            statute: null,
            paragraph: null,
            isArticle: false,
            requiresClarification: true,
            confidence: 0.3,
            referenceSource: 'python_failed'
          };
        }
      } catch (error) {
        console.log(`❌ Python authority service error: ${error.message}`);
        pythonAuthorityError = error.message;
        
        // Fallback authority
        authority = {
          statute: null,
          paragraph: null,
          isArticle: false,
          requiresClarification: true,
          confidence: 0.1,
          referenceSource: 'python_error'
        };
      }
      
      // Handle non-locked statutes (principled refusal)
      if (authority.requiresClarification) {
        console.log(`❌ [ChatService] Authority clarification required`);
        
        // Log the clarification event
        safetyCheck.logSafetyEvent('AUTHORITY_CLARIFICATION', {
          question,
          statute: authority.statute,
          reference: authority.paragraph,
          referenceType: authority.isArticle ? 'ARTICLE' : 'PARAGRAPH',
          clarificationType: authority.clarification ? 'statute_missing' : 'other',
          timestamp: new Date().toISOString(),
          python_error: !!pythonAuthorityError
        });
        
        return this.generateStructuredClarification(authority, question, pythonAuthorityError);
      }
      
      console.log(`✅ Authority from Python: ${authority.statute} ${authority.paragraph ? (authority.isArticle ? 'Article ' : '§') + authority.paragraph : ''}`);
      
      // STEP 3: Question classification (simplified - no authority dependency)
      const questionClassifier = require('../classification/questionClassifier');
      const classification = questionClassifier.classify(question);
      console.log(`🎯 Question classification: ${classification.type}`);
      
      // ===========================================================================
      // ✅ CORRECT ARCHITECTURE: Doctrine/System questions handled BEFORE RAG
      // ===========================================================================
      if (classification.type === 'DOCTRINE' || classification.type === 'SYSTEM') {
        console.log(`⚖️ Processing as ${classification.type} question (BYPASSING RAG)`);
        return this.handleDoctrineOrSystemQuestionDirectly(
          question,
          classification,
          authority
        );
      }
      
      // STEP 4: Use Python for authoritative retrieval
      console.log(`🤖 Using Python for authoritative retrieval...`);
      
      let pythonResults = null;
      let pythonRetrievalError = null;
      
      try {
        console.log(`📡 Calling Python authoritative search...`);
        
        // Prepare documents for Python
        const preparedDocs = this.prepareDocumentsForPython(allDocuments);
        
        // Use Python to get authoritative sources
        const sourcesResult = await pythonIntegrationService.getAuthoritativeSources(
          question,
          authority.statute,
          classification.type,
          preparedDocs
        );
        
        if (sourcesResult.success) {
          pythonResults = {
            results: sourcesResult.allowed_documents || [],
            authoritative_found: sourcesResult.allowed_documents && sourcesResult.allowed_documents.length > 0,
            authority_summary: sourcesResult.authority_summary || {}
          };
          console.log(`✅ Python returned ${pythonResults.results?.length || 0} authoritative sources`);
        } else {
          console.log(`⚠️ Python authoritative sources failed, using fallback`);
          pythonResults = {
            results: preparedDocs, // Fallback to all documents
            authoritative_found: false,
            authority_summary: { fallback: true }
          };
        }
        
      } catch (error) {
        console.log(`⚠️ Python retrieval error: ${error.message}`);
        pythonRetrievalError = error;
        pythonResults = {
          results: allDocuments,
          authoritative_found: false,
          authority_summary: { error: error.message }
        };
      }
      
      // ===========================================================================
      // ✅ CORRECT: Only ONE RAG call with proper contract
      // ===========================================================================
      const ragResponse = await ragService.generateResponse(
        question,
        allDocuments,
        {
          language: "german",
          authority: authority,
          classification: classification,
          python_results: pythonResults
        }
      );
      
      // Add Python service metadata to RAG response
      ragResponse.python_service_used = true;
      ragResponse.python_authority_resolved = !pythonAuthorityError && authority.statute;
      ragResponse.python_authoritative_found = pythonResults?.authoritative_found || false;
      ragResponse.python_results_count = pythonResults?.results?.length || 0;
      
      if (pythonAuthorityError) {
        ragResponse.python_authority_error = pythonAuthorityError;
      }
      if (pythonRetrievalError) {
        ragResponse.python_retrieval_error = pythonRetrievalError.message;
      }
      
      // STEP 5: Safety check (enhanced)
      const safetyValidation = ragResponse.safetyCheck || await safetyCheck.validateBeforeAnswer(question, ragResponse, authority);
      
      // STEP 6: Structure the answer with authority context
      const structuredAnswer = this.structureAnswerWithAuthority(
        ragResponse, 
        question, 
        safetyValidation, 
        authority,
        classification,
        pythonResults
      );
      
      // STEP 7: Add to conversation history with authority metadata
      const conversationEntry = {
        question: question,
        answer: structuredAnswer.fullAnswer,
        structuredAnswer: structuredAnswer,
        sources: ragResponse.citations,
        timestamp: new Date().toISOString(),
        confidence: ragResponse.confidence,
        legalDomain: ragResponse.metadata?.legalDomain || 'general',
        statute: authority.statute,
        paragraph: authority.paragraph,
        isArticle: authority.isArticle,
        authority: authority,
        classification: classification,
        safetyCheck: safetyValidation,
        python_authority_used: !pythonAuthorityError,
        python_authoritative_found: pythonResults?.authoritative_found || false,
        python_results_count: pythonResults?.results?.length || 0
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
        paragraph: authority.paragraph,
        referenceType: authority.isArticle ? 'ARTICLE' : 'PARAGRAPH',
        confidence: ragResponse.confidence,
        safetyScore: safetyValidation.score,
        architecture: 'python_authority',
        python_authority_used: !pythonAuthorityError,
        python_authoritative_found: pythonResults?.authoritative_found || false
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
          statute: authority.statute,
          paragraph: authority.paragraph,
          isArticle: authority.isArticle,
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
            architecture: 'python_authority',
            statuteLocked: !!authority.statute,
            python_service_used: ragResponse.python_service_used || false,
            python_authority_resolved: ragResponse.python_authority_resolved || false,
            python_authoritative_found: ragResponse.python_authoritative_found || false,
            python_results_count: ragResponse.python_results_count || 0
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
     ✅ CORRECT: Handle Doctrine/System questions DIRECTLY (NO RAG)
  -------------------------------------------------- */
  handleDoctrineOrSystemQuestionDirectly(question, classification, authority) {
    const isDoctrine = classification.type === 'DOCTRINE';
    
    if (isDoctrine) {
      return {
        success: true,
        data: {
          answer: this.generateDoctrineAnswer(question, authority),
          confidence: 0.9,
          metadata: {
            architecture: "doctrine_bypass",
            statute: authority.statute,
            classification: classification,
            statuteLocked: false,
            requiresRetrieval: false
          }
        }
      };
    } else {
      return {
        success: true,
        data: {
          answer: this.generateSystemAnswer(),
          confidence: 0.95,
          metadata: {
            architecture: "system_bypass",
            classification: classification,
            statuteLocked: false,
            requiresRetrieval: false
          }
        }
      };
    }
  }

  generateDoctrineAnswer(question, authority) {
    let doctrineName = "allgemeine Rechtsprinzipien";
    
    if (question.toLowerCase().includes("schuldprinzip")) {
      doctrineName = "Schuldprinzip";
    } else if (question.toLowerCase().includes("verhältnismäßigkeitsprinzip")) {
      doctrineName = "Verhältnismäßigkeitsprinzip";
    } else if (question.toLowerCase().includes("rechtsstaatsprinzip")) {
      doctrineName = "Rechtsstaatsprinzip";
    }
    
    return `**Erklärung zu ${doctrineName}**

Ihre Frage betrifft ein **Rechtsprinzip oder eine Rechtsdoktrin**, nicht eine konkrete Gesetzesnorm.

**Unterschied in der deutschen Rechtsordnung:**
- **Gesetz:** Kodifizierte Norm mit direktem Rechtsbefehl (z.B. "§ 823 BGB")
- **Rechtsprinzip:** Aus Gesetzen und Rechtsprechung abgeleiteter Grundsatz

**Typische Quellen von Rechtsprinzipien:**
1. **Verfassungsrechtliche Grundsätze** (Grundgesetz)
2. **Rechtsprechung** (Bundesverfassungsgericht)
3. **Wissenschaftliche Lehre**
4. **Überpositive Rechtsprinzipien**

**Für präzisere Rechtsauskünfte:**
- Bei **konkreten Rechtsfolgen**: Gesetzeszitat angeben (z.B. "§ 433 BGB")
- Bei **Grundrechten**: Artikel des Grundgesetzes nennen
- Bei **strafrechtlichen Fragen**: StGB-Paragraphen spezifizieren

*Rechtsprinzipien sind Teil der deutschen Rechtsordnung, werden aber nicht notwendigerweise in einzelnen Paragraphen niedergelegt.*`;
  }

  generateSystemAnswer() {
    return `**Das deutsche Rechtssystem**

**Systematik:** Deutschland gehört zum **Civil Law (kontinentaleuropäischer Rechtskreis)**.

**Kernmerkmale:**
1. **Kodifikation:** Umfassende Gesetzeswerke (BGB, StGB, HGB, GG)
2. **Gesetzespositivismus:** Gesetz als primäre Rechtsquelle
3. **Richterrecht:** Präjudizien sind persuasiv, nicht bindend
4. **Inquisitorisches Verfahren:** Gericht ermittelt von Amts wegen
5. **Starke Gewaltenteilung** (Art. 20 GG)

**Unterschied zu Common Law:**
| Civil Law (Deutschland) | Common Law (UK/USA)       |
|--------------------------|---------------------------|
| Kodifizierte Gesetze     | Fallrecht (Case Law)      |
| Gesetzestexte primär     | Richterrecht primär       |
| Romanistische Tradition  | Anglo-amerikanische Trad. |
| Nicht-bindende Präjudizien | *Stare decisis* (bindend)|

**Verfassungsgrundlage:** Art. 20 GG (demokratischer und sozialer Rechtsstaat)`;
  }

  /* -------------------------------------------------
     NEW: Generate structured clarification
  -------------------------------------------------- */
  generateStructuredClarification(authority, question, pythonError = null) {
    let clarificationMessage = "Bitte präzisieren Sie Ihre Frage mit einem konkreten Gesetzesbezug.";
    
    if (pythonError) {
      clarificationMessage = `Python-Autoritätsdienst nicht verfügbar. ${clarificationMessage}`;
    }
    
    return {
      success: false,
      requiresClarification: true,
      clarification: {
        type: 'STATUTE_MISSING',
        message: {
          german: `**Rechtliche Präzisierung erforderlich**\n\n${clarificationMessage}`,
          english: `**Legal clarification required**\n\n${pythonError ? 'Python authority service unavailable. ' : ''}Please clarify your question with a specific statute reference.`
        },
        suggestions: [
          "Bitte geben Sie das Gesetz an (z.B. StGB, BGB, HGB)",
          "Falls Sie einen bestimmten Paragraphen meinen, nennen Sie diesen (z.B. § 242 StGB)",
          "Für Straftaten: 'Welche Strafe sieht StGB für Diebstahl vor?'",
          "Für Zivilrecht: 'Was regelt BGB zu Verträgen?'"
        ],
        exampleQuestions: [
          "Welche Strafe sieht StGB § 242 vor?",
          "Was regelt BGB § 433?",
          "Erklären Sie HGB § 15"
        ],
        python_error: pythonError
      },
      metadata: {
        question,
        timestamp: new Date().toISOString(),
        authority: authority
      }
    };
  }

  /* -------------------------------------------------
     METHODS FOR PYTHON INTEGRATION
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
          language: doc.metadata?.language || 'german'
        }
      };
    });
  }

  structureAnswerWithAuthority(ragResponse, question, safetyValidation, authority, classification, pythonResults = null) {
    // Start with the RAG answer
    let fullAnswer = ragResponse.answer;
    
    // Get statute display name
    let statuteName = '';
    if (authority && authority.statute) {
      const fallbackNames = {
        'StGB': 'Strafgesetzbuch (StGB)',
        'BGB': 'Bürgerliches Gesetzbuch (BGB)',
        'HGB': 'Handelsgesetzbuch (HGB)',
        'GG': 'Grundgesetz (GG)',
        'EU-GDPR': 'EU-Datenschutz-Grundverordnung (GDPR)'
      };
      statuteName = fallbackNames[authority.statute] || authority.statute;
    }
    
    // Add authority context if available
    if (authority && authority.statute && statuteName) {
      if (!fullAnswer.includes(statuteName)) {
        fullAnswer = `⚖️ **Gesetz:** ${statuteName}\n\n${fullAnswer}`;
      }
    } else if (authority && authority.statute) {
      fullAnswer = `⚖️ **Gesetz:** ${authority.statute}\n\n${fullAnswer}`;
    }
    
    // Add paragraph/article information if available
    if (authority.paragraph) {
      const referenceText = authority.isArticle ? `Artikel ${authority.paragraph}` : `§ ${authority.paragraph}`;
      if (!fullAnswer.includes(referenceText)) {
        const statuteDisplay = statuteName || (authority ? authority.statute : '');
        if (statuteDisplay) {
          fullAnswer = `**Rechtsnorm:** ${referenceText} ${statuteDisplay}\n\n${fullAnswer}`;
        } else {
          fullAnswer = `**Rechtsnorm:** ${referenceText}\n\n${fullAnswer}`;
        }
      }
    }
    
    // Add authority badge if Python found authoritative sources
    if (pythonResults?.authoritative_found) {
      fullAnswer = `🎖️ **AUTHORITATIVE ANSWER (Python validated)** 🎖️\n\n${fullAnswer}`;
    }
    
    // Add citations if available
    if (ragResponse.citations && ragResponse.citations.length > 0) {
      fullAnswer += `\n\n**Quellen:**\n`;
      ragResponse.citations.forEach((citation, index) => {
        fullAnswer += `${index + 1}. ${citation.document}\n`;
      });
    }
    
    // Add Python authoritative info if available
    if (pythonResults?.authoritative_found) {
      fullAnswer += `\n\n✅ **Autoritative Quelle:** Diese Antwort basiert auf Python-validierten autoritativen Quellen.`;
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
    fullAnswer += `\n\n🤖 *Diese Antwort verwendet die Python-Autoritätsvalidierung.*`;
    
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
      statute: authority.statute,
      paragraph: authority.paragraph,
      isArticle: authority.isArticle,
      confidence: ragResponse.confidence,
      exactParagraphMatch: ragResponse.metadata?.exactParagraphMatch || false,
      safetyCheck: safetyValidation,
      authority: authority,
      classification: classification,
      metadata: {
        documentsUsed: ragResponse.documentsUsed || 0,
        chunksUsed: ragResponse.metadata?.chunksUsed || 0,
        processingTime: ragResponse.metadata?.processingTime || 0,
        pythonServiceUsed: true,
        pythonAuthoritativeFound: pythonResults?.authoritative_found || false,
        pythonResultsCount: pythonResults?.results?.length || 0
      }
    };
  }

  logProcessing(question, ragResponse, authority, classification, pythonResults = null) {
    console.log('\n📊 PROCESSING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Question: ${question.substring(0, 80)}...`);
    console.log(`Statute: ${authority.statute || 'none'} (Python resolved)`);
    console.log(`Paragraph/Article: ${authority.paragraph || 'none'} (${authority.isArticle ? 'Article' : 'Paragraph'})`);
    console.log(`Classification: ${classification.type}`);
    console.log(`Confidence: ${(ragResponse.confidence * 100).toFixed(0)}%`);
    console.log(`Documents used: ${ragResponse.documentsUsed || 0}`);
    console.log(`Chunks used: ${ragResponse.metadata?.chunksUsed || 0}`);
    console.log(`Processing time: ${ragResponse.metadata?.processingTime || 0}ms`);
    
    if (pythonResults) {
      console.log(`Python authoritative sources: ${pythonResults.authoritative_found ? 'Found' : 'Not found'}`);
      console.log(`Python source count: ${pythonResults.results?.length || 0}`);
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
        statute: doc.metadata?.statute || 'Unbekannt'
      })),
      conversationCount: this.conversationHistory.length,
      recentQuestions: this.conversationHistory.slice(-5).map(c => ({
        question: c.question,
        statute: c.statute,
        paragraph: c.paragraph,
        confidence: c.confidence,
        safetyScore: c.safetyCheck?.score || 0,
        python_authority_used: c.python_authority_used || false,
        python_authoritative_found: c.python_authoritative_found || false
      })),
      safetyStats: {
        totalQuestions: this.conversationHistory.length,
        highConfidence: this.conversationHistory.filter(c => c.confidence > 0.7).length,
        lowConfidence: this.conversationHistory.filter(c => c.confidence < 0.3).length,
        averageSafetyScore: this.conversationHistory.reduce((sum, c) => 
          sum + (c.safetyCheck?.score || 0), 0) / this.conversationHistory.length || 0,
        pythonAuthorityUsed: this.conversationHistory.filter(c => c.python_authority_used).length,
        pythonAuthoritativeAnswers: this.conversationHistory.filter(c => c.python_authoritative_found).length
      }
    };

    return stats;
  }
  
  // Updated health check without legalAuthorityService
  async healthCheck() {
    try {
      const documents = documentService.getAllDocuments();
      const documentConsistency = safetyCheck.validateDocumentConsistency(documents);
      
      // Check Python service
      let pythonStatus = 'unknown';
      let pythonHealth = {};
      
      try {
        pythonHealth = await pythonIntegrationService.healthCheck();
        pythonStatus = pythonHealth.status || 'connected';
      } catch (error) {
        pythonStatus = 'disconnected';
        pythonHealth = { error: error.message };
      }
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        architecture: 'python_authority',
        documents: {
          count: documents.length,
          consistent: documentConsistency.isConsistent,
          issues: documentConsistency.issues.length,
          statutes: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))]
        },
        conversations: {
          count: this.conversationHistory.length,
          recent: this.conversationHistory.slice(-3).map(c => c.question)
        },
        python_service: {
          status: pythonStatus,
          health: pythonHealth,
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
        architecture: 'python_authority'
      };
    }
  }
}

module.exports = new ChatService();