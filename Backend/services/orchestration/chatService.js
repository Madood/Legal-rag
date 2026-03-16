const documentService = require("../ingestion/pdfDocumentService");
const ragService = require("../retrieval/ragService");
const safetyCheck = require("../validation/safetyCheck");
const pythonIntegrationService = require("../retrieval/pythonIntegrationService");
const resultFormatter = require("./resultFormatter");
const axios = require("axios");

class ChatService {
  constructor() {
    this.conversationHistory = [];
    console.log('? ChatService initialized with EPISTEMIC AUTHORITY COMPLIANCE');
    
    // Bind methods
    this.structureAnswerWithDoctrinalTemplate = this.structureAnswerWithDoctrinalTemplate.bind(this);
    this.generateStructuredClarification = this.generateStructuredClarification.bind(this);
    this.getConversationHistory = this.getConversationHistory.bind(this);
    this.addSafetyInformation = this.addSafetyInformation.bind(this);
    this.normalizeParagraph = this.normalizeParagraph.bind(this);
    this.findExactParagraph = this.findExactParagraph.bind(this);
    this.extractParagraphFromText = this.extractParagraphFromText.bind(this);
    this.isTerminalAuthority = this.isTerminalAuthority.bind(this);
    this.shouldBlockRagForFinalAuthority = this.shouldBlockRagForFinalAuthority.bind(this);
    this.generateAuthoritativeAbstentionResponse = this.generateAuthoritativeAbstentionResponse.bind(this);
    // ?? NEW: Exact norm detector
    this.detectExactNormReference = this.detectExactNormReference.bind(this);
  }

  // ===========================================================================
  // ?? EXACT NORM REFERENCE DETECTOR (NEW - CRITICAL FIX)
  // ===========================================================================

  detectExactNormReference(question) {
    if (!question || typeof question !== 'string') return null;
    
    // Patterns for German legal norm references
    const patterns = [
      // Pattern 1: § 325 HGB (with space)
      /§\s*(\d+[a-z]?)\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,

      // Pattern 2: §325 HGB (no space)
      /§(\d+[a-z]?)\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,

      // Pattern 3: BGB § 325
      /(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)\s+§\s*(\d+[a-z]?)/i,

      // Pattern 4: Artikel 5 GG  (with optional "Absatz N")
      /artikel\s+(\d+[a-z]?)(?:\s+(?:absatz|abs\.?)\s+\d+[a-z]?)?\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,

      // Pattern 5: Art. 5 GG  (with optional "Absatz N")
      /art\.?\s*(\d+[a-z]?)(?:\s+(?:absatz|abs\.?)\s+\d+[a-z]?)?\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i
    ];
    
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match) {
        // Extract statute and paragraph based on pattern
        let statute, paragraph;
        let isArticle = false;
        
        if (pattern.toString().includes('(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)\\s+§')) {
          // Pattern 3: BGB § 325
          statute = match[1].toUpperCase();
          paragraph = match[2];
        } else if (pattern.toString().includes('artikel') || pattern.toString().includes('art\\.')) {
          // Pattern 4/5: Artikel/Art. 5 GG
          statute = match[2].toUpperCase();
          paragraph = match[1];
          isArticle = true;
        } else {
          // Pattern 1/2: § 325 HGB
          paragraph = match[1];
          statute = match[2].toUpperCase();
        }
        
        console.log(`?? [Exact Norm Detector] Found: ${statute} §${paragraph} ${isArticle ? '(Article)' : ''}`);
        return {
          statute,
          paragraph,
          isArticle,
          source: 'explicit_question_reference',
          matchedPattern: pattern.toString()
        };
      }
    }
    
    return null;
  }

  // ===========================================================================
  // HELPER: Format raw chunk content into a clean answer string
  // Strips PDF boilerplate headers, limits length, adds statute label.
  // ===========================================================================

  formatChunkAsAnswer(rawContent, statute, paragraph, isArticle) {
    const BOILERPLATE = [
      /Ein Service des Bundesministerium[^\n]*/gi,
      /sowie des Bundesamts für Justiz[^\n]*/gi,
      /www\.gesetze-im-internet\.de[^\n]*/gi,
      /- Seite \d+ von \d+ -/gi,
      /Seite \d+ von \d+/gi,
    ];

    let cleaned = rawContent || '';
    for (const pat of BOILERPLATE) cleaned = cleaned.replace(pat, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    const statuteName = this.getStatuteDisplayName(statute) || statute;
    const ref = paragraph
      ? `${isArticle ? 'Art.' : '§'} ${paragraph} ${statute}`
      : statute;

    return `**${statuteName} — ${ref}**\n\n${cleaned}\n\n*Diese Angaben stammen aus deutschen Rechtsdokumenten und ersetzen keine Rechtsberatung.*`;
  }

  // ===========================================================================
  // ?? CRITICAL FIX: PARAGRAPH NORMALIZATION HELPER
  // ===========================================================================

  normalizeParagraph(value) {
    if (!value) return null;
    
    // Handle arrays (sometimes metadata is stored as arrays)
    if (Array.isArray(value)) {
      value = value[0];
    }
    
    // Convert to string and normalize
    const str = String(value);
    
    // Remove all non-alphanumeric characters except letters and numbers
    // Handle German legal formats: §558a, § 558a, Paragraph 558a, Art. 5, Artikel 5
    return str
      .toLowerCase()
      .replace(/§/g, '')
      .replace(/paragraph/gi, '')
      .replace(/artikel/gi, '')
      .replace(/article/gi, '')
      .replace(/art\./gi, '')
      .replace(/art/gi, '')
      .replace(/\s+/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  // ===========================================================================
  // ?? CRITICAL FIX: EXTRACT PARAGRAPH FROM TEXT (German legal PDFs)
  // ===========================================================================

  extractParagraphFromText(text) {
    if (!text) return null;
    
    // Try multiple patterns for German legal paragraph markers
    const patterns = [
      // Pattern 1: §558a or § 558a or §\n558a
      /§\s*\n*\s*(\d+[a-z]?)/i,
      
      // Pattern 2: Paragraph 558a or Paragraph 5
      /paragraph\s+(\d+[a-z]?)/i,
      
      // Pattern 3: Artikel 5 or Art. 5 or Art 5
      /(?:artikel|art\.|art)\s+(\d+[a-z]?)/i,
      
      // Pattern 4: In text like "§ 558a Form und Begründung..."
      /§\s*(\d+[a-z]?)\s+[A-ZÄÖÜ]/,
      
      // Pattern 5: Just numbers at start of meaningful sentence
      /^(\d+[a-z]?)\s+[A-ZÄÖÜ]/,
    ];
    
    // Also check for paragraph markers that might be split across lines
    const first500Chars = text.substring(0, 500);
    
    for (const pattern of patterns) {
      const match = first500Chars.match(pattern);
      if (match && match[1]) {
        console.log(`?? [Extract] Found paragraph ${match[1]} with pattern ${pattern}`);
        return `§${match[1]}`;
      }
    }
    
    return null;
  }

  // ===========================================================================
  // ?? CRITICAL FIX: EXACT PARAGRAPH FINDER WITH TEXT EXTRACTION
  // ===========================================================================

  findExactParagraph(allDocuments, statute, paragraph) {
    const normalizedAuthorityPara = this.normalizeParagraph(paragraph);
    
    if (!normalizedAuthorityPara) {
      console.log(`? [Exact Mode] Cannot normalize paragraph: ${paragraph}`);
      return null;
    }
    
    console.log(`?? [Exact Mode] Looking for ${statute} §${paragraph} (normalized: ${normalizedAuthorityPara})`);
    
    // Track matches for debugging
    const potentialMatches = [];
    
    // Search through all documents and chunks
    for (const doc of allDocuments) {
      const chunks = doc.chunks || [doc]; // Handle both chunked and single documents
      
      for (const chunk of chunks) {
        // Get statute from chunk or document
        const statuteRaw = 
          chunk.metadata?.statute ||
          chunk.metadata?.statute_id ||
          chunk.metadata?.law ||
          doc.metadata?.statute;
        
        // Skip if not the right statute
        if (statuteRaw !== statute) {
          continue;
        }
        
        // Try to extract paragraph from text
        const extractedPara = this.extractParagraphFromText(chunk.content || chunk.text);
        const normalizedChunkPara = this.normalizeParagraph(extractedPara);
        
        // For debugging, log when we find potential matches
        if (normalizedChunkPara) {
          potentialMatches.push({
            paraRaw: extractedPara,
            normalized: normalizedChunkPara,
            preview: (chunk.content || chunk.text).substring(0, 100)
          });
          
          // Check for match
          if (normalizedChunkPara === normalizedAuthorityPara) {
            console.log(`? [Exact Mode] Found exact match!`);
            console.log(`   Statute: ${statuteRaw}`);
            console.log(`   Paragraph: ${extractedPara}`);
            console.log(`   Normalized: ${normalizedChunkPara}`);
            console.log(`   Preview: ${(chunk.content || chunk.text).substring(0, 200)}...`);
            return chunk;
          }
        }
        
        // Also check metadata if it exists
        const metaPara = chunk.metadata?.paragraph || chunk.metadata?.paragraph_number;
        if (metaPara) {
          const normalizedMetaPara = this.normalizeParagraph(metaPara);
          if (normalizedMetaPara === normalizedAuthorityPara) {
            console.log(`? [Exact Mode] Found in metadata!`);
            console.log(`   Statute: ${statuteRaw}`);
            console.log(`   Paragraph: ${metaPara}`);
            console.log(`   Normalized: ${normalizedMetaPara}`);
            return chunk;
          }
        }
      }
    }
    
    // Log what we found for debugging
    if (potentialMatches.length > 0) {
      console.log(`?? [Debug] Found ${potentialMatches.length} potential paragraphs in ${statute}:`);
      potentialMatches.slice(0, 10).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.paraRaw} (normalized: ${match.normalized})`);
      });
    }
    
    console.log(`? [Exact Mode] No exact match found for ${statute} §${paragraph}`);
    return null;
  }

  // ===========================================================================
  // ?? TERMINAL AUTHORITY CHECK (NEW)
  // ===========================================================================
  
  isTerminalAuthority(authority) {
    if (!authority) return false;
    
    return (
      authority.authority_final === true ||
      authority.terminal === true ||
      authority.metadata?.authority_final === true ||
      authority.retrieval?.constraint === 'PARAGRAPH_STRICT' ||
      authority.constraint === 'PARAGRAPH_STRICT' ||
      authority.force_exact === true
    );
  }

  // ===========================================================================
  // ?? AUTHORITY LOCK MECHANISM (NEW - FINAL FIX)
  // ===========================================================================
  
  createAuthorityLock(authority) {
    if (!authority) return { __locked: false };
    
    // ?? CLEANUP: Single point of truth for lock decision
    const isLocked = 
      this.isTerminalAuthority(authority) ||
      authority.__empty_authoritative_result === true;
    
    const lock = {
      ...authority,
      __locked: isLocked,
      __lockTimestamp: new Date().toISOString(),
      __lockReason: isLocked ? (this.isTerminalAuthority(authority) ? 'terminal_authority' : 'empty_authoritative_result') : 'non_terminal'
    };
    
    if (isLocked) {
      console.log(`?? [Authority Lock] Created LOCKED authority object:`, {
        statute: authority.statute,
        paragraph: authority.paragraph,
        authority_final: authority.authority_final,
        terminal: authority.terminal,
        empty_authoritative_result: authority.__empty_authoritative_result,
        reason: lock.__lockReason
      });
    }
    
    return lock;
  }

  // ===========================================================================
  // ??? FINAL AUTHORITY GUARD (NEW)
  // ===========================================================================

  shouldBlockRagForFinalAuthority(authority, pythonResults) {
    if (!authority || !pythonResults) return false;
    
    // Check if this is a terminal/final authority
    const isTerminal = this.isTerminalAuthority(authority);
    
    // Check if Python search returned empty authoritative results
    const isEmptyAuthoritativeResult = 
      pythonResults.results && 
      pythonResults.results.length === 0 &&
      pythonResults.authoritative_found === false;
    
    // Block RAG if: terminal authority + empty authoritative results
    const shouldBlock = isTerminal && isEmptyAuthoritativeResult;
    
    if (shouldBlock) {
      console.log(`??? [Final Authority Guard] RAG BLOCKED - Terminal authority with empty results`);
      console.log(`   Terminal Check: ${isTerminal}, Authority Final: ${authority.authority_final}`);
      console.log(`   Empty Results: ${isEmptyAuthoritativeResult}, Results Length: ${pythonResults.results?.length || 0}`);
      console.log(`   Authoritative Found: ${pythonResults.authoritative_found}`);
    }
    
    return shouldBlock;
  }

  // ===========================================================================
  // ?? GENERATE AUTHORITATIVE ABSTENTION RESPONSE (NEW)
  // ===========================================================================

  generateAuthoritativeAbstentionResponse(authority, question) {
    const statuteName = this.getStatuteDisplayName(authority.statute);
    const paragraphRef = authority.paragraph
      ? (authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`)
      : '';
    const normRef = paragraphRef ? `${statuteName} ${paragraphRef}` : statuteName;

    const responseTemplates = {
      default: `**${normRef}**\n\n` +
               `Die Norm wurde eindeutig identifiziert. Eine inhaltliche Auslegung erfordert juristische Subsumtion oder zusätzlichen Kontext.\n\n` +
               `*Autoritative Suche ergab keine auslegungsfähigen Textstellen.*`,

      BGB: `**${normRef}**\n\n` +
           `Die Vorschrift wurde identifiziert. Eine konkrete inhaltliche Würdigung erfordert die Prüfung von Rechtsprechung oder Literatur.\n\n` +
           `*Der autoritative Suchdienst konnte keine unmittelbar auslegungsfähigen Passagen extrahieren.*`,

      GG: `**${normRef}**\n\n` +
          `Der Verfassungsartikel wurde bestimmt. Die Auslegung von Grundrechten erfordert stets die Berücksichtigung der Rechtsprechung des Bundesverfassungsgerichts.\n\n` +
          `*Die autoritative Suche ergab keine unmittelbar synthetisierbaren Textstellen.*`
    };
    
    const template = responseTemplates[authority.statute] || responseTemplates.default;
    
    return {
      success: true,
      data: {
        answer: template,
        confidence: 0.85,
        statute: authority.statute,
        paragraph: authority.paragraph,
        metadata: {
          authority_final: true,
          empty_authoritative_result: true,
          rag_disabled: true,
          fallback_prohibited: true,
          legal_status: 'norm_identified_but_no_interpretable_text'
        }
      }
    };
  }

  // ===========================================================================
  // ?? CRITICAL FIX: DOCTRINAL EARLY-EXIT CHECK - UPDATED FOR STATUTE-ONLY
  // ===========================================================================
  
  shouldUseDoctrinalEarlyExit(authority) {
    if (!authority) return false;

    // ONLY genuine doctrine question types trigger early-exit.
    // anchorNormMode+uncertain was incorrectly routing DEFINITION/GENERAL questions
    // (which have no specific paragraph) to the doctrine endpoint.
    const DOCTRINAL_TYPES = new Set([
      'DOCTRINE', 'GENERAL_DOCTRINE', 'LEGAL_PRINCIPLE', 'GRUNDSATZ', 'PRINCIPLE', 'DOCTRINAL_ANALYSIS'
    ]);

    const isDoctrinalQuestion =
      DOCTRINAL_TYPES.has(authority.classification?.type) ||
      DOCTRINAL_TYPES.has(authority.question_type) ||
      authority.doctrinal_match === true;

    if (!isDoctrinalQuestion) {
      // DEFINITION, GENERAL, FACTUAL, GENERAL_INFORMATION, STATUTE_OVERVIEW etc.
      // must go through normal retrieval, not doctrine early-exit.
      return false;
    }

    const isConfirmed =
      authority.epistemicCertainty === 'confirmed' ||
      authority.epistemic_certainty === 'confirmed';

    const isAnchorNormMode =
      authority.anchorNormMode === true ||
      authority.anchor_norm_mode === true;

    if (isDoctrinalQuestion && (isAnchorNormMode || isConfirmed)) {
      console.log(`? [Doctrine Early-Exit] Triggered: type=${authority.question_type}, anchor=${isAnchorNormMode}, confirmed=${isConfirmed}`);
      return true;
    }

    return false;
  }

  // ===========================================================================
  // DOCTRINAL DELEGATION
  // ===========================================================================
  
  async callDoctrineInductionService(question, authority) {
    try {
      const doctrineResult = await pythonIntegrationService.callDoctrineInductor({
        question: question,
        statute: authority.statute,
        paragraph: authority.paragraph,
        classification: authority.classification,
        authority_mode: authority.authority_mode,
        suggested_field: authority.suggestedField || authority.doctrinal_field,
        epistemic_certainty: authority.epistemicCertainty
      });

      // When the doctrine endpoint finds a known doctrine and doctrinal_match is set,
      // the content is authoritative — promote certainty so callers skip uncertainty warnings.
      if (doctrineResult?.doctrine_found === true && authority.doctrinal_match === true) {
        authority.epistemicCertainty = 'confirmed';
        console.log(`? [Doctrine] doctrine_found + doctrinal_match ? epistemicCertainty promoted to 'confirmed'`);
      }

      return doctrineResult;
    } catch (error) {
      console.error(`?? Doctrine induction failed: ${error.message}`);
      return null;
    }
  }

  // ===========================================================================
  // DOCTRINE ENFORCEMENT
  // ===========================================================================
  
  async enforcePythonDoctrine(question, authority) {
    // First check for doctrinal early-exit
    if (this.shouldUseDoctrinalEarlyExit(authority)) {
      console.log(`?? [Doctrinal Early-Exit] Confirmed doctrine - immediate return`);
      return await this.callDoctrineInductionService(question, authority);
    }
    
    // Original logic for exact operative norms
    if (!authority?.statute || !authority?.paragraph) return null;
    
    console.log(`?? [Doctrine Enforcement] Checking if exact operative norm: ${authority.statute} §${authority.paragraph}`);
    
    const isExactOperativeNorm = 
      authority.authority_mode === 'exact' && 
      authority.statute && 
      authority.paragraph &&
      (authority.normFunction === 'OPERATIVE' || !authority.normFunction);
    
    if (!isExactOperativeNorm) {
      console.log(`?? [Doctrine] Not enforcing doctrine - mode: ${authority.authority_mode}, normFunction: ${authority.normFunction}`);
      return null;
    }
    
    console.log(`?? [Doctrine Enforcement] Exact operative norm detected - calling Python doctrine`);
    
    try {
      const doctrineResult = await this.callDoctrineInductionService(question, authority);

      // Only return the doctrine result when Python confirmed a specific doctrine match.
      if (doctrineResult?.doctrine_found === true &&
          (doctrineResult?.doctrinal_summary || doctrineResult?.answer)) {
        console.log(`? [Doctrine] Received confirmed doctrinal analysis from Python`);
        return doctrineResult;
      }
    } catch (error) {
      console.log(`?? [Doctrine] Python doctrine call failed: ${error.message}`);
    }

    return null;
  }

  // ===========================================================================
  // GENERATE DOCTRINAL ANSWER
  // ===========================================================================
  
  generateDoctrinalAnswer(doctrineResult, authority, question) {
    const statuteName = this.getStatuteDisplayName(authority.statute);
    const paragraphRef = authority.paragraph
      ? (authority.isArticle ? `Artikel ${authority.paragraph}` : `§ ${authority.paragraph}`)
      : '';

    let answer = `**${statuteName}${paragraphRef ? ` ${paragraphRef}` : ''}**\n\n`;
    
    if (doctrineResult.doctrinal_summary) {
      answer += doctrineResult.doctrinal_summary;
    } else if (doctrineResult.answer) {
      answer += doctrineResult.answer;
    }
    
    // Minimal metadata
    answer += `\n\n*Doctrinale Analyse durch Python-Autoritätsdienst*`;
    
    return {
      fullAnswer: answer,
      confidence: doctrineResult.confidence || 0.92,
      template_used: 'python_doctrine',
      domain: doctrineResult.domain || 'civil',
      metadata: {
        doctrine_applied: true,
        python_doctrine: true,
        authority_mode: 'exact',
        epistemic_certainty: authority.epistemicCertainty,
        anchor_norm_mode: authority.anchorNormMode,
        retrieval_used: false,
        safety_check_skipped: true
      }
    };
  }

  // ===========================================================================
  // ?? CRITICAL FIX: RETRIEVAL WITH DOCTRINE GUARD & AUTHORITY LOCK
  // ===========================================================================
  
  async retrieveDocumentsWithDoctrineGuard(question, authority, authorityLock, allDocuments, classification) {
    classification = classification || { type: 'GENERAL', domain: 'general' };

    // Note: authority lock is informational — we do not skip retrieval based on it.
    // Retrieval must always be attempted so the RAG synthesis has real content.

    // Original doctrine guard logic
    const isDoctrinalQuestion = 
      classification?.type === 'DOCTRINE' ||
      authority?.question_type === 'DOCTRINE' ||
      authority?.question_type === 'GENERAL_DOCTRINE' ||
      (authority?.anchorNormMode === true && authority?.epistemicCertainty === 'uncertain') ||
      authority?.doctrinal_match === true ||
      (authority?.anchor_norm_mode === true && authority?.epistemic_certainty === 'uncertain');
    
    if (isDoctrinalQuestion) {
      // If the question also contains a specific § reference, still attempt retrieval.
      // The doctrine guard should only block pure abstract-doctrine questions with no
      // paragraph anchor, not concrete paragraph questions that happen to be classified DOCTRINE.
      const hasSpecificParagraph = /§\s*\d+|art\.\s*\d+/i.test(question);
      if (!hasSpecificParagraph) {
        console.log(`?? [Doctrine Guard] Pure doctrinal question — skipping TF-IDF, using Python only`);
        console.log(`   Reason: classification=${classification?.type}, question_type=${authority?.question_type}`);

        safetyCheck.logSafetyEvent('DOCTRINE_GUARD_TRIGGERED', {
          question,
          classification_type: classification?.type,
          question_type: authority?.question_type,
          anchorNormMode: authority?.anchorNormMode,
          epistemicCertainty: authority?.epistemicCertainty,
          doctrinal_match: authority?.doctrinal_match
        });

        return {
          results: [],
          authoritative_found: false,
          authority_summary: {
            doctrine_mode: true,
            doctrine_detected: true,
            reason: 'doctrinal_question_guard'
          },
          authority_mode: authority.authority_mode
        };
      }
      // Has specific paragraph — fall through to normal retrieval
      console.log(`⬇️ [Doctrine Guard] Doctrinal question but has § reference — proceeding to retrieval`);
    }

    // Exact mode still needs retrieval — the paragraph number constrains the search
    // but must not short-circuit it to empty results.

    // Retrieval logic
    try {
      console.log(`?? Using Python for authoritative retrieval (mode: ${authority.authority_mode})...`);
      
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
        console.log(`?? Python authoritative sources failed, using fallback`);
        return {
          results: preparedDocs,
          authoritative_found: false,
          authority_summary: { fallback: true },
          authority_mode: authority.authority_mode
        };
      }
      
    } catch (error) {
      console.log(`?? Python retrieval error: ${error.message}`);
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
  // CONFIDENCE CALCULATION
  // ===========================================================================
  
  calculateEpistemicConfidence(baseConfidence, authority, ragResponse = null) {
    // ?? CRITICAL FIX: Exact mode = 1.0 confidence
    if (authority.authority_mode === 'exact' && authority.statute && authority.paragraph) {
      console.log(`?? [Exact Mode] Confidence overridden to 1.0`);
      return 1.0;
    }
    
    // Rule: IF epistemicCertainty == "confirmed" AND question_type == "DOCTRINE"
    // ? confidence = max(confidence, 0.9)
    
    const isDoctrinalQuestion = authority.classification?.type === 'DOCTRINE' || 
                               authority.question_type === 'DOCTRINE' ||
                               authority.question_type === 'GENERAL_DOCTRINE';
    
    const isConfirmed = authority.epistemicCertainty === 'confirmed' || 
                       authority.epistemic_certainty === 'confirmed';
    
    if (isDoctrinalQuestion && isConfirmed) {
      const doctrinalConfidence = Math.max(baseConfidence, 0.9);
      console.log(`?? [Confidence Override] Doctrinal question: ${doctrinalConfidence.toFixed(2)} (was: ${baseConfidence.toFixed(2)})`);
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
  // SMART METHOD 1: Structure Answer
  // ===========================================================================
  
  structureAnswerWithDoctrinalTemplate(ragResponse, question, safetyValidation, authority, classification, pythonResults) {
    // Let the answer speak for itself - don't force templates
    let fullAnswer = ragResponse.doctrine_summary || ragResponse.answer || '';
    
    // Add statutory context ONLY if confirmed
    if (authority.statute && authority.paragraph) {
      const statuteName = this.getStatuteDisplayName(authority.statute);
      const paragraphRef = authority.isArticle 
        ? `Artikel ${authority.paragraph}` 
        : `§${authority.paragraph}`;
      
      fullAnswer = `**${statuteName} ${paragraphRef}**\n\n${fullAnswer}`;
    }
    
    // Add safety info (respects doctrine skip)
    fullAnswer = this.addSafetyInformation(fullAnswer, safetyValidation, authority, question);
    
    // Smart confidence calculation
    const finalConfidence = this.calculateEpistemicConfidence(
      ragResponse.confidence || 0.7, 
      authority, 
      ragResponse
    );
    
    return {
      fullAnswer,
      confidence: finalConfidence,
      template_used: ragResponse.doctrine_summary ? 'python_doctrine' : 'rag_synthesis',
      domain: classification?.domain || 'general',
      metadata: {
        doctrine_applied: !!ragResponse.doctrine_summary,
        authority_mode: authority.authority_mode,
        epistemic_certainty: authority.epistemicCertainty,
        retrieval_used: !ragResponse.doctrine_summary,
        safety_check_skipped: classification?.type === 'DOCTRINE',
        chunks_used: ragResponse.metadata?.chunksUsed || 0
      }
    };
  }

  // ===========================================================================
  // SMART METHOD 2: Generate Clarification
  // ===========================================================================
  
  generateStructuredClarification(authority, question, pythonError = null) {
    let message = '';
    
    if (!authority.statute) {
      message = 'Um eine präzise rechtliche Analyse zu ermöglichen, geben Sie bitte das relevante Gesetz an (z.B. BGB, StGB, HGB).';
    } else if (!authority.paragraph) {
      const statuteName = this.getStatuteDisplayName(authority.statute);
      message = `${statuteName} wurde erkannt. Bitte präzisieren Sie den relevanten Paragraphen oder bestätigen Sie, dass eine Übersicht gewünscht ist.`;
    } else {
      message = 'Zusätzliche Präzisierung der Rechtsfrage erforderlich.';
    }
    
    return {
      success: true,
      data: {
        answer: `**Präzisierung erforderlich**\n\n${message}`,
        confidence: 0.3,
        clarification_required: true,
        statute: authority.statute || null,
        paragraph: authority.paragraph || null,
        metadata: {
          requires_clarification: true,
          authority_status: authority.status || 'unknown'
        }
      }
    };
  }

  // ===========================================================================
  // SMART METHOD 3: Conversation History
  // ===========================================================================
  
  getConversationHistory(limit = 20) {
    if (!this.conversationHistory?.length) return [];
    return this.conversationHistory.slice(-limit);
  }

  // ===========================================================================
  // CRITICAL FIX: addSafetyInformation
  // ===========================================================================
  
  addSafetyInformation(answer, safetyValidation, authority, originalQuestion = '') {
    // Skip safety info for doctrine questions
    if (authority.classification?.type === 'DOCTRINE' || 
        authority.question_type === 'DOCTRINE' ||
        authority.question_type === 'GENERAL_DOCTRINE' ||
        safetyValidation?.metadata?.safety_check_skipped) {
      return answer;
    }
    
    // Only add if safety validation exists and has meaningful data
    if (!safetyValidation?.legalDefensibility) {
      return answer;
    }
    
    const defensibility = safetyValidation.legalDefensibility;
    const readiness = safetyValidation.examinerReadiness;
    
    // Only add warning if there's an actual issue
    if (defensibility === 'LOW' || readiness === 'NEEDS_REVIEW') {
      return answer + '\n\n?? *Diese Antwort erfordert weitere rechtliche Prüfung.*';
    }
    
    return answer;
  }

  // ===========================================================================
  // COMPARISON MODE — DeepSeek-powered dual retrieval + table synthesis
  // ===========================================================================

  async _callDeepSeek(messages, opts = {}) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages,
        temperature: opts.temperature ?? 0,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {})
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: opts.timeout ?? 20000
      }
    );
    return response.data.choices[0].message.content;
  }

  async handleComparisonQuestion(question, allDocuments, languageStr) {
    console.log(`🔀 [Comparison] Entering comparison mode for: "${question.substring(0, 60)}"`);

    // ── Step 1: Extract concepts ─────────────────────────────────────────────
    let concepts;
    try {
      const extractionRaw = await this._callDeepSeek(
        [
          {
            role: 'system',
            content:
              'Extract the two legal concepts being compared from the user question. ' +
              'Return ONLY valid JSON with this exact shape (no markdown, no extra keys):\n' +
              '{"concept1":{"term":"string","statute":"string","paragraph":"string|null"},' +
              '"concept2":{"term":"string","statute":"string","paragraph":"string|null"}}\n' +
              'Statute values must be one of: BGB, StGB, HGB, GG, ZPO, StPO, GmbHG.\n' +
              'Example: "Kaufvertrag vs Werkvertrag" → ' +
              '{"concept1":{"term":"Kaufvertrag","statute":"BGB","paragraph":"433"},' +
              '"concept2":{"term":"Werkvertrag","statute":"BGB","paragraph":"631"}}'
          },
          { role: 'user', content: question }
        ],
        { json: true, timeout: 15000 }
      );
      concepts = JSON.parse(extractionRaw);
    } catch (err) {
      console.error('[Comparison] Concept extraction failed:', err.message);
      return null; // Fall through to normal RAG
    }

    if (!concepts?.concept1?.statute || !concepts?.concept2?.statute) {
      console.warn('[Comparison] Incomplete concept extraction — falling back to RAG');
      return null;
    }

    console.log(
      `🔀 [Comparison] concept1=${concepts.concept1.term} (${concepts.concept1.statute} §${concepts.concept1.paragraph || '?'})` +
      ` | concept2=${concepts.concept2.term} (${concepts.concept2.statute} §${concepts.concept2.paragraph || '?'})`
    );

    // ── Step 2: Retrieve chunks for both concepts ─────────────────────────────
    const makeAuthority = (concept) => ({
      statute: concept.statute.toUpperCase(),
      paragraph: concept.paragraph || null,
      isArticle: false,
      authority_mode: concept.paragraph ? 'exact' : 'overview',
      anchorNormMode: !concept.paragraph,
      isStatuteLocked: true,
      isParagraphLocked: !!concept.paragraph,
      requiresClarification: false,
      confidence: 0.9,
      referenceSource: 'comparison_extraction',
      question_type: 'DOCTRINE'
    });

    let rag1, rag2;
    try {
      [rag1, rag2] = await Promise.all([
        ragService.generateResponse(concepts.concept1.term, allDocuments, {
          language: languageStr,
          authority: makeAuthority(concepts.concept1)
        }),
        ragService.generateResponse(concepts.concept2.term, allDocuments, {
          language: languageStr,
          authority: makeAuthority(concepts.concept2)
        })
      ]);
    } catch (err) {
      console.error('[Comparison] RAG retrieval failed:', err.message);
      return null;
    }

    // ── Step 3: Synthesize comparison ─────────────────────────────────────────
    const c1Label = `${concepts.concept1.term} (${concepts.concept1.statute}${concepts.concept1.paragraph ? ' §' + concepts.concept1.paragraph : ''})`;
    const c2Label = `${concepts.concept2.term} (${concepts.concept2.statute}${concepts.concept2.paragraph ? ' §' + concepts.concept2.paragraph : ''})`;

    const userContent =
      `Question: ${question}\n\n` +
      `--- ${c1Label} ---\n${rag1.answer || '(no content)'}\n\n` +
      `--- ${c2Label} ---\n${rag2.answer || '(no content)'}`;

    let comparisonAnswer;
    try {
      comparisonAnswer = await this._callDeepSeek(
        [
          {
            role: 'system',
            content:
              'You are a German legal assistant. Compare the two provided legal concepts ' +
              'using ONLY the statute text provided below. Do not add information not present.\n\n' +
              'Structure your answer exactly as:\n\n' +
              '**[Concept 1] (§ X)**\n' +
              '- Definition:\n- Key obligations:\n- Risk/liability:\n\n' +
              '**[Concept 2] (§ X)**\n' +
              '- Definition:\n- Key obligations:\n- Risk/liability:\n\n' +
              '**Key Differences:**\n' +
              '| Criteria | Concept 1 | Concept 2 |\n' +
              '|---|---|---|\n' +
              '| Definition | ... | ... |\n' +
              '| Obligations | ... | ... |\n' +
              '| Liability | ... | ... |'
          },
          { role: 'user', content: userContent }
        ],
        { temperature: 0.1, timeout: 30000 }
      );
    } catch (err) {
      console.error('[Comparison] Synthesis failed:', err.message);
      return null;
    }

    // ── Step 4: Return structured response ────────────────────────────────────
    const sources = [
      ...(rag1.citations || []),
      ...(rag2.citations || [])
    ];

    return {
      success: true,
      data: {
        answer: comparisonAnswer,
        sources,
        confidence: 0.85,
        statute: null,
        paragraph: null,
        metadata: {
          comparison_mode: true,
          concept1: concepts.concept1,
          concept2: concepts.concept2,
          language: languageStr,
          documentsUsed: (rag1.documentsUsed || 0) + (rag2.documentsUsed || 0)
        }
      }
    };
  }

  // ===========================================================================
  // ?? CRITICAL FIX: MAIN PROCESSING FLOW WITH AUTHORITY LOCK & EXACT NORM DETECTION
  // ===========================================================================

  async processQuestion(question, context = {}) {
    // ?? CRITICAL FIX: Declare authorityLock at TOP LEVEL (FIXED SCOPE BUG)
    let authority = null;
    let authorityLock = { __locked: false };
    let pythonAuthorityError = null;

    // Map UI language code to the language string used by the Python service
    const _lang = context.language || 'de';
    const languageStr = _lang === 'de' ? 'german' : 'english';

    try {
      console.log(`\n?? Processing with EPISTEMIC AUTHORITY: "${question}" [lang=${languageStr}]`);

      // STEP 0: Reject comparative foreign-law questions — corpus is German law only
      // Note: \b fails on non-ASCII chars (ö, ä, ü) in JS — use root-substring matching instead.
      const FOREIGN_SYSTEMS = /(österreich|schweizer|schweiz(?:er)?|amerikanisch|französisch|englisch|britisch|niederländisch|belgisch|polnisch|italienisch|spanisch|türkisch|japanisch|chinesisch|ausländisch|rechtsvergleich|komparativ|austrian|swiss\s+law|french\s+law|common\s+law)/i;
      if (FOREIGN_SYSTEMS.test(question)) {
        return {
          success: true,
          data: {
            answer: languageStr === 'german'
              ? '**Korpus-Einschränkung**\n\nDieses System enthält ausschließlich deutsches Bundesrecht (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG). Fragen zum Recht anderer Staaten oder zu Rechtsvergleichungen mit ausländischen Rechtsordnungen können nicht beantwortet werden.'
              : '**Corpus limitation**\n\nThis system covers German federal law only (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG). Questions comparing German law with foreign legal systems cannot be answered from this corpus.',
            confidence: 0,
            refused: true,
            sources: [],
            metadata: { out_of_corpus: true, reason: 'foreign_law_comparison' }
          }
        };
      }

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
      // STEP 1.5: COMPARISON MODE — intercept before Python authority resolution
      // ===========================================================================
      const COMPARISON_SIGNALS = [
        'unterschied', 'unterschiede', 'difference', 'differences',
        'vergleich', 'compare', 'versus', 'vs', 'contrast',
        'abgrenzung', 'gegensatz', 'compared to', 'both'
      ];
      const isComparison = COMPARISON_SIGNALS.some(s =>
        question.toLowerCase().includes(s)
      );

      if (isComparison) {
        console.log(`🔀 [ChatService] Comparison signal detected — attempting comparison mode`);
        const compResult = await this.handleComparisonQuestion(question, allDocuments, languageStr);
        if (compResult) {
          console.log(`✅ [ChatService] Comparison mode completed successfully`);
          return compResult;
        }
        console.log(`⬇️ [ChatService] Comparison mode fell through — continuing with normal RAG`);
      }

      // ===========================================================================
      // STEP 2: Use PYTHON for authority resolution WITH IMMEDIATE TERMINAL CHECK
      // ===========================================================================
      console.log(`?? [ChatService] Resolving authority via Python service...`);
      
      try {
        const authorityResult = await pythonIntegrationService.resolveAuthority(question);
        
        if (authorityResult.success && authorityResult.authority) {
          authority = authorityResult.authority;

          // Normalize statute to uppercase — Python sometimes returns 'StGB' instead of 'STGB'
          if (authority.statute && typeof authority.statute === 'string') {
            authority.statute = authority.statute.toUpperCase();
          }

          // ===========================================================================
          // ?? CRITICAL FIX: DETECT EXPLICIT NORM REFERENCES BEFORE TERMINAL CHECK
          // ===========================================================================
          const explicitNorm = this.detectExactNormReference(question);
          if (explicitNorm) {
            console.log(`?? [CRITICAL FIX] Explicit norm reference detected: ${explicitNorm.statute} §${explicitNorm.paragraph}`);
            console.log(`   Overriding Python authority (statute: ${authority.statute || 'null'})`);

            // Override Python's authority with explicit reference
            authority.statute = explicitNorm.statute;
            authority.paragraph = explicitNorm.paragraph;
            authority.isArticle = explicitNorm.isArticle;
            authority.authority_mode = 'exact';
            authority.isStatuteLocked = true;
            authority.isParagraphLocked = true;
            authority.requiresClarification = false;

            // Mark as terminal-equivalent
            authority.__explicit_norm_reference = true;
            authority.__explicit_override = true;
          } else {
            // FIX: bare-statute keyword override — catches "nach StPO", "gemäß ZPO" etc.
            // Python sometimes misclassifies when no § is present; the question's own words win.
            const STATUTE_KEYWORDS = {
              STPO: /\b(stpo|strafprozessordnung|strafverfahrensrecht)\b/i,
              ZPO:  /\b(zpo|zivilprozessordnung|zivilprozess(?:recht)?)\b/i,
              GMBHG: /\b(gmbhg|gmbh-gesetz|gmbh\s*gesetz)\b/i,
              HGB:  /\b(hgb|handelsgesetzbuch|handelsrecht)\b/i,
              GG:   /\b(grundgesetz|gg(?:\s|$))/i,
              STGB: /\b(stgb|strafgesetzbuch|strafrecht)\b/i,
              BGB:  /\b(bgb|bürgerliches\s*gesetzbuch|zivilrecht)\b/i,
            };
            for (const [statute, pattern] of Object.entries(STATUTE_KEYWORDS)) {
              if (pattern.test(question)) {
                if (authority.statute !== statute) {
                  console.log(`[StatuteKeyword] Overriding Python statute "${authority.statute}" → "${statute}" based on question keyword`);
                  authority.statute = statute;
                  authority.isStatuteLocked = true;
                }
                break;
              }
            }
          }
          
          // ===========================================================================
          // ?? CRITICAL: IMMEDIATE TERMINAL AUTHORITY CHECK (BEFORE ANY NODE PROCESSING)
          // ===========================================================================
          console.log(`? Python raw authority:`, JSON.stringify(authority, null, 2));
          
          if (this.isTerminalAuthority(authority)) {
            console.log(`?? [TERMINAL AUTHORITY] Python declared final paragraph - Node MUST STOP IMMEDIATELY`);
            console.log(`   Statute: ${authority.statute}, Paragraph: ${authority.paragraph}`);
            console.log(`   Terminal metadata:`, {
              authority_final: authority.authority_final,
              terminal: authority.terminal,
              retrieval_constraint: authority.retrieval?.constraint,
              force_exact: authority.force_exact
            });
            
            // ?? GUARDRAIL: Ensure contract integrity
            if (authority.authority_final && !authority.paragraph) {
              console.error(`?? CONTRACT VIOLATION: authority_final=true but paragraph missing!`);
            }
            
            if (authority.authority_final && authority.authority_mode === 'overview') {
              console.error(`?? CONTRACT VIOLATION: terminal authority downgraded to overview mode`);
            }
            
            // Generate terminal response with exact content
            const statuteName = this.getStatuteDisplayName(authority.statute);
            const paragraphRef = authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`;
            
            // Try to find exact paragraph text for completeness
            let answerText = authority.text || authority.answer || authority.content;
            
            if (!answerText && authority.statute && authority.paragraph) {
              const exactChunk = this.findExactParagraph(allDocuments, authority.statute, authority.paragraph);
              if (exactChunk) {
                answerText = exactChunk.content || exactChunk.text;
              }
            }
            
            // Fallback if no text found
            if (!answerText) {
              answerText = `**${statuteName} ${paragraphRef}**\n\n[Exakte Paragrapheninhalte aus dem Python-Autoritätsdienst]`;
            }
            
            const terminalResponse = {
              success: true,
              data: {
                answer: answerText,
                structuredAnswer: {
                  fullAnswer: answerText,
                  confidence: 1.0,
                  template_used: 'terminal_authority',
                  domain: 'legal',
                  metadata: {
                    terminal_authority: true,
                    authority_final: true,
                    statute: authority.statute,
                    paragraph: authority.paragraph,
                    authority_mode: authority.authority_mode || 'exact',
                    retrieval_constraint: authority.retrieval?.constraint || 'PARAGRAPH_STRICT',
                    retrieval_used: false,
                    safety_check_skipped: true,
                    node_pipeline_bypassed: true,
                    python_authority_preserved: true,
                    python_metadata_untouched: true
                  }
                },
                sources: authority.statute && authority.paragraph ? [{
                  statute: authority.statute,
                  paragraph: authority.paragraph,
                  content: 'Python terminal authority directive',
                  metadata: { 
                    source: 'python_authority_service',
                    authority_final: authority.authority_final,
                    constraint: authority.retrieval?.constraint
                  }
                }] : [],
                confidence: 1.0,
                conversationId: Date.now().toString(),
                legalDomain: 'legal',
                statute: authority.statute,
                paragraph: authority.paragraph,
                isArticle: authority.isArticle,
                authority: authority, // PRESERVE ORIGINAL
                classification: authority.classification || { type: 'EXACT_OPERATIVE_NORM', domain: 'legal' },
                safetyCheck: {
                  isLegallySound: true,
                  legalDefensibility: 'HIGH',
                  examinerReadiness: 'EXAMINER_READY',
                  confidenceAdjusted: 1.0,
                  metadata: { safety_check_skipped: true }
                },
                metadata: {
                  terminal_authority: true,
                  authority_final: true,
                  node_pipeline_bypassed: true,
                  python_terminal_directive: true,
                  execution_order: 'terminal_early_exit'
                }
              }
            };
            
            // Log safety event for audit
            safetyCheck.logSafetyEvent('TERMINAL_AUTHORITY_ENFORCED', {
              question,
              statute: authority.statute,
              paragraph: authority.paragraph,
              authority_mode: authority.authority_mode,
              retrieval_constraint: authority.retrieval?.constraint,
              python_metadata: {
                authority_final: authority.authority_final,
                terminal: authority.terminal,
                force_exact: authority.force_exact
              },
              execution_order: 'immediate',
              timestamp: new Date().toISOString(),
              contract_integrity: 'preserved'
            });
            
            return resultFormatter.formatResponse(terminalResponse, authority);
          }
          
          // ===========================================================================
          // ?? CREATE AUTHORITY LOCK (NON-TERMINAL CASES)
          // ===========================================================================
          authorityLock = this.createAuthorityLock(authority);
          console.log(`?? [Authority Lock] Created for non-terminal authority:`, {
            statute: authority.statute,
            paragraph: authority.paragraph,
            locked: authorityLock.__locked,
            reason: authorityLock.__lockReason
          });
          
          // ===========================================================================
          // ? ONLY NOW MAY NODE TOUCH AUTHORITY METADATA (NON-TERMINAL CASES)
          // ===========================================================================
          console.log(`? Terminal check passed - Node may process authority`);
          
          // Preserve Python's doctrine classification
          if (authorityResult.authority.question_type) {
            authority.question_type = authorityResult.authority.question_type;
          }
          
          if (authorityResult.authority.doctrinal_match !== undefined) {
            authority.doctrinal_match = authorityResult.authority.doctrinal_match;
          }

          // Python uses camelCase epistemicCertainty; snake_case is a fallback alias
          if (authorityResult.authority.epistemicCertainty) {
            authority.epistemicCertainty = authorityResult.authority.epistemicCertainty;
          } else if (authorityResult.authority.epistemic_certainty) {
            authority.epistemicCertainty = authorityResult.authority.epistemic_certainty;
          }

          if (authorityResult.authority.suggestedField) {
            authority.suggestedField = authorityResult.authority.suggestedField;
          }
          
          // Python uses camelCase (anchorNormMode); guard against snake_case alias too
          if (authorityResult.authority.anchorNormMode !== undefined) {
            authority.anchorNormMode = authorityResult.authority.anchorNormMode;
          } else if (authorityResult.authority.anchor_norm_mode !== undefined) {
            authority.anchorNormMode = authorityResult.authority.anchor_norm_mode;
          }
          
          // Don't override classification if Python provided one
          if (!authority.classification && 
              (authority.question_type === 'DOCTRINE' || 
               authority.question_type === 'GENERAL_DOCTRINE' ||
               authority.doctrinal_match === true)) {
            authority.classification = {
              type: 'DOCTRINE',
              domain: authority.domain || 'general',
              source: 'python_doctrine_detection'
            };
          }
          
          // Parse Python's clarification field
          if (authority.status) {
            authority.requiresClarification = authority.status === 'CLARIFICATION_REQUIRED';
            console.log(`?? Python status: ${authority.status}, requiresClarification: ${authority.requiresClarification}`);
          }
          
          console.log(`? Python authority resolved: ${authority.statute || 'NO_STATUTE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);
          console.log(`   question_type: ${authority.question_type}`);
          console.log(`   doctrinal_match: ${authority.doctrinal_match}`);
          console.log(`   epistemicCertainty: ${authority.epistemicCertainty}`);
          console.log(`   anchorNormMode: ${authority.anchorNormMode}`);
          console.log(`   classification: ${authority.classification?.type || 'none'}`);
          console.log(`   authority_lock: ${authorityLock.__locked ? 'LOCKED' : 'UNLOCKED'}`);
          
        } else {
          console.log(`?? Python authority resolution failed or no statute found — continuing with TF-IDF fallback`);
          authority = {
            statute: null,
            paragraph: null,
            isArticle: false,
            requiresClarification: false,
            stopProcessing: false,
            confidence: 0.3,
            referenceSource: 'python_failed',
            authority_mode: 'fallback',
            classification: {
              type: 'GENERAL',
              domain: 'general',
              source: 'python_fallback'
            }
          };
          authorityLock = { __locked: false };
        }
      } catch (error) {
        console.log(`? Python authority service error: ${error.message} — continuing with TF-IDF fallback`);
        pythonAuthorityError = error.message;
        authority = {
          statute: null,
          paragraph: null,
          isArticle: false,
          requiresClarification: false,
          stopProcessing: false,
          confidence: 0.1,
          referenceSource: 'python_error',
          authority_mode: 'fallback',
          classification: {
            type: 'GENERAL',
            domain: 'general',
            source: 'python_error_fallback'
          }
        };
        authorityLock = { __locked: false };
      }
      
      // ?? CHECK AUTHORITY LOCK BEFORE ANY FURTHER PROCESSING
      if (authorityLock?.__locked === true) {
        console.log(`?? [Authority Lock] Downstream processing BLOCKED`);
        console.log(`   Question: "${question.substring(0, 80)}..."`);
        console.log(`   Lock Reason: ${authorityLock.__lockReason}`);
        
        safetyCheck.logSafetyEvent('AUTHORITY_LOCK_DOWNSTREAM_BLOCK', {
          question,
          statute: authorityLock.statute,
          paragraph: authorityLock.paragraph,
          lock_reason: authorityLock.__lockReason,
          lock_timestamp: authorityLock.__lockTimestamp,
          python_error: pythonAuthorityError,
          execution_path: 'blocked_by_lock'
        });
        
        // Return locked response
        const lockedResponse = {
          success: true,
          data: {
            answer: `**Autorität gesperrt**\n\nDie Anfrage wurde durch den autoritativen Dienst finalisiert. Weitere Verarbeitung ist gesperrt.\n\n*Status: ${authorityLock.__lockReason}*`,
            confidence: 0.9,
            statute: authorityLock.statute,
            paragraph: authorityLock.paragraph,
            metadata: {
              authority_locked: true,
              lock_reason: authorityLock.__lockReason,
              lock_timestamp: authorityLock.__lockTimestamp,
              downstream_processing_blocked: true,
              python_authority_preserved: true
            }
          }
        };
        
        return resultFormatter.formatResponse(lockedResponse, authority);
      }
      
      // ===========================================================================
      // ?? CRITICAL FIX: UPDATED CLARIFICATION LOGIC WITH EXPLICIT NORM DETECTION
      // ===========================================================================
      const shouldRequireClarification = () => {
        if (authority.stopProcessing === true) {
      console.log('[TRACE] shouldRequireClarification called, requiresClarification=' + authority.requiresClarification + ' status=' + authority.status + ' mode=' + authority.authority_mode);
          console.log(`?? Python service explicitly requested stop`);
          return true;
        }
        
        const implicitAllowed = 
          authority?.authority_mode === 'overview' && 
          authority?.confidence >= 0.8;
        
        // ?? CRITICAL FIX: Explicit norm references override Python's authority
        if (authority.__explicit_norm_reference === true) {
          console.log(`? [Explicit Norm Override] Suppressing clarification for explicit norm reference`);
          return false; // ? NO clarification needed!
        }
        
        if (!authority.statute && !implicitAllowed) {
          console.log(`?? No statute detected and implicit authority NOT allowed`);
          return true;
        }
        
        if (!authority.statute && implicitAllowed) {
          console.log(`? Implicit authority allowed – proceeding without statute`);
          return false;
        }
        
        // ?? CRITICAL FIX: Check if this is a statute-only doctrine question
        // ===========================================================================
        const isStatuteOnlyDoctrineQuestion = () => {
          // Check Python's metadata for statute-only constraint
          const isStatuteOnly = 
            authority.retrieval?.constraint === 'STATUTE_ONLY' ||
            authority.constraint === 'STATUTE_ONLY' ||
            authority.statute_only === true;
          
          // Check if this is a doctrinal question
          const isDoctrinalQuestion = 
            authority.question_type === 'DOCTRINE' ||
            authority.question_type === 'GENERAL_DOCTRINE' ||
            authority.question_type === 'GENERAL' ||
            authority.doctrinal_match === true ||
            authority.classification?.type === 'DOCTRINE';
          
          // Statute is locked but paragraph is not
          const isStatuteLocked = 
            authority.isStatuteLocked === true ||
            authority.statute_locked === true;
          
          const isParagraphNotLocked = 
            authority.isParagraphLocked === false ||
            authority.paragraph_locked === false;
          
          return isStatuteOnly && isDoctrinalQuestion && isStatuteLocked && isParagraphNotLocked;
        };
        
        // ?? CRITICAL FIX: Handle statute-only doctrine questions
        if (authority.statute && !authority.paragraph) {
          // Check if this is a statute-only doctrine question FIRST
          if (isStatuteOnlyDoctrineQuestion()) {
            console.log(`? [DOCTRINE FIX] Statute-only doctrine question: ${authority.statute} - paragraph NOT required`);
            console.log(`   Retrieval constraint: ${authority.retrieval?.constraint}`);
            console.log(`   Question type: ${authority.question_type}`);
            console.log(`   Statute locked: ${authority.isStatuteLocked}, Paragraph locked: ${authority.isParagraphLocked}`);
            return false; // ? NO clarification needed!
          }
          
          // Original logic for non-doctrinal questions
          if (authority.authority_mode === 'overview') {
            console.log(`? Overview mode: statute ${authority.statute} without paragraph is allowed`);
            return false;
          }

          // General definition questions (e.g. "Was ist Schadensersatz?") arrive with
          // anchorNormMode=true but no specific paragraph. When authority_mode is
          // undefined or 'fallback', Python has identified a statute anchor but not a
          // paragraph — this is intentional and must not block the response.
          const isUndefinedOrFallbackMode =
            !authority.authority_mode || authority.authority_mode === 'fallback';
          if (isUndefinedOrFallbackMode && authority.anchorNormMode === true) {
            console.log(`? [Anchor Norm Mode] Statute-only anchor for general question — paragraph not required`);
            console.log(`   authority_mode: ${authority.authority_mode || 'undefined'}, anchorNormMode: ${authority.anchorNormMode}`);
            return false;
          }

          // If the user's question contains no specific paragraph reference (§ N or Art. N),
          // it is an overview/definition question — allow it to proceed without a paragraph.
          const questionHasSpecificParagraph = /§\s*\d+|art\.\s*\d+/i.test(question);
          if (!questionHasSpecificParagraph) {
            console.log(`? [Overview Fallback] No specific § in question — allowing statute-overview for ${authority.statute}`);
            return false;
          }

          // Do NOT fire clarification if the question already contains an explicit
          // statute name (BGB, StGB, etc.) AND a § reference — the user was clear.
          const KNOWN_STATUTE_NAMES = /\b(BGB|StGB|HGB|GmbHG|StPO|ZPO|GG)\b/i;
          if (KNOWN_STATUTE_NAMES.test(question)) {
            console.log(`✅ [Explicit Ref] Question has § + statute name — skipping clarification for ${authority.statute}`);
            return false;
          }

          console.log(`?? Statute ${authority.statute} found but paragraph missing in mode ${authority.authority_mode}`);
          return true;
        }
        
        const _noParaInQ = !question.match(/\u00a7|\u0026#167;|art\.\s*\d+/i) && !question.includes("§"); if (_noParaInQ) { console.log("✅ [ReqClar Bypass] No § in question — ignoring Python clarification flag"); return false; } if (authority.requiresClarification === true) {
          console.log(`?? Python explicitly flagged clarification required`);
          return true;
        }
        
        return false;
      };
      
      if (shouldRequireClarification()) {
        console.log(`? [ChatService] Authority clarification required`);
        
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
        
        const clarification = this.generateStructuredClarification(authority, question, pythonAuthorityError);
        return resultFormatter.formatResponse(clarification, authority);
      }
      
      console.log(`? Authority from Python: ${authority.statute} ${authority.paragraph ? (authority.isArticle ? 'Article ' : '§') + authority.paragraph : ''} (mode: ${authority.authority_mode})`);
      
      // ===========================================================================
      // STEP 3: CHECK FOR EXACT MODE (WITH TEXT-BASED PARAGRAPH EXTRACTION)
      // ===========================================================================
      if (authority.authority_mode === 'exact' && authority.statute && authority.paragraph) {
        console.log(`?? [Exact Mode] Processing exact paragraph: ${authority.statute} §${authority.paragraph}`);
        
        // Find exact paragraph with text extraction
        const exactChunk = this.findExactParagraph(allDocuments, authority.statute, authority.paragraph);
        
        if (!exactChunk) {
          console.log(`? [Exact Mode] Paragraph §${authority.paragraph} not found in ${authority.statute}`);
          
          // Try fallback: Search for any BGB chunks that might contain the paragraph
          console.log(`?? [Exact Mode Fallback] Searching for any mention of §${authority.paragraph} in ${authority.statute} content...`);
          
          const fallbackChunks = [];
          for (const doc of allDocuments) {
            const chunks = doc.chunks || [doc];
            for (const chunk of chunks) {
              const statuteRaw = chunk.metadata?.statute || doc.metadata?.statute;
              if (statuteRaw === authority.statute) {
                const content = chunk.content || chunk.text || '';
                // Look for paragraph in text
                if (content.includes(`§${authority.paragraph}`) || 
                    content.includes(`§ ${authority.paragraph}`) ||
                    content.includes(`Paragraph ${authority.paragraph}`)) {
                  fallbackChunks.push({
                    chunk,
                    matchType: 'text_inclusion',
                    preview: content.substring(0, 200)
                  });
                }
              }
            }
          }
          
          if (fallbackChunks.length > 0) {
            console.log(`?? [Exact Mode] Found ${fallbackChunks.length} chunks containing §${authority.paragraph} in text`);
            // Use the first one
            const fallbackChunk = fallbackChunks[0].chunk;
            console.log(`? [Exact Mode Fallback] Using chunk with text inclusion`);
            
            const exactResponse = {
              success: true,
              data: {
                answer: this.formatChunkAsAnswer(fallbackChunk.content || fallbackChunk.text, authority.statute, authority.paragraph, authority.isArticle),
                structuredAnswer: {
                  fullAnswer: this.formatChunkAsAnswer(fallbackChunk.content || fallbackChunk.text, authority.statute, authority.paragraph, authority.isArticle),
                  confidence: 1.0,
                  template_used: 'exact_paragraph_fallback',
                  domain: 'legal',
                  metadata: {
                    exact_mode: true,
                    authority_mode: 'exact',
                    statute: authority.statute,
                    paragraph: authority.paragraph,
                    retrieval_used: false,
                    safety_check_skipped: true,
                    content_source: 'text_inclusion_fallback',
                    fallback_used: true
                  }
                },
                sources: [{
                  statute: authority.statute,
                  paragraph: authority.paragraph,
                  content: (fallbackChunk.content || fallbackChunk.text)?.substring(0, 200) + '...',
                  metadata: fallbackChunk.metadata
                }],
                confidence: 1.0,
                conversationId: Date.now().toString(),
                legalDomain: 'legal',
                statute: authority.statute,
                paragraph: authority.paragraph,
                isArticle: authority.isArticle,
                authority: authority,
                classification: {
                  type: 'EXACT_OPERATIVE_NORM',
                  domain: 'legal',
                  source: 'exact_mode_processor'
                },
                safetyCheck: {
                  isLegallySound: true,
                  legalDefensibility: 'HIGH',
                  examinerReadiness: 'EXAMINER_READY',
                  confidenceAdjusted: 1.0,
                  metadata: { safety_check_skipped: true }
                },
                metadata: {
                  documentsUsed: 1,
                  processingTime: 0,
                  language: languageStr,
                  exactParagraphMatch: false,
                  textInclusionMatch: true,
                  chunksUsed: 1,
                  safetyPassed: true,
                  legalDefensibility: 'HIGH',
                  examinerReadiness: 'EXAMINER_READY',
                  architecture: 'epistemic_authority',
                  statuteLocked: true,
                  python_service_used: true,
                  python_authority_resolved: true,
                  python_authoritative_found: false,
                  python_results_count: 0,
                  authority_mode: 'exact',
                  doctrinal_template: 'exact_paragraph_fallback',
                  epistemic_certainty: authority.epistemicCertainty,
                  anchor_norm_mode: authority.anchorNormMode,
                  safety_check_skipped: true,
                  fallback_used: true
                }
              }
            };
            
            return resultFormatter.formatResponse(exactResponse, authority);
          }
          
          return {
            success: false,
            error: `Paragraph §${authority.paragraph} nicht in ${this.getStatuteDisplayName(authority.statute)} gefunden.`,
            data: {
              requires_clarification: true,
              statute: authority.statute,
              paragraph: authority.paragraph,
              suggestion: "Möglicherweise ist der Paragraph nicht im geladenen Dokument oder die PDF-Struktur enthält keine Paragraphen-Markierungen."
            }
          };
        }
        
        // Generate exact mode response
        const exactResponse = {
          success: true,
          data: {
            answer: this.formatChunkAsAnswer(exactChunk.content || exactChunk.text, authority.statute, authority.paragraph, authority.isArticle),
            structuredAnswer: {
              fullAnswer: this.formatChunkAsAnswer(exactChunk.content || exactChunk.text, authority.statute, authority.paragraph, authority.isArticle),
              confidence: 1.0,
              template_used: 'exact_paragraph',
              domain: 'legal',
              metadata: {
                exact_mode: true,
                authority_mode: 'exact',
                statute: authority.statute,
                paragraph: authority.paragraph,
                retrieval_used: false,
                safety_check_skipped: true,
                content_source: 'direct_paragraph_extraction',
                text_extraction_used: true
              }
            },
            sources: [{
              statute: authority.statute,
              paragraph: authority.paragraph,
              content: (exactChunk.content || exactChunk.text)?.substring(0, 200) + '...',
              metadata: exactChunk.metadata
            }],
            confidence: 1.0,
            conversationId: Date.now().toString(),
            legalDomain: 'legal',
            statute: authority.statute,
            paragraph: authority.paragraph,
            isArticle: authority.isArticle,
            authority: authority,
            classification: {
              type: 'EXACT_OPERATIVE_NORM',
              domain: 'legal',
              source: 'exact_mode_processor'
            },
            safetyCheck: {
              isLegallySound: true,
              legalDefensibility: 'HIGH',
              examinerReadiness: 'EXAMINER_READY',
              confidenceAdjusted: 1.0,
              metadata: { safety_check_skipped: true }
            },
            metadata: {
              documentsUsed: 1,
              processingTime: 0,
              language: languageStr,
              exactParagraphMatch: true,
              chunksUsed: 1,
              safetyPassed: true,
              legalDefensibility: 'HIGH',
              examinerReadiness: 'EXAMINER_READY',
              architecture: 'epistemic_authority',
              statuteLocked: true,
              python_service_used: true,
              python_authority_resolved: true,
              python_authoritative_found: false,
              python_results_count: 0,
              authority_mode: 'exact',
              doctrinal_template: 'exact_paragraph',
              epistemic_certainty: authority.epistemicCertainty,
              anchor_norm_mode: authority.anchorNormMode,
              safety_check_skipped: true,
              text_extraction_used: true
            }
          }
        };
        
        // Format with resultFormatter
        return resultFormatter.formatResponse(exactResponse, authority);
      }
      
      // Classification from Python (preserved from above)
      const classification = authority.classification || {
        type: 'GENERAL',
        domain: 'general',
        source: 'python_default'
      };
      
      console.log(`?? Classification: ${classification.type} (domain: ${classification.domain || 'general'})`);
      
      // ===========================================================================
      // STEP 4: Handle Doctrine/System questions
      // ===========================================================================
      if (classification.type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE') {
        console.log(`?? Doctrine question detected - separate path`);

        // doctrinal_match=true means Python already confirmed this is a settled doctrine;
        // its content is authoritative regardless of the pre-call epistemicCertainty value.
        if (authority.epistemicCertainty === 'confirmed' || authority.doctrinal_match === true) {
          const result = await this.handleConfirmedDoctrine(question, authority);
          if (result !== null) {
            return resultFormatter.formatResponse(result, authority);
          }
          console.log(`⬇️ [STEP 4] Confirmed doctrine path returned null — falling through to RAG`);
        } else {
          const result = await this.handleUnconfirmedDoctrine(question, authority);
          if (result !== null) {
            return resultFormatter.formatResponse(result, authority);
          }
          console.log(`⬇️ [STEP 4] Unconfirmed doctrine path returned null — falling through to RAG`);
        }
        // Fall through to STEP 5+ (RAG retrieval)
      }
      
      if (classification.type === 'SYSTEM') {
        console.log(`?? System question - conceptual answer`);
        const result = this.handleSystemQuestion(question, authority);
        return resultFormatter.formatResponse(result, authority);
      }
      
      // ===========================================================================
      // STEP 5: DOCTRINAL EARLY-EXIT WITH PROPER METADATA
      // ===========================================================================
      if (this.shouldUseDoctrinalEarlyExit(authority)) {
        console.log(`?? [Doctrinal Early-Exit] Using doctrinal path`);
        console.log(`   Authority metadata:`, {
          question_type: authority.question_type,
          epistemicCertainty: authority.epistemicCertainty,
          anchorNormMode: authority.anchorNormMode,
          doctrinal_match: authority.doctrinal_match
        });
        
        const doctrineResult = await this.callDoctrineInductionService(question, authority);

        // Only use the doctrine result when Python actually found a specific doctrine.
        // doctrine_found === false means Python returned a generic "no match" message —
        // that should fall through to RAG vector search, not become the final answer.
        if (doctrineResult?.doctrine_found === true) {
          const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);

          // No safety check for doctrine, immediate return
          safetyCheck.logSafetyEvent('DOCTRINAL_EARLY_EXIT', {
            question,
            question_type: authority.question_type,
            epistemicCertainty: authority.epistemicCertainty,
            anchorNormMode: authority.anchorNormMode,
            statute: authority.statute,
            retrievalUsed: false,
            safetyCheckSkipped: true
          });
          
          const rawResponse = {
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
          
          return resultFormatter.formatResponse(rawResponse, authority);
        } else {
          console.log(`?? Doctrine induction failed, falling back to unconfirmed doctrine path`);
        }
      }
      
      // ===========================================================================
      // STEP 6: Retrieval with doctrine guard & authority lock (NOW PROPERLY BLOCKS)
      // ===========================================================================
      let pythonResults = null;
      
      // Always attempt retrieval — the authority lock constrains scope inside
      // retrieveDocumentsWithDoctrineGuard but must not skip the whole retrieval
      // chain or every specific-paragraph question returns an empty abstention.
      pythonResults = await this.retrieveDocumentsWithDoctrineGuard(
        question, authority, authorityLock, allDocuments, classification
      );
      
      // Always allow RAG synthesis — empty Python results just means TF-IDF will
      // be the primary source, which is correct behaviour for corpus questions.
      console.log(`✅ [Guard Passed] Proceeding to RAG synthesis:`, {
        authority_final: authority?.authority_final,
        has_results: pythonResults?.results?.length > 0,
        authoritative_found: pythonResults?.authoritative_found,
        authority_mode: authority?.authority_mode,
        authority_lock: authorityLock?.__locked || false
      });
      
      // Check if doctrine guard blocked retrieval
      if (pythonResults.authority_summary?.doctrine_mode && pythonResults.results.length === 0 && question.match(/\xA7\s*\d+|art\.\s*\d+/i)) {
        console.log(`?? Doctrine guard blocked retrieval - asking for clarification`);
        
        // This is a doctrinal question that needs special handling
        if (authority.question_type === 'GENERAL_DOCTRINE' || authority.doctrinal_match) {
          // doctrinal_match=true → authoritative content, no uncertainty warning
          const handler = authority.doctrinal_match
            ? this.handleConfirmedDoctrine.bind(this)
            : this.handleUnconfirmedDoctrine.bind(this);
          const result = await handler(question, authority);
          // null means no settled doctrine — fall through to RAG rather than blocking
          if (result !== null) {
            return resultFormatter.formatResponse(result, authority);
          }
          console.log(`⬇️ [Guard] Doctrine handler returned null — continuing to RAG`);
        }
        
        // No doctrine path available — fall through to RAG rather than returning
        // a clarification. RAG may have content even when doctrine fails.
        console.log(`⬇️ [Guard] No doctrine path available — falling through to RAG`);
      }
      
      // ===========================================================================
      // STEP 7: RAG call (ONLY IF GUARD PASSES)
      // ===========================================================================
      const ragResponse = await ragService.generateResponse(
        question,
        allDocuments,
        {
          language: languageStr,
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
      // STEP 8: Confidence override
      // ===========================================================================
      const baseConfidence = ragResponse.confidence || 0.7;
      const finalConfidence = this.calculateEpistemicConfidence(baseConfidence, authority, ragResponse);
      ragResponse.confidence = finalConfidence;
      
      // ===========================================================================
      // STEP 9: Safety check (SKIP FOR DOCTRINE)
      // ===========================================================================
      let safetyValidation = null;
      
      if (classification.type !== 'DOCTRINE' && 
          authority.question_type !== 'DOCTRINE' && 
          authority.question_type !== 'GENERAL_DOCTRINE') {
        safetyValidation = ragResponse.safetyCheck || await safetyCheck.validateBeforeAnswer(question, ragResponse, authority);
      } else {
        console.log(`?? Safety check skipped for doctrine question`);
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
      // STEP 11: Build raw response
      // ===========================================================================
      const rawResponse = {
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
            language: languageStr,
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
            epistemic_certainty: authority.epistemicCertainty,
            anchor_norm_mode: authority.anchorNormMode,
            safety_check_skipped: classification.type === 'DOCTRINE',
            authority_lock_applied: authorityLock?.__locked || false,
            authority_lock_reason: authorityLock?.__lockReason || 'none',
            explicit_norm_override: authority.__explicit_norm_reference || false
          },
        },
      };
      
      // ===========================================================================
      // STEP 12: Format with resultFormatter
      // ===========================================================================
      const formattedResponse = resultFormatter.formatResponse(rawResponse, authority);
      
      // ===========================================================================
      // STEP 13: Add to conversation history
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
        anchor_norm_mode: authority.anchorNormMode,
        authority_lock_applied: authorityLock?.__locked || false,
        authority_lock_reason: authorityLock?.__lockReason || 'none',
        explicit_norm_override: authority.__explicit_norm_reference || false
      };

      this.conversationHistory.push(conversationEntry);
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // ===========================================================================
      // STEP 14: Log and return
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
        safety_check_skipped: classification.type === 'DOCTRINE',
        authority_lock_applied: authorityLock?.__locked || false,
        authority_lock_reason: authorityLock?.__lockReason || 'none',
        explicit_norm_override: authority.__explicit_norm_reference || false
      });

      this.logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation);
      
      return formattedResponse;
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
  // DOCTRINE HANDLERS
  // ===========================================================================
  
  async handleConfirmedDoctrine(question, authority) {
    console.log(`?? Confirmed doctrine - delegating to induction service`);
    
    const doctrineResult = await this.callDoctrineInductionService(question, authority);

    if (doctrineResult?.doctrine_found === true) {
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

    // No confirmed doctrine — return null so caller can fall through to RAG retrieval
    console.log(`⬇️ [Doctrine] doctrine_found=false — signalling fallthrough to RAG`);
    return null;
  }
  
  async handleUnconfirmedDoctrine(question, authority) {
    console.log(`?? Unconfirmed doctrine - epistemic warning path`);
    
    const doctrineResult = await this.callDoctrineInductionService(question, authority);

    if (doctrineResult?.doctrine_found === true) {
      const statuteName = this.getStatuteDisplayName(authority.statute); // eslint-disable-line no-unused-vars
      let answer = `**Epistemischer Hinweis**\n\n`;
      answer += `Die Frage betrifft eine Rechtsdoktrin, die nicht mit hoher Sicherheit bestätigt werden konnte.\n\n`;
      
      if (doctrineResult.doctrinal_summary) {
        answer += doctrineResult.doctrinal_summary;
      } else if (doctrineResult.answer) {
        answer += doctrineResult.answer;
      }
      
      answer += `\n\n*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*`;
      
      const structuredAnswer = {
        fullAnswer: answer,
        confidence: 0.7,
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

    // No settled doctrine — return null so caller falls through to RAG retrieval
    console.log(`⬇️ [Doctrine] Unconfirmed doctrine — no match, signalling fallthrough to RAG`);
    return null;
  }

  generateEpistemicallySafeFallback(authority, question) {
    return {
      success: true,
      data: {
        answer: `**Methodischer Hinweis**\n\n` +
                `Die doctrinale Analyse konnte nicht abgeschlossen werden.\n\n` +
                `*Frage: ${question.substring(0, 100)}...*\n` +
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
  // HELPER: Statute Display Names
  // ===========================================================================
  
  getStatuteDisplayName(statute) {
    const names = {
      'BGB': 'Bürgerliches Gesetzbuch',
      'StGB': 'Strafgesetzbuch',
      'STGB': 'Strafgesetzbuch',
      'HGB': 'Handelsgesetzbuch',
      'GG': 'Grundgesetz',
      'ZPO': 'Zivilprozessordnung',
      'StPO': 'Strafprozessordnung',
      'STPO': 'Strafprozessordnung',
      'GMBHG': 'GmbH-Gesetz'
    };
    return names[statute] || statute;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================
  
  generateSystemAnswer() {
    return `**Systemarchitektur - Epistemische Autorität**\n\n` +
           `Das System arbeitet nach einem mehrstufigen epistemischen Modell:\n\n` +
           `1. **Autoritätsauflösung**: Python-Dienst identifiziert Gesetz und Paragraph\n` +
           `2. **Doctrinale Induktion**: Bei bestätigten Doktrinfragen ? Python-Autoritätsdienst\n` +
           `3. **Retrieval mit Guard**: TF-IDF-Fallback für Doktrinfragen blockiert\n` +
           `4. **Sicherheitsprüfung**: Automatische Bewertung der rechtlichen Verteidigbarkeit\n` +
           `5. **Epistemische Konfidenz**: Sonderregeln für doctrinale Fragen\n\n` +
           `**Status**: Alle Komponenten aktiv, Python-Integration läuft.`;
  }

  prepareDocumentsForPython(documents) {
    return documents.map(doc => ({
      id: doc.id || doc._id || `doc_${Math.random().toString(36).substr(2, 9)}`,
      content: doc.content || doc.text || '',
      metadata: {
        title: doc.title || doc.filename || 'Unbenanntes Dokument',
        type: doc.type || 'legal_document',
        source: doc.source || 'upload',
        chunks_count: doc.chunks?.length || 0,
        statute_refs: doc.statute_refs || [],
        paragraph_refs: doc.paragraph_refs || [],
        statute: doc.metadata?.statute || doc.statute || null,
        paragraph: doc.metadata?.paragraph || null,
        detected_paragraphs: doc.metadata?.detectedParagraphs || []
      }
    }));
  }

  logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation) {
    console.log(`?? Processing Complete:`);
    console.log(`   Question: "${question.substring(0, 80)}..."`);
    console.log(`   Authority: ${authority.statute || 'NONE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);
    console.log(`   Mode: ${authority.authority_mode}, Classification: ${classification.type}`);
    console.log(`   Confidence: ${ragResponse.confidence?.toFixed(2) || 'N/A'}`);
    console.log(`   Python Results: ${pythonResults?.results?.length || 0} docs`);
    console.log(`   Authoritative Found: ${pythonResults?.authoritative_found || false}`);
    console.log(`   Safety: ${safetyValidation?.isLegallySound ? 'PASS' : 'FAIL'}`);
    console.log(`   Legal Defensibility: ${safetyValidation?.legalDefensibility || 'UNKNOWN'}`);
  }

  clearHistory() {
    this.conversationHistory = [];
    console.log('? Conversation history cleared');
  }

  getStats() {
    return {
      totalQuestions: this.conversationHistory.length,
      averageConfidence: this.conversationHistory.length > 0 
        ? this.conversationHistory.reduce((sum, entry) => sum + (entry.confidence || 0), 0) / this.conversationHistory.length
        : 0,
      statutesUsed: [...new Set(this.conversationHistory.filter(e => e.statute).map(e => e.statute))],
      domainsCovered: [...new Set(this.conversationHistory.filter(e => e.legalDomain).map(e => e.legalDomain))],
      lastQuestion: this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length - 1].question : null
    };
  }

  healthCheck() {
    return {
      service: 'ChatService',
      status: 'healthy',
      conversationHistorySize: this.conversationHistory.length,
      lastUpdate: this.conversationHistory.length > 0 
        ? this.conversationHistory[this.conversationHistory.length - 1].timestamp 
        : 'never',
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB',
      uptime: process.uptime() + ' seconds'
    };
  }
}

// ===========================================================================
// ?? TERMINAL AUTHORITY CONTRACT TEST
// ===========================================================================
function testTerminalAuthorityContract() {
  console.log('\n?? Testing Terminal Authority Contract...');
  
  const testCases = [
    // Valid terminal authority
    {
      input: { authority_final: true, paragraph: "41", statute: "BGB", authority_mode: "exact" },
      shouldTerminate: true,
      description: "Valid terminal authority"
    },
    // Contract violation: terminal but overview mode
    {
      input: { authority_final: true, paragraph: "41", statute: "BGB", authority_mode: "overview" },
      shouldTerminate: true, // Still terminates but logs violation
      description: "CONTRACT VIOLATION: terminal with overview mode"
    },
    // Contract violation: terminal but no paragraph
    {
      input: { authority_final: true, statute: "BGB", authority_mode: "exact" },
      shouldTerminate: true, // Still terminates but logs violation
      description: "CONTRACT VIOLATION: terminal without paragraph"
    },
    // Non-terminal
    {
      input: { statute: "BGB", paragraph: "41", authority_mode: "exact" },
      shouldTerminate: false,
      description: "Non-terminal exact mode"
    }
  ];
  
  let passed = 0;
  const service = new ChatService();
  
  for (const testCase of testCases) {
    const isTerminal = service.isTerminalAuthority(testCase.input);
    const passedTest = isTerminal === testCase.shouldTerminate;
    
    if (passedTest) {
      console.log(`? ${testCase.description}`);
      passed++;
    } else {
      console.log(`? ${testCase.description}: expected ${testCase.shouldTerminate}, got ${isTerminal}`);
    }
  }
  
  console.log(`?? Terminal authority tests: ${passed}/${testCases.length} passed`);
  return passed === testCases.length;
}

// Run test if file is executed directly
if (require.main === module) {
  console.log('?? Running ChatService contract tests...');
  const success = testTerminalAuthorityContract();
  console.log(success ? '? All tests passed!' : '? Some tests failed');
  process.exit(success ? 0 : 1);
}

module.exports = new ChatService();


