const safetyCheck = require("../validation/safetyCheck");
const natural = require("natural");

class RAGService {
  constructor() {
    this.MAX_CHUNKS = 5;
    this.tfidf = new natural.TfIdf();

    // Statute display names — all keys UPPERCASE to match loaded document metadata
    this.statuteDisplayNames = {
      BGB:      "Bürgerliches Gesetzbuch (BGB)",
      STGB:     "Strafgesetzbuch (StGB)",
      HGB:      "Handelsgesetzbuch (HGB)",
      GG:       "Grundgesetz (GG)",
      ZPO:      "Zivilprozessordnung (ZPO)",
      STPO:     "Strafprozessordnung (StPO)",
      GMBHG:    "GmbH-Gesetz (GmbHG)",
      "EU-GDPR": "EU-Datenschutz-Grundverordnung (GDPR)",
    };

    // ⭐⭐ DOCTRINE: Excluded statutes for specific domains — keys UPPERCASE
    this.excludedStatutesForDomain = {
      "STGB": ["BGB", "HGB", "ZPO", "AO", "EU-GDPR"],
      "BGB":  ["STGB", "STPO", "OwiG", "VwVfG"],
    };

    // ⭐⭐ DOCTRINE: Explicitly excluded statutes regardless of domain
    this.alwaysExcludedStatutes = [
      "Entgeltfortzahlungsgesetz",
      "Verbraucherschutzgesetz",
      "Zahlungsdiensterichtlinie",
      "Zahlungsdiensteaufsichtsgesetz",
      "BDSG",
    ];

    // ⭐⭐ NEW: Statute dependency chains (FIX 2 implementation)
    this.statuteChains = {
      "BGB": {
        "119": ["121", "122"],  // §119 always requires §121 and §122
        "433": ["434", "437", "440"],  // Kaufvertrag chain
        "823": ["826", "249", "253"],  // Deliktsrecht chain
      }
    };

    // ✅ NEW: Derivative norm patterns (language-agnostic)
    this.derivativePatterns = [
      "entgegen einem verbot",
      "ist nichtig",
      "widerrechtlich ist",
      "gesetzlich verboten",
      "verstoß gegen",
      "soweit nicht ein gesetz",
      "verweis auf",
      "verweist auf",
      "bezug nimmt auf",
      "wenn das gesetz"
    ];

    console.log("✅ RAGService initialized as DOCTRINE-ENFORCED EXECUTION ENGINE (with TF-IDF)");
  }

  /**
   * RAGService - DOCTRINE ENFORCEMENT ONLY
   * Retrieval is NOT autonomous - must obey pre-retrieval gate
   */
  async generateResponse(question, allDocuments, options = {}) {
    const startTime = Date.now();
    const language = options.language || "german";

    console.log(`\n🤖 RAG Execution: "${question.substring(0, 60)}..."`);

    // 🔴 CRITICAL FIX: DOCTRINE BYPASS - If answer came from doctrine, skip RAG entirely
    if (options.doctrine_applied === true) {
      console.log(`✅ [Doctrine Bypass] Answer already provided by Python doctrine, skipping RAG`);
      
      return {
        answer: "**Antwort durch doctrinale Analyse generiert**\n\nDie Antwort wurde bereits durch den Python-Autoritätsdienst erstellt.",
        citations: [],
        confidence: 0.9,
        documentsUsed: 0,
        metadata: {
          doctrine_bypass: true,
          statute: options.authority?.statute,
          paragraph: options.authority?.paragraph,
          processingTime: Date.now() - startTime,
          architecture: "doctrine_bypass"
        }
      };
    }

    // ⭐⭐ DOCTRINE: CRITICAL - Authority must be pre-resolved by Python
    if (!options.authority) {
      throw new Error(
        "RAGService called without authority metadata. Authority must be resolved by Python service."
      );
    }

    const { authority, domain_anchor = true, authority_mode = "overview" } = options;
    
    // ✅ NEW: EPISTEMIC SWITCH - Check for derivative norms from Python
    let retrievalStrategy = "STANDARD";
    let requiresSynthesis = false;
    let prohibitsQuotation = false;
    
    if (authority.normFunction === "DERIVATIVE" || authority.epistemicRole === "CONSEQUENCE_GATE") {
      console.log(`🧭 [Epistemic Switch] ${authority.statute} §${authority.paragraph} is derivative`);
      console.log(`   → Switching to consequence reasoning mode`);
      console.log(`   → Norm quotation disabled`);
      console.log(`   → Synthesis required`);
      
      retrievalStrategy = "CONSEQUENCE_ONLY";
      requiresSynthesis = true;
      prohibitsQuotation = true;
    }
    
    // Store in options for downstream use
    options.retrievalStrategy = retrievalStrategy;
    options.requiresSynthesis = requiresSynthesis;
    options.prohibitsQuotation = prohibitsQuotation;
    
    // ⭐⭐ FIX 4: Paragraph questions cannot be overview mode
    let authorityMode = authority_mode;
    if (authority.paragraph) {
      authorityMode = "exact";
      console.log(`🔒 [Mode Override] Paragraph question forced to exact mode`);
    }
    
    // ⭐⭐ DOCTRINE: AUTHORITY-MODE GATE (Python decides) ✅ NEW: Mode-based gate
    if (authority.authority_mode === 'none') {
      console.log(`⛔️ [Doctrine] RAG blocked - authority_mode is 'none'`);
      return this.getDoctrineBlockedResponse(
        startTime,
        language,
        'CONCEPTUAL_QUESTION_NO_RAG',
        authority.authority_mode
      );
    }

    const { statute, paragraph, isArticle } = authority;

    console.log(
      `🔒 [Authority] Python-resolved: ${statute}${
        paragraph ? ` ${isArticle ? "Art." : "§"}${paragraph}` : ""
      }`
    );
    console.log(`🚦 [Doctrine] Domain Anchor: ${domain_anchor}, Mode: ${authorityMode}`);
    console.log(`🧠 [Epistemic] Strategy: ${retrievalStrategy}, Synthesis: ${requiresSynthesis}`);

    // ⭐⭐ DOCTRINE: PRE-RETRIEVAL GATE - Enforce doctrine before any retrieval
    const gateResult = this.applyPreRetrievalGate(domain_anchor, authorityMode, statute);
    
    if (!gateResult.allowed) {
      console.log(`⛔️ [Doctrine] Retrieval blocked: ${gateResult.reason}`);
      return this.getDoctrineBlockedResponse(startTime, language, statute, gateResult.reason, authority.authority_mode);
    }

    // ⭐⭐ FIX 1: Pass paragraph into doctrine filter for hard locking
    const filteredDocuments = this.doctrineFilterDocuments(
      allDocuments, 
      statute, 
      paragraph,  // ⭐⭐ NEW: Paragraph passed for hard lock
      domain_anchor, 
      authorityMode
    );

    console.log(`📊 [Doctrine] Documents after filtering: ${filteredDocuments.length} / ${allDocuments.length}`);

    if (filteredDocuments.length === 0) {
      console.log(`⚠️  No documents for statute: ${statute} after doctrine filtering`);
      return this.handleMissingSourceQuestion(
        question,
        statute,
        startTime,
        language
      );
    }

    // ⭐⭐ DOCTRINE: CONVERT TO RAG FORMAT (no authority processing)
    const ragDocuments = this.convertToRAGFormat(filteredDocuments);

    if (ragDocuments.length === 0) {
      return this.getNoDocumentsResponse(startTime, language, statute);
    }

    // ⭐⭐ DOCTRINE: EXTRACT CHUNKS with domain validation
    let allChunks = [];

    ragDocuments.forEach((doc, docIndex) => {
      if (doc.chunks && Array.isArray(doc.chunks)) {
        doc.chunks.forEach((chunk, chunkIndex) => {
          const content = chunk.content || chunk;
          
          // ⭐⭐ DOCTRINE: Validate chunk belongs to allowed domain
          const chunkStatute = doc.metadata?.statute || this.extractStatuteFromDoc(doc);
          if (!this.isChunkAllowedInDomain(chunkStatute, statute, domain_anchor)) {
            console.log(`[Doctrine] Skipping chunk from excluded statute: ${chunkStatute}`);
            return; // Skip this chunk
          }
          
          allChunks.push({
            content: content,
            embeddings: chunk.embeddings || [],
            documentId: doc.id || `doc_${docIndex}`,
            documentName: doc.filename || `Document ${docIndex}`,
            documentStatute: chunkStatute,
            chunkIndex: chunkIndex,
            isBoilerplate: this.isBoilerplateContent(content),
            isExcludedStatute: this.isStatuteExcluded(chunkStatute, statute, domain_anchor),
            metadata: {
              wordCount: content.split(/\s+/).length,
              hasParagraph: /§\s*\d+/.test(content),
              hasArticle: /(?:Artikel|Art\.|Article)\s*\d+/.test(content),
              statute: chunkStatute,
            },
          });
        });
      }
    });

    console.log(`📑 [Doctrine] Total chunks after domain filtering: ${allChunks.length}`);

    if (allChunks.length === 0) {
      return this.getNoContentResponse(startTime, language, statute);
    }

    // ⭐⭐ DOCTRINE: REMOVE BOILERPLATE
    const originalCount = allChunks.length;
    allChunks = allChunks.filter((chunk) => !chunk.isBoilerplate);
    console.log(
      `🧹 Removed ${originalCount - allChunks.length} boilerplate chunks`
    );

    // ✅ NEW: Filter out derivative norm text if in consequence mode
    if (retrievalStrategy === "CONSEQUENCE_ONLY") {
      console.log(`🚫 [Consequence Mode] Filtering out derivative norm text for ${statute} §${paragraph}`);
      
      const filteredChunks = allChunks.filter(chunk => {
        const isDerivativeText = this.isDerivativeNormText(
          chunk.content, 
          statute, 
          paragraph
        );
        return !isDerivativeText;
      });
      
      console.log(`📊 After derivative norm filtering: ${filteredChunks.length} / ${allChunks.length} chunks`);
      allChunks = filteredChunks;
    }

    // ⭐⭐ DOCTRINE: ENFORCE PARAGRAPH MATCHING IF PROVIDED BY PYTHON
    let exactReferenceMatch = false;
    if (paragraph) {
      const matchingChunks = allChunks.filter((chunk) => {
        return this.doesChunkContainExactReference(chunk, statute, paragraph, isArticle);
      });

      if (matchingChunks.length > 0) {
        allChunks = matchingChunks;
        exactReferenceMatch = true;
        console.log(
          `✅ Found ${allChunks.length} chunks with exact ${
            isArticle ? "Article" : "§"
          }${paragraph} match in ${statute}`
        );
      } else {
        console.log(
          `⚠️  No exact match for ${isArticle ? "Article" : "§"}${paragraph} in ${statute}`
        );
        // Continue with all chunks - Python has already validated
      }
    }

    // ⭐⭐ DOCTRINE: Apply domain penalty to excluded statute chunks
    allChunks = allChunks.map(chunk => {
      const penalty = chunk.isExcludedStatute ? 0.3 : 0; // 30% penalty for excluded statutes
      return {
        ...chunk,
        domainPenalty: penalty
      };
    });

    // ⭐⭐ DOCTRINE: USE PYTHON-PROVIDED SEMANTIC CHUNKS
    let semanticChunks = options.semanticChunks || [];
    
    console.log(`🔍 Python provided ${semanticChunks.length} pre-ranked semantic chunks`);

    if (semanticChunks.length === 0) {
      console.log(`⚠️ No Python semantic chunks, checking if TF-IDF should be used`);
      
      // 🔴 CRITICAL FIX: Don't use TF-IDF for exact paragraph questions with high authority
      const shouldSkipTFIDF = 
        authority.authority_mode === 'exact' && 
        authority.paragraph && 
        authority.confidence > 0.7;
      
      if (shouldSkipTFIDF) {
        console.log(`🚫 [Doctrine] Skipping TF-IDF for exact paragraph ${authority.paragraph} with high confidence`);
        
        // Use exact paragraph matches only
        if (paragraph) {
          const exactMatches = allChunks.filter(chunk => 
            this.doesChunkContainExactReference(chunk, statute, paragraph, isArticle)
          );
          
          if (exactMatches.length > 0) {
            console.log(`✅ Using ${exactMatches.length} exact paragraph matches`);
            semanticChunks = exactMatches;
          } else {
            console.log(`⚠️ No exact matches, using all chunks without TF-IDF`);
            semanticChunks = allChunks;
          }
        } else {
          semanticChunks = allChunks;
        }
      } else {
        console.log(`⚠️ No Python semantic chunks, using TF-IDF fallback`);
        const tfidfChunks = this.tfidfRerank(allChunks, question);
        
        if (tfidfChunks.length === 0) {
          return this.getNoRelevantContentResponse(startTime, language, statute);
        }
        
        semanticChunks = tfidfChunks;
      }
    }

    // ⭐⭐ DOCTRINE: Filter out chunks from excluded statutes
    let filteredSemanticChunks = semanticChunks.filter(chunk => {
      const chunkStatute = chunk.documentStatute || chunk.statute;
      return this.isChunkAllowedInDomain(chunkStatute, statute, domain_anchor);
    });

    console.log(`🎯 After doctrine filtering: ${filteredSemanticChunks.length} semantic chunks`);

    // ✅ NEW: Apply TF-IDF reranking (secondary to semantic ranking)
    if (filteredSemanticChunks.length > 0) {
      filteredSemanticChunks = this.applyTFIDFReranking(
        filteredSemanticChunks, 
        question, 
        options.python_results
      );
    }

    // ⭐⭐ DOCTRINE: VALIDATE STATUTE STRUCTURE ONLY
    const structureValidation = this.validateAnswerStructure(
      filteredSemanticChunks[0]?.content || "",
      statute,
      paragraph,
      isArticle
    );

    if (!structureValidation.isValid) {
      console.log(`⚠️  Structure warning: ${structureValidation.message}`);
      // Continue anyway - Python has already done deep validation
    }

    // Attach query keywords to chunks for header-keyword boosting in rerankWithWeights
    // Only extract LEGAL TERMS (nouns ≥8 chars that aren't common German words)
    const COMMON_WORDS = new Set(['zwischen', 'welche', 'welcher', 'welches', 'einer', 'eines', 'einem', 'beim', 'werden', 'worden', 'wurden', 'hatten', 'koennen', 'koeünnen', 'mussen', 'sollen', 'unterschied', 'unterschiede', 'voraussetzung', 'voraussetzungen', 'allgemeine', 'allgemeinen', 'besondere', 'besonderen', 'rechtliche', 'rechtlichen', 'definition', 'bedeutung', 'erklaerung']);
    const queryKeywords = question
      .toLowerCase()
      .replace(/[^a-zäöüß\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 8 && !COMMON_WORDS.has(w));
    filteredSemanticChunks.forEach(c => { c._queryKeywords = queryKeywords; });

    // ⭐⭐ DOCTRINE: FINAL RANKING with domain penalties
    let rankedChunks = this.rerankWithWeights(
      filteredSemanticChunks,
      statute,
      paragraph,
      isArticle,
      retrievalStrategy
    );

    const topChunks = this.selectDiverseTopChunks(
      rankedChunks,
      this.MAX_CHUNKS
    );
    console.log(`🎯 Selected ${topChunks.length} top chunks for answer`);

    // ⭐⭐ FIX 3: EXTRACT CONTENT with norm-only extraction (FIXES BOILERPLATE)
    const legalRule = this.extractContentFromChunks(
      topChunks,
      statute,
      paragraph,
      options
    );

    // ⭐⭐ DOCTRINE: GENERATE ANSWER with doctrine context
    const answer = this.generateStructuredAnswer(
      legalRule,
      topChunks,
      language,
      statute,
      paragraph,
      isArticle,
      domain_anchor,
      options
    );

    // ⭐⭐ DOCTRINE: PREPARE CITATIONS with doctrine info
    const citations = this.prepareCitations(
      topChunks.slice(0, 3),
      statute
    );

    // ⭐⭐ FIX 5: CALCULATE CONFIDENCE with strict requirements
    const confidence = this.calculateConfidence(
      topChunks,
      exactReferenceMatch,
      legalRule,
      statute,
      domain_anchor,
      paragraph,
      options
    );

    // ⭐⭐ DOCTRINE: BUILD RESPONSE with doctrine metadata
    const response = this.buildResponse(
      answer,
      citations,
      confidence,
      ragDocuments.length,
      topChunks.length,
      startTime,
      statute,
      paragraph,
      exactReferenceMatch,
      structureValidation,
      topChunks,
      authority,
      domain_anchor,
      authorityMode,
      gateResult,
      options
    );

    // ⭐⭐ DOCTRINE: RUN SAFETY CHECK
    const safetyValidation = await safetyCheck.validateBeforeAnswer(
      question,
      response
    );
    response.safetyCheck = safetyValidation;

    console.log(
      `✅ [Doctrine] Answer generated for ${statute} with confidence: ${confidence.toFixed(2)}`
    );

    return response;
  }

  /* -------------------------------------------------
     FIX 1: STATUTE ANCHORING WITH HARD LOCK (CORRECTED VERSION)
  -------------------------------------------------- */

  /**
   * ⭐⭐ DOCTRINE: Filter documents according to gate rules
   * Penalizes chunks outside inferred domain
   * ✅ FIX 1: Added paragraph parameter for hard locking
   * ✅ CRITICAL FIX: Properly handles both exact and overview modes
   */
  doctrineFilterDocuments(allDocuments, anchorStatute, paragraph, domain_anchor, authority_mode) {
    // ⭐⭐ DOCTRINE: Domain anchor is always required
    if (!domain_anchor) return [];

    // ✅ EXACT MODE: Hard lock to anchor statute
    if (authority_mode === "exact") {
      console.log(`🔒 [Hard Lock] Exact mode – ONLY ${anchorStatute} allowed`);
      return allDocuments.filter(doc => {
        const docStatute = this.extractStatuteFromDoc(doc);
        return docStatute === anchorStatute;
      });
    }

    // ✅ OVERVIEW MODE: Domain-anchored with related statutes
    if (authority_mode === "overview") {
      console.log(`🌐 [Domain Anchor] Overview mode – ${anchorStatute} + related statutes`);
      
      return allDocuments.filter(doc => {
        const docStatute = this.extractStatuteFromDoc(doc);
        
        // Always allow the anchor statute
        if (docStatute === anchorStatute) {
          return true;
        }

        // Check if statute is explicitly excluded
        if (this.alwaysExcludedStatutes.includes(docStatute)) {
          return false;
        }

        // Check if statute is excluded for this domain
        const excludedForDomain = this.excludedStatutesForDomain[anchorStatute];
        if (excludedForDomain && excludedForDomain.includes(docStatute)) {
          console.log(`[Doctrine] Excluding ${docStatute} for ${anchorStatute} domain`);
          return false;
        }

        // For overview mode, allow some related statutes
        return this.isRelatedStatute(docStatute, anchorStatute);
      });
    }

    // Null/unknown authority_mode — fall back to overview so documents aren't silently dropped
    console.log(`⚠️ Unknown authority_mode "${authority_mode}" — falling back to overview filter`);
    return allDocuments.filter(doc => {
      const docStatute = this.extractStatuteFromDoc(doc);
      if (docStatute === anchorStatute) return true;
      if (this.alwaysExcludedStatutes.includes(docStatute)) return false;
      const excludedForDomain = this.excludedStatutesForDomain[anchorStatute];
      if (excludedForDomain && excludedForDomain.includes(docStatute)) return false;
      return this.isRelatedStatute(docStatute, anchorStatute);
    });
  }

  /* -------------------------------------------------
     FIX 3: NORM-ONLY EXTRACTION (NO BOILERPLATE) - UPDATED
  -------------------------------------------------- */

  /**
   * ⭐⭐ FIX 3: Extract content from chunks - NORM-ONLY extraction
   * Never extract rule from text without paragraph marker
   * ✅ UPDATED: Respects epistemic classification
   */
  extractContentFromChunks(chunks, statute, paragraph, options = {}) {
    if (!chunks || chunks.length === 0) {
      return "No relevant content found.";
    }

    // ✅ EPISTEMIC CHECK: No norm extraction for derivative norms
    if (options.retrievalStrategy === "CONSEQUENCE_ONLY" || options.prohibitsQuotation) {
      console.log(`🚫 [Epistemic] Skipping norm extraction for derivative norm ${statute} §${paragraph}`);
      return null; // Return null to signal no norm text should be quoted
    }

    // ⭐⭐ FIX 3: FIRST PRIORITY - exact paragraph match with norm validation
    if (paragraph) {
      for (const chunk of chunks) {
        const content = chunk.content || "";
        
        // Check if chunk contains the exact reference
        if (this.doesChunkContainExactReference(chunk, statute, paragraph, false)) {
          // Extract just the paragraph content, not surrounding text
          const sentences = content.split(/[.!?]+/);
          for (const sentence of sentences) {
            const trimmed = sentence.trim();
            // ⭐⭐ CRITICAL: Must contain paragraph marker to be considered a norm
            if ((/§\s*\d+/).test(trimmed) && trimmed.length > 20 && trimmed.length < 300) {
              return trimmed + ".";
            }
          }
        }
      }
    }

    // ⭐⭐ FIX 3: SECOND PRIORITY - any statutory norm
    for (const chunk of chunks) {
      const content = chunk.content || "";
      
      // ⭐⭐ CRITICAL REQUIREMENT: Must contain paragraph marker
      if (!(/§\s*\d+/).test(content)) {
        continue; // Skip non-normative content
      }
      
      const sentences = content.split(/[.!?]+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        // Only return sentences that look like legal norms
        if (trimmed.length > 30 && trimmed.length < 250 && 
            (/§\s*\d+/).test(trimmed) &&
            !this.isBoilerplateContent(trimmed)) {
          return trimmed + ".";
        }
      }
    }

    // ⭐⭐ FIX 3: ULTIMATE FALLBACK - first non-boilerplate with paragraph
    for (const chunk of chunks) {
      const content = chunk.content || "";
      const sentences = content.split(/[.!?]+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 40 && !this.isBoilerplateContent(trimmed)) {
          return trimmed + ".";
        }
      }
    }

    return "No specific rule identified from normative text.";
  }

  /* -------------------------------------------------
     FIX 5: STRICT CONFIDENCE SCORING - UPDATED
  -------------------------------------------------- */

  /**
   * ⭐⭐ FIX 5: Calculate confidence with strict requirements
   * ✅ UPDATED: Includes doctrine boost and epistemic handling
   */
  calculateConfidence(topChunks, exactReferenceMatch, legalRule, statute, domain_anchor, paragraph, options = {}) {
    // 🔴 CRITICAL FIX: DOCTRINE BOOST - If this came from Python doctrine, confidence is high
    if (options.doctrine_applied === true || options.authority?.normFunction === 'OPERATIVE') {
      console.log(`✅ [Doctrine] High confidence for operative norm from Python`);
      return Math.min(Math.max((options.authority?.confidence || 0.85), 0.8), 0.95);
    }

    if (topChunks.length === 0) return 0.1;

    let confidence = topChunks.reduce((sum, chunk) => 
      sum + (chunk.combinedScore || chunk.similarity || 0), 0) / topChunks.length;
    
    // Apply domain penalties
    const totalPenalty = topChunks.reduce((sum, chunk) => sum + (chunk.domainPenalty || 0), 0);
    confidence -= totalPenalty / topChunks.length;
    
    // ✅ EPISTEMIC BOOST: High confidence for correctly identified derivative norms
    if (options.retrievalStrategy === "CONSEQUENCE_ONLY") {
      confidence = Math.max(confidence, 0.85); // Minimum 85% for correct epistemic classification
      console.log(`✅ [Epistemic] Confidence boosted for derivative norm handling`);
      
      // Remove penalty for missing norm marker (derivative norms don't need it)
      if (!legalRule || legalRule === "No relevant content found.") {
        console.log(`✅ [Epistemic] No penalty for missing norm text in derivative mode`);
        // No penalty applied
      }
    } else {
      // Standard confidence penalties for operative norms
      // ⭐⭐ FIX 5: Penalty for paragraph without exact reference match
      if (paragraph && !exactReferenceMatch) {
        confidence *= 0.5;
        console.log(`⚠️ Confidence penalty: Paragraph ${paragraph} not found in retrieved chunks`);
      }
      
      // ⭐⭐ FIX 5: Penalty for answers without legal norm markers
      if (!legalRule.includes("§") && !legalRule.includes("Artikel")) {
        confidence = Math.min(confidence, 0.3);
        console.log(`⚠️ Confidence cap: Answer lacks legal norm marker`);
      }
    }
    
    // ⭐⭐ FIX 5: Boost for exact reference match
    if (exactReferenceMatch) confidence += 0.2;
    
    // Base confidence for different statutes
    if (statute === "BGB" || statute === "STGB") confidence *= 1.1;
    
    // Reduce confidence for domain-anchored mode (more restrictive)
    if (domain_anchor) confidence *= 0.9;
    
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /* -------------------------------------------------
     NEW: DERIVATIVE NORM DETECTION & HANDLING
  -------------------------------------------------- */

  /**
   * ✅ NEW: Check if chunk contains derivative norm text (pattern-based)
   * No hardcoding of norm numbers - uses linguistic patterns
   */
  isDerivativeNormText(content, statute, paragraph) {
    if (!content || typeof content !== 'string') return false;
    
    const lowerContent = content.toLowerCase();
    
    // Look for paragraph reference
    const paragraphPattern = new RegExp(`§\\s*${paragraph}\\b`, 'i');
    if (!paragraphPattern.test(lowerContent)) return false;
    
    // Check for derivative markers in the same sentence/context
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (paragraphPattern.test(sentence.toLowerCase())) {
        // Count derivative markers in this sentence
        const markerCount = this.derivativePatterns.filter(marker => 
          sentence.toLowerCase().includes(marker)
        ).length;
        
        // If sentence contains paragraph AND derivative markers, it's derivative norm text
        if (markerCount >= 2) {
          console.log(`🧭 [Derivative Detection] Found derivative norm text: ${sentence.substring(0, 80)}...`);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * ✅ NEW: Rerank with weights - updated for epistemic handling
   */
  rerankWithWeights(chunks, statute, paragraph, isArticle, retrievalStrategy = "STANDARD") {
    return chunks.sort((a, b) => {
      const scoreA = this.calculateChunkScore(a, statute, paragraph, isArticle, retrievalStrategy);
      const scoreB = this.calculateChunkScore(b, statute, paragraph, isArticle, retrievalStrategy);
      if (scoreB !== scoreA) return scoreB - scoreA;

      // Tiebreaker: prefer the chunk whose header has keyword as PRIMARY (first) content word
      if (a._queryKeywords && b._queryKeywords) {
        const keywords = a._queryKeywords;
        const primaryWordA = (a.content || '').split('\n')[0].replace(/^§\s*\d+[a-z]?\s*/i, '').split(/[\s,;:()]+/)[0]?.toLowerCase() || '';
        const primaryWordB = (b.content || '').split('\n')[0].replace(/^§\s*\d+[a-z]?\s*/i, '').split(/[\s,;:()]+/)[0]?.toLowerCase() || '';
        const isPrimaryMatchA = keywords.some(kw => primaryWordA.startsWith(kw));
        const isPrimaryMatchB = keywords.some(kw => primaryWordB.startsWith(kw));
        if (isPrimaryMatchA && !isPrimaryMatchB) return -1;
        if (isPrimaryMatchB && !isPrimaryMatchA) return 1;
        // Fall back to keyword index order
        const firstLineA = (a.content || '').split('\n')[0].toLowerCase();
        const firstLineB = (b.content || '').split('\n')[0].toLowerCase();
        const idxA = keywords.findIndex(kw => firstLineA.split(/[\s,;:()]+/).some(w => w.startsWith(kw)));
        const idxB = keywords.findIndex(kw => firstLineB.split(/[\s,;:()]+/).some(w => w.startsWith(kw)));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      return 0;
    });
  }

  /**
   * ✅ UPDATED: Calculate chunk score with epistemic considerations
   */
  calculateChunkScore(chunk, statute, paragraph, isArticle, retrievalStrategy = "STANDARD") {
    let score = chunk.combinedScore || chunk.similarity || 0.5;
    const content = chunk.content || "";

    // Apply domain penalty
    if (chunk.domainPenalty) {
      score -= chunk.domainPenalty;
    }

    // ✅ EPISTEMIC ADJUSTMENT: For derivative norms, don't boost for containing the norm text
    if (retrievalStrategy === "CONSEQUENCE_ONLY") {
      // Check if this chunk contains derivative norm text
      if (paragraph && this.isDerivativeNormText(content, statute, paragraph)) {
        console.log(`🚫 [Epistemic Penalty] Downweighting derivative norm text chunk`);
        score -= 0.8; // Heavy penalty for derivative norm text in consequence mode
      }
      
      // Boost for chunks from the prohibiting statute (if we can identify it)
      const prohibitsStatute = this.extractProhibitingStatute(content);
      if (prohibitsStatute && prohibitsStatute !== statute) {
        score += 0.4; // Boost for content about the actual prohibition
        console.log(`✅ [Epistemic Boost] Found prohibiting statute content: ${prohibitsStatute}`);
      }
    } else {
      // Standard scoring for operative norms
      // Boost for correct statute
      if (chunk.documentStatute === statute) {
        score += 0.3;
      }

      // Penalize excluded statutes
      if (chunk.isExcludedStatute) {
        score -= 0.4;
      }

      // Boost for exact paragraph match
      if (paragraph && this.doesChunkContainExactReference(chunk, statute, paragraph, isArticle)) {
        score += 0.5;
      }

      // Boost for containing statute name
      if (content.includes(statute)) {
        score += 0.2;
      }
    }

    // Boost for TF-IDF score if available
    if (chunk.tfidfScore > 0.5) {
      score += 0.1;
    }

    // Boost if the section header (first line of chunk) starts a word with a query keyword
    // Uses word-start matching to avoid "unterschied" matching "unterschieden" in body text
    if (chunk._queryKeywords && content) {
      const firstLine = content.split('\n')[0].toLowerCase();
      // Match keyword at word start: the word in firstLine must START with the keyword
      const hasHeaderKeyword = chunk._queryKeywords.some(kw => {
        const words = firstLine.split(/[\s,;:()]+/);
        return words.some(word => word.startsWith(kw.toLowerCase()));
      });
      if (hasHeaderKeyword) {
        score += 0.4;
      }
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  /* -------------------------------------------------
     UPDATED: ANSWER GENERATION WITH EPISTEMIC HANDLING
  -------------------------------------------------- */

  /**
   * ⭐⭐ DOCTRINE: GENERATE ANSWER with doctrine context
   * ✅ UPDATED: Handles derivative norms without hardcoded explanations
   */
  generateStructuredAnswer(legalRule, chunks, language, statute, paragraph, isArticle, domain_anchor, options = {}) {
    const statuteName = this.statuteDisplayNames[statute] || statute;

    const isGerman = language === 'german';
    let answer = isGerman
      ? `**Rechtslage nach ${statuteName}:**\n\n`
      : `**Legal situation according to ${statuteName}:**\n\n`;

    // ✅ EPISTEMIC HANDLING: Derivative norms get special treatment
    if (options.retrievalStrategy === "CONSEQUENCE_ONLY") {
      answer += isGerman
        ? `*[Folgenbetrachtungs-Modus – Bezugsnorm-Analyse]*\n\n`
        : `*[Consequence reasoning mode – reference norm analysis]*\n\n`;

      if (paragraph) {
        answer += isGerman
          ? `**Bezugsnorm:** ${isArticle ? 'Artikel' : '§'} ${paragraph}\n\n`
          : `**Reference Norm:** ${isArticle ? 'Article' : '§'} ${paragraph}\n\n`;
      }
      
      // No "Rule:" section for derivative norms
      answer += `**Analysis:**\n`;
      
      // Try to extract the prohibiting statute from chunks
      const prohibitingStatute = this.extractProhibitingStatuteFromChunks(chunks);
      
      if (language === "german") {
        answer += `${statute} §${paragraph} regelt die Rechtsfolgen bei Verstößen gegen gesetzliche Verbote. `;
        if (prohibitingStatute) {
          answer += `Im vorliegenden Fall ist ${prohibitingStatute} als das verletzte Gesetz relevant. `;
        }
        answer += `Die Prüfung erfordert: 1) Feststellung des gesetzlichen Verbots, 2) Prüfung des Verstoßes, 3) Anwendung der Nichtigkeitsfolge nach §${paragraph}.`;
      } else {
        answer += `${statute} §${paragraph} governs the legal consequences for violations of statutory prohibitions. `;
        if (prohibitingStatute) {
          answer += `In this case, ${prohibitingStatute} is relevant as the violated statute. `;
        }
        answer += `The analysis requires: 1) Identification of the statutory prohibition, 2) Examination of the violation, 3) Application of the nullity consequence under §${paragraph}.`;
      }
      
      answer += `\n\n`;
      
      // Add synthesis from relevant chunks (not derivative norm text)
      if (chunks.length > 0) {
        answer += `**Relevant considerations:**\n`;
        chunks.slice(0, 3).forEach((chunk, index) => {
          const content = chunk.content || "";
          // Skip derivative norm text
          if (paragraph && this.isDerivativeNormText(content, statute, paragraph)) {
            return;
          }
          
          const sentences = content.split(/[.!?]+/);
          if (sentences.length > 0) {
            const firstSentence = sentences[0].trim();
            if (firstSentence.length > 20) {
              answer += `${index + 1}. ${firstSentence}.\n`;
            }
          }
        });
      }
    } else {
      // Standard operative norm handling
      if (domain_anchor) {
        answer += isGerman
          ? `*[Domänen-verankerte Übersichtsdarstellung – Abruf auf Ankernormen beschränkt]*\n\n`
          : `*[Domain-anchored overview mode - retrieval limited to anchor norms]*\n\n`;
      }

      if (paragraph) {
        answer += isGerman
          ? `**Norm:** ${isArticle ? 'Artikel' : '§'} ${paragraph}\n\n`
          : `**Norm:** ${isArticle ? 'Article' : '§'} ${paragraph}\n\n`;
      }

      const ruleLabel = isGerman ? 'Regelung' : 'Rule';
      answer += `**${ruleLabel}:**\n${legalRule || (isGerman ? "Keine spezifische Regelung gefunden." : "No specific rule extracted.")}\n\n`;

      // Add context
      if (chunks.length > 0) {
        const ctxLabel = isGerman ? 'Kontext' : 'Context';
        answer += `**${ctxLabel}:**\n`;
        chunks.slice(0, 2).forEach((chunk) => {
          const content = chunk.content || "";
          const firstSentence = content.split(/[.!?]+/)[0];
          if (firstSentence && firstSentence.trim().length > 20) {
            answer += `${firstSentence.trim()}.\n`;
          }
        });
      }
    }

    // Add TF-IDF indicator if used
    if (chunks.some(chunk => chunk.tfidfScore > 0)) {
      answer += isGerman
        ? `\n*Antwort nutzt lexikalische Präzision via TF-IDF.*`
        : `\n*Answer incorporates lexical precision via TF-IDF.*`;
    }

    answer += isGerman
      ? `\n*Basierend auf deutschen Rechtsdokumenten. Keine Rechtsberatung.*`
      : `\n*Based on German legal documents. This is not legal advice.*`;
    return answer.trim();
  }

  /* -------------------------------------------------
     HELPER METHODS (unchanged except for enhancements)
  -------------------------------------------------- */

  tfidfRerank(chunks, query) {
    if (!chunks || chunks.length === 0 || !query || query.trim().length < 3) {
      return chunks;
    }

    // Guard: O(n²) TF-IDF blocks the event loop above ~200 chunks. Return as-is when oversized.
    if (chunks.length > 200) {
      console.log(`⚠️ TF-IDF skipped: ${chunks.length} chunks exceeds safe limit (200). Returning pre-ranked results.`);
      return chunks;
    }

    console.log(`📊 Applying TF-IDF reranking for query: "${query.substring(0, 50)}..."`);
    
    // Clear and rebuild TF-IDF index
    this.tfidf = new natural.TfIdf();
    
    // Add documents to TF-IDF index
    chunks.forEach((chunk, index) => {
      this.tfidf.addDocument(chunk.content || '', { index, chunk });
    });

    // Get TF-IDF scores for query
    const scoredChunks = chunks.map((chunk, index) => {
      let tfidfScore = 0;
      this.tfidf.tfidfs(query, (i, measure) => {
        if (i === index) {
          tfidfScore = measure;
        }
      });
      
      return {
        ...chunk,
        tfidfScore: tfidfScore,
        combinedScore: (chunk.similarity || 0.5) * 0.7 + tfidfScore * 0.3
      };
    });

    // Sort by combined score
    return scoredChunks.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  applyTFIDFReranking(semanticChunks, question, pythonResults = null) {
    // Only apply TF-IDF if we have enough chunks and a meaningful query
    if (semanticChunks.length < 2 || !question || question.length < 5) {
      return semanticChunks;
    }

    // Check if Python already provided authoritative results
    const hasPythonAuthority = pythonResults?.authoritative_found;
    
    if (hasPythonAuthority) {
      console.log(`✅ Python authority found, TF-IDF used only for fine-tuning`);
      // Keep Python ranking as primary, TF-IDF as minor adjustment
      return this.tfidfRerank(semanticChunks, question);
    } else {
      console.log(`⚠️ No Python authority, TF-IDF used for lexical precision`);
      // More weight to TF-IDF when semantic authority is weak
      return this.tfidfRerank(semanticChunks, question);
    }
  }

  /* -------------------------------------------------
     CRITICAL FIX: applyPreRetrievalGate - CORRECTED
  -------------------------------------------------- */

  applyPreRetrievalGate(domain_anchor, authority_mode, statute) {
    if (!domain_anchor) {
      return {
        allowed: false,
        reason: "Domain anchor must be true for doctrine-compliant retrieval"
      };
    }

    // ✅ DOCTRINAL NORMALIZATION (NOT BLOCKING)
    if (authority_mode === "exact") {
      return {
        allowed: true,
        reason: "Exact authority mode allowed (paragraph-locked retrieval)",
        retrievalScope: "exact_norm_only"
      };
    }

    if (authority_mode === "overview") {
      // Check if statute is in always-excluded list
      if (this.alwaysExcludedStatutes.includes(statute)) {
        return {
          allowed: false,
          reason: `Statute '${statute}' is explicitly excluded by doctrine`
        };
      }

      return {
        allowed: true,
        reason: "Overview authority mode allowed (anchor-norm retrieval)",
        retrievalScope: "anchor_norms_only"
      };
    }

    return {
      allowed: false,
      reason: `Authority mode '${authority_mode}' is not recognized`
    };
  }

  /* -------------------------------------------------
     NEW HELPER METHODS FOR DERIVATIVE NORMS
  -------------------------------------------------- */

  /**
   * ✅ NEW: Extract prohibiting statute from chunk content
   */
  extractProhibitingStatute(content) {
    if (!content) return null;
    
    // Common statutes that are often prohibited
    const commonProhibitingStatutes = [
      "StBerG", "GewO", "UWG", "HGB", "AO", "StGB", "ZPO"
    ];
    
    for (const statute of commonProhibitingStatutes) {
      if (content.includes(statute)) {
        return statute;
      }
    }
    
    return null;
  }

  /**
   * ✅ NEW: Extract prohibiting statute from multiple chunks
   */
  extractProhibitingStatuteFromChunks(chunks) {
    if (!chunks || chunks.length === 0) return null;
    
    const statuteCounts = {};
    
    for (const chunk of chunks) {
      const statute = this.extractProhibitingStatute(chunk.content || "");
      if (statute) {
        statuteCounts[statute] = (statuteCounts[statute] || 0) + 1;
      }
    }
    
    // Return the most frequently mentioned statute
    let maxCount = 0;
    let mostFrequentStatute = null;
    
    for (const [statute, count] of Object.entries(statuteCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentStatute = statute;
      }
    }
    
    return mostFrequentStatute;
  }

  /* -------------------------------------------------
     EXISTING HELPER METHODS (updated signatures where needed)
  -------------------------------------------------- */

  isChunkAllowedInDomain(chunkStatute, anchorStatute, domain_anchor) {
    if (!domain_anchor) return true;
    
    if (chunkStatute === anchorStatute) return true;
    
    if (this.alwaysExcludedStatutes.includes(chunkStatute)) {
      return false;
    }
    
    const excludedForDomain = this.excludedStatutesForDomain[anchorStatute];
    if (excludedForDomain && excludedForDomain.includes(chunkStatute)) {
      return false;
    }
    
    return this.isRelatedStatute(chunkStatute, anchorStatute);
  }

  isStatuteExcluded(chunkStatute, anchorStatute, domain_anchor) {
    if (!domain_anchor) return false;
    
    if (this.alwaysExcludedStatutes.includes(chunkStatute)) return true;
    
    const excludedForDomain = this.excludedStatutesForDomain[anchorStatute];
    if (excludedForDomain && excludedForDomain.includes(chunkStatute)) {
      return true;
    }
    
    return false;
  }

  isRelatedStatute(statuteA, statuteB) {
    // Group statutes by legal domain
    const domains = {
      civil: ["BGB", "HGB", "ZPO", "GWB", "AGBG"],
      criminal: ["StGB", "StPO", "OwiG", "BtmG"],
      constitutional: ["GG", "VwVfG", "VwGO"],
      data_protection: ["EU-GDPR", "BDSG", "TTDSG"]
    };

    for (const domain of Object.values(domains)) {
      if (domain.includes(statuteA) && domain.includes(statuteB)) {
        return true;
      }
    }
    
    return false;
  }

  filterByStatute(statute, allDocuments) {
    return allDocuments.filter(doc => {
      const docStatute = this.extractStatuteFromDoc(doc);
      return docStatute === statute;
    });
  }

  convertToRAGFormat(documents) {
    return documents.map((doc) => {
      // If document already has chunks from PDF parsing, use them
      if (doc.chunks && Array.isArray(doc.chunks)) {
        return {
          id: doc.id || doc.filename,
          filename: doc.filename,
          content: doc.content || "",
          chunks: doc.chunks,
          metadata: doc.metadata || {
            title: doc.title,
            type: doc.type,
            statute: this.extractStatuteFromDoc(doc),
          },
        };
      }

      // Fallback: create chunks from content
      return {
        id: doc.id || doc.filename,
        filename: doc.filename,
        content: doc.content || "",
        chunks: this.createChunksFromContent(doc.content || ""),
        metadata: doc.metadata || {
          title: doc.title,
          type: doc.type,
          statute: this.extractStatuteFromDoc(doc),
        },
      };
    });
  }

  createChunksFromContent(content) {
    if (!content) return [];
    const paragraphs = content.split(/\n\s*\n/);
    return paragraphs
      .filter((p) => p.trim().length > 30)
      .map((paragraph, index) => ({
        content: paragraph.trim(),
        chunkIndex: index,
      }));
  }

  extractStatuteFromDoc(doc) {
    return doc.metadata?.statute || 
           (doc.filename || "").match(/(StGB|BGB|HGB|GG|GDPR|ZPO|StPO|BDSG)/i)?.[1]?.toUpperCase() || 
           null;
  }

  doesChunkContainExactReference(chunk, statute, paragraph, isArticle) {
    const content = chunk.content || "";
    
    if (isArticle) {
      const articlePatterns = [
        new RegExp(`Artikel\\s*${paragraph}\\b`, "i"),
        new RegExp(`Artikel\\s*${paragraph}\\(`, "i"),
        new RegExp(`Art\\.\\s*${paragraph}\\b`, "i")
      ];
      return articlePatterns.some(pattern => pattern.test(content));
    } else {
      const paragraphPatterns = [
        new RegExp(`§\\s*${paragraph}\\b`, "i"),
        new RegExp(`§\\s*${paragraph}\\(`, "i"),
        new RegExp(`§\\s*${paragraph}\\s+[A-Z]`, "i")
      ];
      return paragraphPatterns.some(pattern => pattern.test(content));
    }
  }

  isBoilerplateContent(text) {
    if (!text || typeof text !== "string") return true;
    if (text.length < 20) return true;

    const boilerplatePatterns = [
      "Übersetzung",
      "Translation",
      "register notices",
      "Copyright",
      "CELEX",
      "Official Journal",
      "gesetze-im-internet.de",
      "juris",
      "reproduced",
      "PDF generated",
      "Stand:",
      "zuletzt geändert",
      "Inhaltsübersicht",
      "Inhaltsverzeichnis",
      // PDF page headers from gesetze-im-internet.de
      "Bundesministerium",
      "Bundesamts für Justiz",
      "bundesamt für justiz",
      "Ein Service des",
      "www.gesetze",
      "Seite ",          // "Seite 92 von 254"
      "von 254",
      "von 112",
      "von 98",
      // Transitional/ancillary law chunks
      "BGBEG",
      "EGGmbHG",
      "EGStGB",
      "EGStPO",
      "+++",
      "Zur Nichtanwendung",
      "Zur Anwendung d.",
      "Kreditinstituts-Rechnungslegungsverordnung",
      "Rechnungslegungsverordnung",
      "Telekommunikationsgesetzes",
      "Binnenschifffahrtsgesetzes",
      "Binnenschifffahrt",
      "geltend zu machen, bleibt unberührt",
    ];

    const lower = text.toLowerCase();
    return boilerplatePatterns.some((pattern) =>
      lower.includes(pattern.toLowerCase())
    );
  }

  validateAnswerStructure(answerText, statute, paragraph, isArticle) {
    const hasStatute = answerText.includes(statute);
    let hasReference = true;
    
    if (paragraph) {
      if (isArticle) {
        const articlePattern = new RegExp(
          `(?:Artikel|Art\\.|Article)\\s*${paragraph}\\b`,
          "i"
        );
        hasReference = articlePattern.test(answerText);
      } else {
        const paragraphPattern = new RegExp(`§\\s*${paragraph}\\b`, "i");
        hasReference = paragraphPattern.test(answerText);
      }
    }
    
    const isValid = hasStatute && (!paragraph || hasReference);
    
    return {
      isValid,
      message: isValid 
        ? "Structure valid" 
        : `Missing ${!hasStatute ? statute : `${isArticle ? 'Article' : '§'}${paragraph}`}`
    };
  }

  selectDiverseTopChunks(chunks, limit) {
    const selected = [];
    // Deduplicate by paragraph (metadata.paragraph), falling back to documentId.
    // Using documentId alone causes only 1 chunk when all chunks are from the same statute PDF.
    const usedKeys = new Set();

    for (const chunk of chunks) {
      if (selected.length >= limit) break;
      const key = chunk.metadata?.paragraph
        ? `${chunk.documentId}::${chunk.metadata.paragraph}`
        : chunk.documentId;
      if (!usedKeys.has(key)) {
        selected.push(chunk);
        usedKeys.add(key);
      }
    }

    return selected;
  }

  prepareCitations(chunks, statute) {
    return chunks.map((chunk, index) => {
      const content = chunk.content || "";
      let excerpt = content.replace(/\s+/g, " ").trim();
      if (excerpt.length > 150) excerpt = excerpt.substring(0, 150) + "...";

      const simNum   = parseFloat(chunk.similarity)  || 0;
      const tfidfNum = parseFloat(chunk.tfidfScore) || 0;
      const combined = chunk.combinedScore || (simNum * 0.7 + tfidfNum * 0.3) || simNum || 0.5;
      return {
        id: index + 1,
        document: chunk.documentName,
        statute: statute,
        excerpt: excerpt,
        relevance: Math.min(1, Math.max(0, combined)),
        similarity: chunk.similarity?.toFixed(3) || "0.500",
        tfidfScore: chunk.tfidfScore?.toFixed(3) || "0.000",
        domainPenalty: chunk.domainPenalty || 0,
      };
    });
  }

  /* -------------------------------------------------
     UPDATED: BUILD RESPONSE WITH EPISTEMIC METADATA
  -------------------------------------------------- */

  buildResponse(answer, citations, confidence, documentsUsed, chunksUsed, startTime, statute, paragraph, exactReferenceMatch, structureValidation, chunks, authority, domain_anchor, authority_mode, gateResult, options = {}) {
    const metadata = {
      statute: statute,
      paragraph: paragraph,
      exactReferenceMatch: exactReferenceMatch,
      chunksUsed: chunksUsed,
      processingTime: Date.now() - startTime,
      architecture: "doctrine_enforced_rag",
      authoritySource: "python_service",
      structureValidation: structureValidation,
      pythonAuthority: authority,
      doctrineEnforcement: {
        domain_anchor: domain_anchor,
        authority_mode: authority_mode,
        preRetrievalGate: gateResult,
        excludedStatutes: this.alwaysExcludedStatutes,
        retrievalScope: gateResult.retrievalScope || "full",
      },
      tfidfUsed: chunks.some(chunk => chunk.tfidfScore > 0),
      chunkMetadata: chunks.map(chunk => ({
        statute: chunk.documentStatute,
        hasPenalty: !!chunk.domainPenalty,
        isExcluded: chunk.isExcludedStatute || false,
        tfidfScore: chunk.tfidfScore || 0
      })),
      // ✅ NEW: Epistemic metadata
      epistemic: {
        normFunction: authority.normFunction || "OPERATIVE",
        epistemicRole: authority.epistemicRole || "CONTENT_PROVIDING",
        retrievalStrategy: options.retrievalStrategy || "STANDARD",
        requiresSynthesis: options.requiresSynthesis || false,
        prohibitsQuotation: options.prohibitsQuotation || false
      }
    };

    return {
      answer: answer,
      citations: citations,
      confidence: confidence,
      documentsUsed: documentsUsed,
      metadata: metadata
    };
  }

  /* -------------------------------------------------
     ERROR HANDLERS (unchanged)
  -------------------------------------------------- */

  getDoctrineBlockedResponse(startTime, language, reason, authority_mode = 'none') {
    const message = language === "german" 
      ? `**Doctrine-Verstoß: Retrieval blockiert**\n\n${reason}\n\nDie Anfrage kann nicht gemäß den Doctrine-Regeln verarbeitet werden.`
      : `**Doctrine Violation: Retrieval Blocked**\n\n${reason}\n\nThe request cannot be processed according to doctrine rules.`;

    return {
      answer: "Keine gesicherte Grundlage gefunden. Bitte präzisieren Sie Ihre Frage.",
      citations: [],
      confidence: 0,
      refused: true,
      documentsUsed: 0,
      metadata: {
        processingTime: Date.now() - startTime,
        doctrineBlocked: true,
        blockReason: reason,
        authority_mode: authority_mode,
        confidence: 0,
      },
    };
  }

  handleMissingSourceQuestion(question, missingStatute, startTime, language) {
    const statuteName = this.statuteDisplayNames[missingStatute] || missingStatute;
    const message = language === "german" 
      ? `**Fehlende Quelle: ${statuteName}**\n\nKeine Dokumente für ${statuteName} geladen.`
      : `**Missing Source: ${statuteName}**\n\nNo documents loaded for ${statuteName}.`;

    return {
      answer: message,
      citations: [],
      confidence: 0.1,
      documentsUsed: 0,
      metadata: {
        missingStatute: missingStatute,
        processingTime: Date.now() - startTime,
        confidence: 0.1,
      },
    };
  }

  getNoDocumentsResponse(startTime, language, statute) {
    const statuteName = this.statuteDisplayNames[statute] || statute;
    const message = language === "german"
      ? `**Keine ${statuteName}-Dokumente verfügbar**`
      : `**No ${statuteName} documents available**`;

    return {
      answer: message,
      citations: [],
      confidence: 0.1,
      documentsUsed: 0,
      metadata: {
        statute: statute,
        processingTime: Date.now() - startTime,
        confidence: 0.1,
      },
    };
  }

  getNoContentResponse(startTime, language, statute) {
    const statuteName = this.statuteDisplayNames[statute] || statute;
    const message = language === "german"
      ? `**Keine Textabschnitte für ${statuteName} gefunden**`
      : `**No text chunks found for ${statuteName}**`;

    return {
      answer: message,
      citations: [],
      confidence: 0.1,
      documentsUsed: 0,
      metadata: {
        statute: statute,
        processingTime: Date.now() - startTime,
        confidence: 0.1,
      },
    };
  }

  getNoRelevantContentResponse(startTime, language, statute) {
    const statuteName = this.statuteDisplayNames[statute] || statute;
    const message = language === "german"
      ? `**Keine relevanten Textstellen in ${statuteName} gefunden**`
      : `**No relevant text found in ${statuteName}**`;

    return {
      answer: message,
      citations: [],
      confidence: 0.1,
      documentsUsed: 0,
      metadata: {
        statute: statute,
        processingTime: Date.now() - startTime,
        confidence: 0.1,
      },
    };
  }
}

module.exports = new RAGService();