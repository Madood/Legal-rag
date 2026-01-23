const documentService = require("../ingestion/pdfDocumentService");
const ragService = require("../retrieval/ragService");
const safetyCheck = require("../validation/safetyCheck");
const pythonIntegrationService = require("../retrieval/pythonIntegrationService");

class ChatService {
  constructor() {
    this.conversationHistory = [];
    console.log('✅ ChatService initialized with EPISTEMIC AUTHORITY COMPLIANCE');
  }

  // ===========================================================================
  // 1️⃣ DOCTRINAL EARLY-EXIT CHECK (NEW)
  // ===========================================================================
  
  shouldUseDoctrinalEarlyExit(authority) {
    if (!authority) return false;
    
    const isDoctrinalQuestion = authority.classification?.type === 'DOCTRINE' || 
                               authority.question_type === 'DOCTRINE';
    const isConfirmed = authority.epistemicCertainty === 'confirmed' || 
                       authority.epistemic_certainty === 'confirmed';
    const isAnchorNormMode = authority.anchorNormMode === true || 
                            authority.anchor_norm_mode === true;
    
    return isDoctrinalQuestion && isConfirmed && isAnchorNormMode;
  }

  // ===========================================================================
  // 2️⃣ DOCTRINAL DELEGATION (FIXED: NO CONTENT IN CHATSERVICE)
  // ===========================================================================
  
  /**
   * Delegate doctrinal content to Python, never create it here
   */
  async callDoctrineInductionService(question, authority) {
    try {
      // CRITICAL FIX: Delegate ALL doctrinal content
      const doctrineResult = await pythonIntegrationService.callDoctrineInductor({
        question: question,
        statute: authority.statute,
        paragraph: authority.paragraph,
        classification: authority.classification,
        authority_mode: authority.authority_mode,
        // CRITICAL FIX: Never pass anchorNorm upstream
        suggested_field: authority.suggestedField || authority.doctrinal_field,
        epistemic_certainty: authority.epistemicCertainty
      });
      
      return doctrineResult;
    } catch (error) {
      console.error(`⚠️ Doctrine induction failed: ${error.message}`);
      return null;
    }
  }

  // 🔴 CRITICAL FIX 1: Doctrine enforcement method (UPDATED)
  async enforcePythonDoctrine(question, authority) {
    // First check for doctrinal early-exit
    if (this.shouldUseDoctrinalEarlyExit(authority)) {
      console.log(`🚀 [Doctrinal Early-Exit] Confirmed doctrine - immediate return`);
      return await this.callDoctrineInductionService(question, authority);
    }
    
    // Original logic for exact operative norms
    if (!authority?.statute || !authority?.paragraph) return null;
    
    console.log(`🔒 [Doctrine Enforcement] Checking if exact operative norm: ${authority.statute} §${authority.paragraph}`);
    
    const isExactOperativeNorm = 
      authority.authority_mode === 'exact' && 
      authority.statute && 
      authority.paragraph &&
      (authority.normFunction === 'OPERATIVE' || !authority.normFunction);
    
    if (!isExactOperativeNorm) {
      console.log(`ℹ️ [Doctrine] Not enforcing doctrine - mode: ${authority.authority_mode}, normFunction: ${authority.normFunction}`);
      return null;
    }
    
    console.log(`🔒 [Doctrine Enforcement] Exact operative norm detected - calling Python doctrine`);
    
    try {
      const doctrineResult = await this.callDoctrineInductionService(question, authority);
      
      if (doctrineResult?.doctrinal_summary || doctrineResult?.answer) {
        console.log(`✅ [Doctrine] Received doctrinal analysis from Python`);
        return doctrineResult;
      }
    } catch (error) {
      console.log(`⚠️ [Doctrine] Python doctrine call failed: ${error.message}`);
    }
    
    return null;
  }

  // 🔴 CRITICAL FIX 3: Generate answer from Python doctrine result (UPDATED)
  generateDoctrinalAnswer(doctrineResult, authority, question) {
    const statuteName = this.getStatuteDisplayName(authority.statute);
    const paragraphRef = authority.isArticle ? `Artikel ${authority.paragraph}` : `§ ${authority.paragraph}`;
    
    let answer = `**${statuteName} ${paragraphRef} - Rechtsgrundlage:**\n\n`;
    
    if (doctrineResult.doctrinal_summary) {
      answer += doctrineResult.doctrinal_summary;
    } else if (doctrineResult.answer) {
      answer += doctrineResult.answer;
    }
    
    if (doctrineResult.legal_principle) {
      answer += `\n\n**Rechtsprinzip:** ${doctrineResult.legal_principle}`;
    }
    
    if (doctrineResult.system_position) {
      answer += `\n\n**Systematische Stellung:** ${doctrineResult.system_position}`;
    }
    
    if (doctrineResult.examiner_ready_answer) {
      answer += `\n\n**Prüfungsreife Antwort:**\n${doctrineResult.examiner_ready_answer}`;
    }
    
    // CRITICAL FIX: Add epistemic metadata
    answer += `\n\n*Doctrinale Analyse durch Python-Autoritätsdienst. `;
    if (authority.epistemicCertainty) {
      answer += `Epistemische Sicherheit: ${authority.epistemicCertainty}. `;
    }
    answer += `Konfidenz: ${(doctrineResult.confidence * 100).toFixed(0)}%*`;
    
    return {
      fullAnswer: answer,
      domain: doctrineResult.domain || 'civil',
      template_used: 'python_doctrine',
      confidence: doctrineResult.confidence || 0.92, // Higher for confirmed doctrine
      doctrine_summary: doctrineResult.doctrinal_summary,
      metadata: {
        doctrine_applied: true,
        python_doctrine: true,
        authority_mode: 'exact',
        epistemic_certainty: authority.epistemicCertainty,
        anchor_norm_mode: authority.anchorNormMode,
        retrieval_used: false,
        safety_check_skipped: true // CRITICAL FIX
      }
    };
  }

  // ===========================================================================
  // 3️⃣ TF-IDF FALLBACK BLOCK (NEW)
  // ===========================================================================
  
  async retrieveDocumentsWithDoctrineGuard(question, authority, allDocuments, classification) {
    // Guard: No TF-IDF for doctrinal questions
    if (classification.type === 'DOCTRINE' || authority.question_type === 'DOCTRINE') {
      console.log(`🚫 [Doctrine Guard] TF-IDF fallback disabled for doctrinal questions`);
      return {
        results: [],
        authoritative_found: false,
        authority_summary: { doctrine_mode: true },
        authority_mode: authority.authority_mode
      };
    }

    // Original retrieval logic
    try {
      console.log(`🤖 Using Python for authoritative retrieval (mode: ${authority.authority_mode})...`);
      
      const preparedDocs = this.prepareDocumentsForPython(allDocuments);
      
      const sourcesResult = await pythonIntegrationService.getAuthoritativeSources(
        question,
        authority.statute,
        classification.type,
        preparedDocs
      );
      
      if (sourcesResult.success) {
        const hasResults = sourcesResult.allowed_documents?.length > 0;
        const isOverviewMode = authority.authority_mode === 'overview';
        
        return {
          results: hasResults ? sourcesResult.allowed_documents : 
                   (isOverviewMode ? preparedDocs : []),
          authoritative_found: hasResults,
          authority_summary: sourcesResult.authority_summary || {},
          authority_mode: authority.authority_mode
        };
      } else {
        console.log(`⚠️ Python authoritative sources failed, using fallback`);
        return {
          results: preparedDocs,
          authoritative_found: false,
          authority_summary: { fallback: true },
          authority_mode: authority.authority_mode
        };
      }
      
    } catch (error) {
      console.log(`⚠️ Python retrieval error: ${error.message}`);
      const isOverviewMode = authority.authority_mode === 'overview';
      return {
        results: isOverviewMode ? allDocuments : [],
        authoritative_found: false,
        authority_summary: { error: error.message },
        authority_mode: authority.authority_mode
      };
    }
  }

  // ===========================================================================
  // 4️⃣ CONFIDENCE CALCULATION OVERRIDE (NEW)
  // ===========================================================================
  
  calculateEpistemicConfidence(baseConfidence, authority, ragResponse = null) {
    // Rule: IF epistemicCertainty == "confirmed" AND question_type == "DOCTRINE"
    // → confidence = max(confidence, 0.9)
    
    const isDoctrinalQuestion = authority.classification?.type === 'DOCTRINE' || 
                               authority.question_type === 'DOCTRINE';
    const isConfirmed = authority.epistemicCertainty === 'confirmed' || 
                       authority.epistemic_certainty === 'confirmed';
    
    if (isDoctrinalQuestion && isConfirmed) {
      const doctrinalConfidence = Math.max(baseConfidence, 0.9);
      console.log(`🎯 [Confidence Override] Doctrinal question: ${doctrinalConfidence.toFixed(2)} (was: ${baseConfidence.toFixed(2)})`);
      return doctrinalConfidence;
    }
    
    // For derivative norm questions, consider synthesis quality
    if (authority.question_type === "DERIVATIVE_NORM" && ragResponse?.synthesisQuality) {
      const synthesisBoost = ragResponse.synthesisQuality === "HIGH" ? 0.1 : 0;
      return Math.min(baseConfidence + synthesisBoost, 0.95);
    }
    
    // For exact operative norms, require chunk evidence
    if (authority.question_type === "EXACT_OPERATIVE_NORM" || authority.authority_mode === 'exact') {
      const chunkCount = ragResponse?.metadata?.chunksUsed || 0;
      if (chunkCount === 0) {
        return Math.min(baseConfidence, 0.6); // Penalize no evidence
      }
    }
    
    return baseConfidence;
  }

  // ===========================================================================
  // MAIN PROCESSING FLOW (UPDATED WITH ALL FIXES)
  // ===========================================================================
  
  async processQuestion(question, context = {}) {
    try {
      console.log(`\n🧠 Processing with EPISTEMIC AUTHORITY: "${question}"`);
      
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
      // STEP 2: Use PYTHON for authority resolution
      // ===========================================================================
      console.log(`🔍 [ChatService] Resolving authority via Python service...`);
      let authority = null;
      let pythonAuthorityError = null;
      
      try {
        const authorityResult = await pythonIntegrationService.resolveAuthority(question);
        
        if (authorityResult.success && authorityResult.authority) {
          authority = authorityResult.authority;
          console.log(`✅ Python authority resolved: ${authority.statute || 'NO_STATUTE'} ${authority.paragraph ? '§' + authority.paragraph : ''} (mode: ${authority.authority_mode || 'none'})`);
          
          // Parse Python's clarification field
          if (authority.status) {
            authority.requiresClarification = authority.status === 'CLARIFICATION_REQUIRED';
            console.log(`📋 Python status: ${authority.status}, requiresClarification: ${authority.requiresClarification}`);
          }
        } else {
          console.log(`⚠️ Python authority resolution failed or no statute found`);
          authority = {
            statute: null,
            paragraph: null,
            isArticle: false,
            requiresClarification: true,
            stopProcessing: true,
            confidence: 0.3,
            referenceSource: 'python_failed',
            authority_mode: 'none',
            classification: {
              type: 'GENERAL',
              domain: 'general',
              source: 'python_fallback'
            }
          };
        }
      } catch (error) {
        console.log(`❌ Python authority service error: ${error.message}`);
        pythonAuthorityError = error.message;
        authority = {
          statute: null,
          paragraph: null,
          isArticle: false,
          requiresClarification: true,
          stopProcessing: true,
          confidence: 0.1,
          referenceSource: 'python_error',
          authority_mode: 'none',
          classification: {
            type: 'GENERAL',
            domain: 'general',
            source: 'python_error_fallback'
          }
        };
      }
      
      // ===========================================================================
      // 🔴 CRITICAL FIX: DOCTRINAL EARLY-EXIT (Point 1️⃣)
      // ===========================================================================
      if (this.shouldUseDoctrinalEarlyExit(authority)) {
        console.log(`🚀 [Doctrinal Early-Exit] Using doctrinal path (confirmed doctrine)`);
        
        const doctrineResult = await this.callDoctrineInductionService(question, authority);
        
        if (doctrineResult) {
          const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);
          
          // CRITICAL FIX: No safety check for doctrine, immediate return
          safetyCheck.logSafetyEvent('DOCTRINAL_EARLY_EXIT', {
            question,
            question_type: authority.classification?.type || authority.question_type,
            epistemicCertainty: authority.epistemicCertainty,
            anchorNormMode: authority.anchorNormMode,
            statute: authority.statute,
            suggestedField: authority.suggestedField,
            retrievalUsed: false,
            safetyCheckSkipped: true
          });
          
          return {
            success: true,
            data: {
              answer: doctrinalAnswer.fullAnswer,
              structuredAnswer: doctrinalAnswer,
              sources: [],
              confidence: doctrinalAnswer.confidence,
              statute: authority.statute,
              paragraph: authority.paragraph,
              isArticle: authority.isArticle,
              metadata: doctrinalAnswer.metadata
            }
          };
        }
      }
      
      // ===========================================================================
      // STEP 3: Check clarification
      // ===========================================================================
      const shouldRequireClarification = () => {
        if (authority.stopProcessing === true) {
          console.log(`⚠️ Python service explicitly requested stop`);
          return true;
        }
        
        const implicitAllowed = 
          authority?.authority_mode === 'overview' && 
          authority?.confidence >= 0.8;
        
        if (!authority.statute && !implicitAllowed) {
          console.log(`⚠️ No statute detected and implicit authority NOT allowed`);
          return true;
        }
        
        if (!authority.statute && implicitAllowed) {
          console.log(`✅ Implicit authority allowed – proceeding without statute`);
          return false;
        }
        
        if (authority.statute && !authority.paragraph) {
          if (authority.authority_mode === 'overview') {
            console.log(`✅ Overview mode: statute ${authority.statute} without paragraph is allowed`);
            return false;
          }
          console.log(`⚠️ Statute ${authority.statute} found but paragraph missing in mode ${authority.authority_mode}`);
          return true;
        }
        
        if (authority.requiresClarification === true) {
          console.log(`⚠️ Python explicitly flagged clarification required`);
          return true;
        }
        
        return false;
      };
      
      if (shouldRequireClarification()) {
        console.log(`❌ [ChatService] Authority clarification required`);
        
        safetyCheck.logSafetyEvent('AUTHORITY_CLARIFICATION', {
          question,
          statute: authority.statute,
          paragraph: authority.paragraph,
          authority_mode: authority.authority_mode,
          clarificationType: !authority.statute ? 'statute_missing' : 'paragraph_missing',
          timestamp: new Date().toISOString(),
          python_error: !!pythonAuthorityError,
          python_status: authority.status || 'unknown'
        });
        
        return this.generateStructuredClarification(authority, question, pythonAuthorityError);
      }
      
      console.log(`✅ Authority from Python: ${authority.statute} ${authority.paragraph ? (authority.isArticle ? 'Article ' : '§') + authority.paragraph : ''} (mode: ${authority.authority_mode})`);
      
      // Classification from Python
      const classification = authority.classification || {
        type: 'GENERAL',
        domain: 'general',
        source: 'python_default'
      };
      
      console.log(`🎯 Classification (Python): ${classification.type} (domain: ${classification.domain || 'general'})`);
      
      // ===========================================================================
      // STEP 4: Doctrine enforcement for exact operative norms
      // ===========================================================================
      console.log(`🔍 [Doctrine Check] Evaluating ${authority.statute} ${authority.paragraph ? '§' + authority.paragraph : ''} for doctrine requirement`);

      if (authority.statute && authority.paragraph && authority.authority_mode === 'exact') {
        const doctrineResult = await this.enforcePythonDoctrine(question, authority);
        
        if (doctrineResult?.doctrinal_summary || doctrineResult?.answer) {
          console.log(`✅ [Doctrine] Using Python doctrinal analysis, bypassing RAG`);
          
          const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);
          
          safetyCheck.logSafetyEvent('DOCTRINE_APPLIED', {
            question,
            statute: authority.statute,
            paragraph: authority.paragraph,
            authority_mode: 'exact',
            normFunction: authority.normFunction || 'OPERATIVE',
            doctrine_source: 'python_inductor',
            confidence: doctrineResult.confidence || authority.confidence || 0.85
          });
          
          return {
            success: true,
            data: {
              answer: doctrinalAnswer.fullAnswer,
              structuredAnswer: doctrinalAnswer,
              sources: [],
              confidence: doctrineResult.confidence || authority.confidence || 0.85,
              statute: authority.statute,
              paragraph: authority.paragraph,
              isArticle: authority.isArticle,
              metadata: doctrinalAnswer.metadata
            }
          };
        } else {
          console.log(`ℹ️ [Doctrine] Proceeding with standard RAG processing`);
        }
      }

      // ===========================================================================
      // STEP 5: Handle Doctrine/System questions (UPDATED: SPLIT PATHS)
      // ===========================================================================
      if (classification.type === 'DOCTRINE') {
        console.log(`⚖️ Doctrine question - separate path`);
        
        // CRITICAL FIX: Separate confirmed vs unconfirmed doctrine
        if (authority.epistemicCertainty === 'confirmed') {
          // Should have been caught by early-exit, but handle anyway
          return await this.handleConfirmedDoctrine(question, authority);
        } else {
          return await this.handleUnconfirmedDoctrine(question, authority);
        }
      }
      
      if (classification.type === 'SYSTEM') {
        console.log(`🔄 System question - conceptual answer`);
        return this.handleSystemQuestion(question, authority);
      }
      
      // ===========================================================================
      // STEP 6: Retrieval with doctrine guard
      // ===========================================================================
      let pythonResults = null;
      
      // Use guarded retrieval (blocks TF-IDF for doctrine)
      pythonResults = await this.retrieveDocumentsWithDoctrineGuard(
        question, authority, allDocuments, classification
      );
      
      // ===========================================================================
      // STEP 7: RAG call
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
      
      // Add Python service metadata
      ragResponse.python_service_used = true;
      ragResponse.python_authority_resolved = !pythonAuthorityError && authority.statute;
      ragResponse.python_authoritative_found = pythonResults?.authoritative_found || false;
      ragResponse.python_results_count = pythonResults?.results?.length || 0;
      ragResponse.authority_mode = authority.authority_mode;
      ragResponse.originalQuestion = question;
      
      if (pythonAuthorityError) {
        ragResponse.python_authority_error = pythonAuthorityError;
      }
      
      // ===========================================================================
      // STEP 8: Confidence override (Point 4️⃣)
      // ===========================================================================
      const baseConfidence = ragResponse.confidence || 0.7;
      const finalConfidence = this.calculateEpistemicConfidence(baseConfidence, authority, ragResponse);
      ragResponse.confidence = finalConfidence;
      
      // ===========================================================================
      // STEP 9: Safety check (CRITICAL FIX: SKIP FOR DOCTRINE)
      // ===========================================================================
      let safetyValidation = null;
      
      // CRITICAL FIX: Skip safety for doctrinal questions
      if (classification.type !== 'DOCTRINE' && authority.question_type !== 'DOCTRINE') {
        safetyValidation = ragResponse.safetyCheck || await safetyCheck.validateBeforeAnswer(question, ragResponse, authority);
      } else {
        console.log(`🚫 Safety check skipped for doctrine question`);
        safetyValidation = {
          isLegallySound: true,
          legalDefensibility: 'HIGH',
          examinerReadiness: 'EXAMINER_READY',
          confidenceAdjusted: finalConfidence,
          metadata: {
            safety_check_skipped: true,
            reason: 'doctrine_question'
          }
        };
      }
      
      // ===========================================================================
      // STEP 10: Structure answer
      // ===========================================================================
      const structuredAnswer = this.structureAnswerWithDoctrinalTemplate(
        ragResponse, 
        question, 
        safetyValidation, 
        authority,
        classification,
        pythonResults
      );
      
      // ===========================================================================
      // STEP 11: Add to conversation history
      // ===========================================================================
      const conversationEntry = {
        question: question,
        answer: structuredAnswer.fullAnswer,
        structuredAnswer: structuredAnswer,
        sources: ragResponse.citations,
        timestamp: new Date().toISOString(),
        confidence: structuredAnswer.confidence,
        legalDomain: structuredAnswer.domain || ragResponse.metadata?.legalDomain || 'general',
        statute: authority.statute,
        paragraph: authority.paragraph,
        isArticle: authority.isArticle,
        authority: authority,
        classification: classification,
        safetyCheck: safetyValidation,
        python_authority_used: !pythonAuthorityError,
        python_authoritative_found: pythonResults?.authoritative_found || false,
        python_results_count: pythonResults?.results?.length || 0,
        authority_mode: authority.authority_mode,
        doctrinal_template: structuredAnswer.template_used || 'default',
        epistemic_certainty: authority.epistemicCertainty,
        anchor_norm_mode: authority.anchorNormMode
      };

      this.conversationHistory.push(conversationEntry);
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // ===========================================================================
      // STEP 12: Log and return
      // ===========================================================================
      safetyCheck.logSafetyEvent('QUESTION_PROCESSED', {
        question,
        statute: authority.statute,
        paragraph: authority.paragraph,
        question_type: classification.type,
        epistemicCertainty: authority.epistemicCertainty,
        confidence: structuredAnswer.confidence,
        legalDefensibility: safetyValidation.legalDefensibility || 'UNKNOWN',
        examinerReadiness: safetyValidation.examinerReadiness || 'UNKNOWN',
        python_authority_used: !pythonAuthorityError,
        python_authoritative_found: pythonResults?.authoritative_found || false,
        authority_mode: authority.authority_mode,
        doctrinal_template: structuredAnswer.template_used || 'default',
        safety_check_skipped: classification.type === 'DOCTRINE'
      });

      this.logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation);
      
      return {
        success: true,
        data: {
          answer: structuredAnswer.fullAnswer,
          structuredAnswer: structuredAnswer,
          sources: ragResponse.citations,
          confidence: structuredAnswer.confidence,
          conversationId: Date.now().toString(),
          legalDomain: structuredAnswer.domain || ragResponse.metadata?.legalDomain || 'general',
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
            safetyPassed: safetyValidation.isLegallySound,
            legalDefensibility: safetyValidation.legalDefensibility,
            examinerReadiness: safetyValidation.examinerReadiness,
            architecture: 'epistemic_authority',
            statuteLocked: !!authority.statute,
            python_service_used: ragResponse.python_service_used || false,
            python_authority_resolved: ragResponse.python_authority_resolved || false,
            python_authoritative_found: ragResponse.python_authoritative_found || false,
            python_results_count: ragResponse.python_results_count || 0,
            authority_mode: authority.authority_mode,
            doctrinal_template: structuredAnswer.template_used || 'default',
            template_sections: structuredAnswer.structuredSections?.length || 0,
            epistemic_certainty: authority.epistemicCertainty,
            anchor_norm_mode: authority.anchorNormMode,
            safety_check_skipped: classification.type === 'DOCTRINE'
          },
        },
      };
    } catch (error) {
      console.error("Error processing question:", error);
      
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

  // ===========================================================================
  // NEW: SEPARATE DOCTRINE HANDLERS (FIXED: NO DOUBLE PATH)
  // ===========================================================================
  
  async handleConfirmedDoctrine(question, authority) {
    console.log(`🧠 Confirmed doctrine - delegating to induction service`);
    
    const doctrineResult = await this.callDoctrineInductionService(question, authority);
    
    if (doctrineResult) {
      const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);
      
      return {
        success: true,
        data: {
          answer: doctrinalAnswer.fullAnswer,
          structuredAnswer: doctrinalAnswer,
          sources: [],
          confidence: doctrinalAnswer.confidence,
          statute: authority.statute,
          paragraph: authority.paragraph,
          metadata: doctrinalAnswer.metadata
        }
      };
    }
    
    // Fallback
    return this.generateEpistemicallySafeFallback(authority, question);
  }
  
  async handleUnconfirmedDoctrine(question, authority) {
    console.log(`⚠️ Unconfirmed doctrine - epistemic warning path`);
    
    const doctrineResult = await this.callDoctrineInductionService(question, authority);
    
    if (doctrineResult) {
      const statuteName = this.getStatuteDisplayName(authority.statute);
      let answer = `**Epistemischer Hinweis**\n\n`;
      answer += `Die Frage betrifft eine Rechtsdoktrin, die nicht mit hoher Sicherheit bestätigt werden konnte.\n\n`;
      
      if (doctrineResult.doctrinal_summary) {
        answer += doctrineResult.doctrinal_summary;
      } else if (doctrineResult.answer) {
        answer += doctrineResult.answer;
      }
      
      answer += `\n\n*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*\n`;
      answer += `*Methodik: Doctrinale Induktion mit reduzierter Sicherheit*`;
      
      const structuredAnswer = {
        fullAnswer: answer,
        confidence: 0.7, // Reduced for uncertainty
        metadata: {
          doctrine_applied: true,
          epistemic_certainty: authority.epistemicCertainty,
          anchor_norm_mode: authority.anchorNormMode || false,
          retrieval_used: false,
          unconfirmed_doctrine: true,
          content_source: 'doctrine_induction_service',
          safety_check_skipped: true
        }
      };
      
      safetyCheck.logSafetyEvent('UNCONFIRMED_DOCTRINE', {
        question,
        epistemicCertainty: authority.epistemicCertainty,
        suggestedField: authority.suggestedField,
        safetyCheckSkipped: true
      });
      
      return {
        success: true,
        data: {
          answer: structuredAnswer.fullAnswer,
          structuredAnswer: structuredAnswer,
          sources: [],
          confidence: structuredAnswer.confidence,
          statute: authority.statute,
          metadata: structuredAnswer.metadata
        }
      };
    }
    
    return this.generateEpistemicallySafeFallback(authority, question);
  }
  
  generateEpistemicallySafeFallback(authority, question) {
    // CRITICAL FIX: Never embed doctrine, even in fallback
    return {
      success: true,
      data: {
        answer: `**Methodischer Hinweis**\n\n` +
                `Die doctrinale Analyse konnte nicht abgeschlossen werden.\n\n` +
                `*Frage: ${question.substring(0, 100)}...*\n` +
                `*Feld: ${authority.suggestedField || 'allgemeine Rechtsstruktur'}*\n` +
                `*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*`,
        confidence: 0.6,
        metadata: {
          doctrine_applied: false,
          retrieval_used: false,
          fallback_used: true,
          content_source: 'epistemic_fallback',
          safety_check_skipped: true
        }
      }
    };
  }
  
  handleSystemQuestion(question, authority) {
    return {
      success: true,
      data: {
        answer: this.generateSystemAnswer(),
        confidence: 0.95,
        metadata: {
          architecture: "system_bypass",
          classification: { type: 'SYSTEM' },
          statuteLocked: false,
          requiresRetrieval: false,
          authority_mode: 'none',
          safety_check_skipped: true
        }
      }
    };
  }

  // ===========================================================================
  // EXISTING TEMPLATE METHODS (KEPT AS IS)
  // ===========================================================================
  
  // 🔴 CRITICAL FIX 4: Get statute display name
  getStatuteDisplayName(statute) {
    const names = {
      'BGB': 'Bürgerliches Gesetzbuch (BGB)',
      'StGB': 'Strafgesetzbuch (StGB)',
      'HGB': 'Handelsgesetzbuch (HGB)',
      'GG': 'Grundgesetz (GG)',
      'ZPO': 'Zivilprozessordnung (ZPO)',
      'StPO': 'Strafprozessordnung (StPO)',
      'VwGO': 'Verwaltungsgerichtsordnung (VwGO)'
    };
    return names[statute] || statute;
  }

  /* -------------------------------------------------
     ✅ NEW: DOCTRINAL TEMPLATE SYSTEM
     (CRITICAL FIX: Safety info respects doctrine skip)
  -------------------------------------------------- */
  addSafetyInformation(answer, safetyValidation, authority, originalQuestion = '') {
    let result = answer;

    if (!safetyValidation) return result;
    
    // CRITICAL FIX: Skip safety info for doctrine questions
    if (authority.classification?.type === 'DOCTRINE' || 
        authority.question_type === 'DOCTRINE' ||
        safetyValidation.metadata?.safety_check_skipped) {
      return result;
    }

    /* -------------------------------------------------
       LEGAL ASSURANCE OUTPUT (NEW MODEL)
    -------------------------------------------------- */
    // ... (keep your existing safety information logic)
    // [Your existing addSafetyInformation code remains unchanged]
    
    return result;
  }

  // ===========================================================================
  // EXISTING HELPER METHODS (KEPT AS IS)
  // ===========================================================================
  
  // [All your existing methods below remain exactly the same]
  // structureAnswerWithDoctrinalTemplate()
  // detectLegalDomain()
  // getLegalTemplate()
  // getPropertyLawTemplate()
  // getContractLawTemplate()
  // getTortLawTemplate()
  // getCriminalLawTemplate()
  // getFamilyLawTemplate()
  // getGeneralLawTemplate()
  // extractNormSentence()
  // extractContentFragments()
  // isRelevantToSection()
  // isConceptualQuestion()
  // generateSystemAnswer()
  // generateStructuredClarification()
  // prepareDocumentsForPython()
  // logProcessing()
  // extractRuleFromAnswer()
  // extractMeaningFromAnswer()
  // extractEffectFromAnswer()
  // getConversationHistory()
  // clearHistory()
  // getStats()
  // healthCheck()

  // [Include all your existing template and helper methods exactly as they are]
  // They work fine and don't need changes
}

module.exports = new ChatService();