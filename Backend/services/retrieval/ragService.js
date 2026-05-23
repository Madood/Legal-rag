const safetyCheck = require("../validation/safetyCheck");
const natural = require("natural");
const { isEBVQuestion } = require("./queryClassifier");

class RAGService {
  constructor() {
    this.MAX_CHUNKS = 5;

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
      "BGB":  ["STGB", "STPO", "OwiG", "VwVfG", "HGB", "ZPO"],
      "HGB":  ["STGB", "STPO", "OwiG", "VwVfG"],
      "GG":   ["HGB", "ZPO", "STPO"],
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

    // Expand rare / English terms into their German statute equivalents so
    // TF-IDF can score German corpus text. Only appended — original question preserved.
    const _QUERY_EXPANSION = {
      'good faith':        'gutgläubig Erwerb § 932 § 929 § 935 Nichtberechtigter',
      'good-faith':        'gutgläubig Erwerb § 932 § 929 § 935',
      'gutgläubig':        'good faith § 932 § 929 § 935 Erwerber Eigentum',
      'bona fide':         'gutgläubig § 932 § 929 § 935',
      'herrenlos':         'Aneignung § 958 § 959 § 960 herrenlose Sachen',
      'abandoned property':'herrenlose Sachen § 958 § 959 § 960 Aneignung',
      'ownerless':         'herrenlos § 958 § 959 § 960 Aneignung',
      'drohung':           'Anfechtung § 123 widerrechtlich Bedrohung',
      'duress':            'Drohung § 123 Anfechtung widerrechtlich',
      'threat':            'Drohung § 123 Anfechtung',
      'fraud':             'Täuschung § 123 Betrug arglistig',
      'fraudulent':        'arglistig § 123 Täuschung Anfechtung',
    };
    let expandedQuestion = question;
    for (const [term, expansion] of Object.entries(_QUERY_EXPANSION)) {
      if (question.toLowerCase().includes(term.toLowerCase())) {
        expandedQuestion += ' ' + expansion;
        console.log(`[QueryExpand] "${term}" → appended: ${expansion}`);
      }
    }

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

    // ── EBV guard — must fire before authority check so it catches zero-chunk cases ──
    if (isEBVQuestion(question)) {
      const ebvResult = this.handleEBVQuestion(question, options.semanticChunks || []);
      if (ebvResult) {
        return {
          ...ebvResult,
          metadata: { ...ebvResult.metadata, processingTime: Date.now() - startTime }
        };
      }
    }

    // ⭐⭐ DOCTRINE: CRITICAL - Authority must be pre-resolved by Python
    if (!options.authority) {
      throw new Error(
        "RAGService called without authority metadata. Authority must be resolved by Python service."
      );
    }

    const { authority, domain_anchor = true, authority_mode = "overview" } = options;

    // ── Analytical override — computed early so it can bypass authority_mode gate ──
    const ANALYTICAL_SIGNALS = [
      'rechte','welche rechte','ansprüche','welche ansprüche',
      'voraussetzungen','welche voraussetzungen','rechtsfolgen',
      'was sind','was regelt','erklären','erläutern',
      'unterschied','unterscheiden','vergleich','inwiefern',
      'wie wirkt','bedeutung','warum','weshalb',
      'ex tunc','ex nunc','prüfung','prüfungsschema',
      'konsequenzen','auswirkungen','abgrenzung',
      'nichtigkeit','anfechtbarkeit','kausalität','zurechenbarkeit',
      'sachmängel','wie funktioniert','was bedeutet',
      'was versteht man','welche bedeutung',
    ];
    const isAnalytical = ANALYTICAL_SIGNALS.some(s =>
      question.toLowerCase().includes(s)
    ) && question.length > 30;

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
    // isAnalytical overrides 'none' — synthesis is our own layer on top of epistemic rules
    if (authority.authority_mode === 'none' && !isAnalytical) {
      console.log(`⛔️ [Doctrine] RAG blocked - authority_mode is 'none'`);
      return this.getDoctrineBlockedResponse(
        startTime,
        language,
        'CONCEPTUAL_QUESTION_NO_RAG',
        authority.authority_mode
      );
    }
    if (authority.authority_mode === 'none' && isAnalytical) {
      console.log(`✅ [Analytical Override] authority_mode='none' bypassed — isAnalytical=true, proceeding to synthesis`);
    }

    let { statute, paragraph, isArticle } = authority;

    // Guard: null statute crashes doctrineFilterDocuments → handleMissingSourceQuestion
    if (!statute || statute === 'null' || statute === 'UNKNOWN') {
      console.warn(`[RAG] Statute was "${statute}" — defaulting to BGB`);
      statute = 'BGB';
    }

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
          
          const _origPara = chunk.metadata?.paragraph || chunk.paragraph || '';
          allChunks.push({
            content: content,
            embeddings: chunk.embeddings || [],
            documentId: doc.id || `doc_${docIndex}`,
            documentName: doc.filename || `Document ${docIndex}`,
            documentStatute: chunkStatute,
            paragraph: _origPara,
            chunkIndex: chunkIndex,
            isBoilerplate: this.isBoilerplateContent(content),
            isExcludedStatute: this.isStatuteExcluded(chunkStatute, statute, domain_anchor),
            metadata: {
              wordCount: content.split(/\s+/).length,
              hasParagraph: /§\s*\d+/.test(content),
              hasArticle: /(?:Artikel|Art\.|Article)\s*\d+/.test(content),
              statute: chunkStatute,
              paragraph: _origPara,
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
            console.log(`⚠️ No exact matches, TF-IDF is only option — running on all chunks`);
            semanticChunks = this.tfidfRerank(allChunks, expandedQuestion);
          }
        } else {
          semanticChunks = allChunks;
        }
      } else {
        console.log(`⚠️ No Python semantic chunks, using TF-IDF fallback`);
        const tfidfChunks = this.tfidfRerank(allChunks, expandedQuestion);
        
        if (tfidfChunks.length === 0) {
          return this.getNoRelevantContentResponse(startTime, language, statute);
        }
        
        semanticChunks = tfidfChunks;
      }
    }

    // ⭐⭐ DOCTRINE: Filter out chunks from excluded statutes
    let filteredSemanticChunks = semanticChunks.filter(chunk => {
      const chunkStatute = chunk.documentStatute || chunk.statute
        || (chunk.metadata || {}).statute || chunk.source || '';
      if (!chunkStatute) return true; // no statute label → already domain-filtered upstream
      return this.isChunkAllowedInDomain(chunkStatute, statute, domain_anchor);
    });

    console.log(`🎯 [Doctrine] After doctrine filtering: ${filteredSemanticChunks.length} semantic chunks`);

    // ✅ NEW: Apply TF-IDF reranking (secondary to semantic ranking)
    if (filteredSemanticChunks.length > 0) {
      filteredSemanticChunks = this.applyTFIDFReranking(
        filteredSemanticChunks,
        expandedQuestion,
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

    let topChunks = this.selectDiverseTopChunks(
      rankedChunks,
      this.MAX_CHUNKS
    );
    // Guarantee minimum 5 chunks — deduplication by documentId is too aggressive
    // when all chunks come from a single statute PDF with no paragraph metadata
    if (topChunks.length < 5 && rankedChunks.length > topChunks.length) {
      topChunks = rankedChunks.slice(0, Math.max(5, this.MAX_CHUNKS));
    }
    console.log(`🎯 Selected ${topChunks.length} top chunks for answer`);

    // ── Multi-term chunk retrieval ───────────────────────────────────────────────
    // For questions containing known legal term pairs, retrieve dedicated chunks
    // for each term so both sides of a comparison are represented.
    const LEGAL_TERM_PAIRS = {
      'nichtigkeit':    ['nichtig', 'nichtigkeit', '§ 105', '§ 125'],
      'anfechtbar':     ['anfechtbar', 'anfechtung', '§ 119', '§ 123', '§ 142'],
      'anfechtung':     ['anfechtung', '§ 119', '§ 143'],
      'verjährung':     ['verjährung', '§ 195', '§ 199'],
      'besitz':         ['§ 854', '§ 868', '§ 872', '§ 855', '§ 858', '§ 986', 'besitz'],
      'eigentum':       ['§ 903', '§ 929', '§ 985', '§ 986', 'eigentum'],
      'schadensersatz': ['schadensersatz', '§ 249', '§ 280', '§ 823'],
      'notwehr':        ['notwehr', '§ 32'],
      'vorsatz':        ['vorsatz', '§ 15'],
      'fahrlässigkeit': ['fahrlässigkeit', '§ 15', '§ 276'],
      'mahnung':        ['mahnung', '§ 286', '§ 280', '§ 288', '§ 287'],
      'verzug':         ['verzug', '§ 286', '§ 280', '§ 288', '§ 287', '§ 293'],
      'schuldnerverzug':['schuldnerverzug', '§ 286', '§ 287', '§ 288'],
      // Good-faith acquisition (§§ 929, 932, 935)
      'good faith':     ['§ 932', '§ 929', '§ 935', 'gutgläubig'],
      'gutgläubig':     ['§ 932', '§ 929', '§ 935', 'gutgläubig', 'erwerb'],
      'bona fide':      ['§ 932', '§ 929', '§ 935', 'gutgläubig'],
      // Herrenlose Sachen / ownerless property (§§ 958–960)
      'herrenlos':      ['§ 958', '§ 959', '§ 960', 'herrenlos', 'aneignung'],
      'abandoned':      ['§ 958', '§ 959', '§ 960', 'herrenlos', 'aneignung'],
      'ownerless':      ['§ 958', '§ 959', '§ 960', 'herrenlos'],
      // Drohung / duress (§ 123)
      'drohung':        ['§ 123', 'drohung', 'anfechtung', 'widerrechtlich'],
      'duress':         ['§ 123', 'drohung', 'anfechtung'],
      'threat':         ['§ 123', 'drohung'],
    };

    const questionLower = question.toLowerCase();
    const matchedTerms = Object.keys(LEGAL_TERM_PAIRS).filter(t => questionLower.includes(t));

    if (matchedTerms.length > 0 && allChunks?.length > 0) {
      console.log('[Multi-term] Matched terms:', matchedTerms);
      const multiChunks = [];
      for (const term of matchedTerms) {
        for (const searchTerm of LEGAL_TERM_PAIRS[term]) {
          const found = allChunks.filter(c =>
            (c.content || '').toLowerCase().includes(searchTerm.toLowerCase())
          ).slice(0, 2);
          multiChunks.push(...found);
        }
      }
      const seen = new Set();
      const dedupedChunks = multiChunks.filter(c => {
        const key = (c.content || '').substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (dedupedChunks.length >= 2) {
        topChunks = dedupedChunks.slice(0, 8);
        console.log('[Multi-term] Using', topChunks.length, 'multi-term chunks');
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // ⭐⭐ FIX 3: EXTRACT CONTENT with norm-only extraction (FIXES BOILERPLATE)
    // Use only the top-ranked chunk so Rule and Context always refer to the same source.
    const legalRule = this.extractContentFromChunks(
      topChunks.slice(0, 1),
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

    // ── DeepSeek Synthesis for analytical questions ─────────────────────────────
    // isAnalytical is computed at function top (before authority-mode gate).
    console.log('[Analytical]', isAnalytical, '|', question.substring(0, 50));

    if (isAnalytical && topChunks.length > 0 && process.env.DEEPSEEK_API_KEY) {
      try {
        console.log('[DeepSeek Synthesis] Triggered for analytical question');
        const chunkTexts = topChunks.slice(0, 4).map(c => c.content || '').join('\n\n');

        const synthRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            max_tokens: 800,
            messages: [
              {
                role: 'system',
                content: 'Du bist ein Staatsexamen-Repetitor für deutsches Recht. ' +
                  'Beantworte die Frage ausschließlich auf Basis des bereitgestellten Gesetzestextes. ' +
                  'Gliedere deine Antwort zwingend in diese drei Abschnitte:\n\n' +
                  '**GESETZESTEXT**\n' +
                  'Zitiere wörtlich die relevantesten Sätze aus dem Gesetzestext, die die Frage beantworten. ' +
                  'Nenne Paragraph und Absatz.\n\n' +
                  '**RECHTLICHE ANALYSE**\n' +
                  '1. Definition — Was regelt der Begriff/die Norm?\n' +
                  '2. Tatbestandsvoraussetzungen — Welche Voraussetzungen müssen erfüllt sein?\n' +
                  '3. Rechtsfolgen — Was sind die gesetzlichen Konsequenzen?\n' +
                  '4. Abgrenzung — Wo liegen die Unterschiede zu verwandten Rechtsinstituten?\n\n' +
                  '**RELEVANTE PARAGRAPHEN**\n' +
                  'Liste alle zitierten Normen im Format: § X Abs. Y [Gesetz] — Kurzbezeichnung.\n\n' +
                  'Halte dich strikt an den Gesetzestext. Maximal 400 Wörter pro Abschnitt. ' +
                  'Falls der bereitgestellte Text unzureichend ist, benenne explizit welche Paragraphen fehlen.'
              },
              {
                role: 'user',
                content: `Frage: ${question}\n\nGesetzestext:\n${chunkTexts}`
              }
            ]
          }),
          signal: AbortSignal.timeout(20000)
        });
        const synthData = await synthRes.json();
        const synthAnswer = synthData.choices?.[0]?.message?.content;

        if (synthAnswer && synthAnswer.length > 150) {
          console.log('[DeepSeek Synthesis] Answer generated, length:', synthAnswer.length);
          response.answer = synthAnswer + '\n\n*Basierend auf deutschen Rechtsdokumenten. Keine Rechtsberatung.*';
          response.synthesis_used = true;
        }
      } catch (err) {
        console.error('[DeepSeek Synthesis] Failed:', err.message);
        // Keep original RAG answer
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

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


    console.log(`📊 Applying TF-IDF reranking for query: "${query.substring(0, 50)}..."`);

    // Fresh local instance — discarded after this call, never accumulates across queries
    const tfidf = new natural.TfIdf();
    chunks.forEach((chunk, index) => {
      tfidf.addDocument(chunk.content || '', { index, chunk });
    });

    const scoredChunks = chunks.map((chunk, index) => {
      let tfidfScore = 0;
      tfidf.tfidfs(query, (i, measure) => {
        if (i === index) tfidfScore = measure;
      });
      return {
        ...chunk,
        tfidfScore: tfidfScore,
        combinedScore: (chunk.similarity || 0.5) * 0.7 + tfidfScore * 0.3
      };
    });

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
      // HGB maritime/transport law boilerplate leaking into civil law answers
      "341f",
      "341h",
      "Konnossement",
      "Orderkonnossement",
      "Stückgutfrachtvertrag",
      "Verfrachter",
      "Ablader",
      "Anspruchshäufung",
      "§ 260 Anspruch",
      "insbesondere zu bilden",
      "Hinweis- und Aufklärungspflicht",
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
      const _metaPara = chunk.metadata?.paragraph || chunk.metadata?.meta?.paragraph || '';
      const _topPara  = chunk.paragraph || chunk.section || '';
      // Last resort: extract leading § N from content ("§ 854 ..." → "854")
      const _contentPara = (() => {
        if (_metaPara || _topPara) return '';
        const m = (chunk.content || '').match(/^§\s*(\d+[a-z]?)\b/i)
               || (chunk.content || '').match(/\n§\s*(\d+[a-z]?)\b/i);
        return m ? m[1] : '';
      })();
      const _para = _metaPara || _topPara || _contentPara || null;
      const _filename = chunk.documentName || chunk.filename || chunk.document || (statute ? `${statute}.pdf` : '');
      return {
        id: index + 1,
        document:     _filename,
        documentName: _filename,
        statute:      statute,
        paragraph:    _para,
        page:         chunk.metadata?.page || chunk.page || 1,
        excerpt:      excerpt,
        relevance:    Math.min(1, Math.max(0, combined)),
        similarity:   chunk.similarity?.toFixed(3) || "0.500",
        tfidfScore:   chunk.tfidfScore?.toFixed(3) || "0.000",
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

  /**
   * EBV guard — handles questions about §§987–1003 BGB (Eigentümer-Besitzer-Verhältnis).
   *
   * The LLM consistently inverts the rule when BGB §§987-1003 chunks are absent,
   * inferring the EBV regime from unjust-enrichment law (opposite direction).
   *
   * Correct rule:
   *   APPLIES  — possessor has NO legal basis (thief, finder, trespasser)
   *   NOT apply — possessor HAS a contractual right (lessee §535, borrower §598, bailee §688)
   *
   * Returns a structured answer object when chunks are absent or the validated template
   * when chunks are present. Returns null to let normal RAG proceed when chunks are
   * sufficient AND contain the correct paragraph range.
   */
  handleEBVQuestion(question, chunks) {
    const EBV_RANGE = /§\s*(9[89]\d|10[0-3]\d)\b/;   // §987–§1003
    const chunksWithEBV = (chunks || []).filter(c =>
      EBV_RANGE.test(c.content || c.text || '')
    );

    const EBV_TEMPLATE =
      '**Eigentümer-Besitzer-Verhältnis (EBV) — §§ 987–1003 BGB**\n\n' +
      '**1. ANWENDUNGSBEREICH**\n' +
      'Das EBV-Regime (§§ 987–1003 BGB) gilt ausschließlich in der *Vindikationslage*: ' +
      'Der Besitzer hat **keinen** Rechtstitel zum Besitz (kein Recht zum Besitz i.S.v. § 986 BGB).\n\n' +
      '**2. EBV GILT — wenn KEIN Besitzrecht besteht**\n' +
      '- Dieb (§ 985 BGB — Herausgabeanspruch des Eigentümers)\n' +
      '- Finder ohne Ablieferung\n' +
      '- Unrechtmäßiger Besitzer (z.B. nach Vertragsende ohne Rückgabe)\n\n' +
      '**3. EBV GILT NICHT — wenn ein Besitzrecht besteht (§ 986 BGB)**\n' +
      'Wenn der Besitzer ein *Recht zum Besitz* hat, ist § 985 BGB ausgeschlossen; ' +
      'es gelten die vertraglichen Regelungen:\n' +
      '- Mieter (§§ 535 ff. BGB — Mietrecht)\n' +
      '- Entleiher (§§ 598 ff. BGB — Leihe)\n' +
      '- Verwahrer (§§ 688 ff. BGB — Verwahrung)\n' +
      '- Pächter (§§ 581 ff. BGB)\n\n' +
      '**4. RECHTSFOLGE**\n' +
      '- Redlicher Besitzer (§§ 987–993 BGB): haftet nur für Vorsatz/grobe Fahrlässigkeit ab Kenntnis\n' +
      '- Unredlicher Besitzer (§§ 987–990 BGB): volle Nutzungsherausgabe und Schadensersatzpflicht\n' +
      '- Verwendungsersatz: §§ 994–1003 BGB (notwendige/nützliche Verwendungen)\n\n' +
      '**5. MERKSATZ**\n' +
      'EBV = kein Vertrag, kein Titel → Vindikationslage. ' +
      'Vertrag vorhanden → vertragliche Abwicklung, kein EBV.\n\n' +
      '*Basierend auf §§ 985–1003 BGB. Keine Rechtsberatung.*';

    if (chunksWithEBV.length === 0) {
      // No EBV source chunks — return retrieval_failed (chatService handles this first in normal flow)
      console.warn('[EBV Guard] No §§987-1003 chunks found — returning retrieval_failed');
      return {
        answer: '§§ 987–1003 BGB (Eigentümer-Besitzer-Verhältnis) wurde im geladenen Quellentext nicht gefunden. Die Antwort kann nicht verifiziert werden.',
        citations: [],
        confidence: 0,
        documentsUsed: 0,
        metadata: {
          statute: 'BGB',
          ebv_guard: true,
          retrieval_failed: true,
          chunks_used: 0,
        },
      };
    }

    // Chunks present — verify they contain the correct direction before trusting RAG
    const hasPositiveRule = chunksWithEBV.some(c =>
      /(kein(en)?\s+rechtstitel|kein\s+recht\s+zum\s+besitz|vindikation|dieb|finder)/i.test(c.content || c.text || '')
    );

    if (!hasPositiveRule) {
      console.warn('[EBV Guard] Chunks present but positive applicability rule missing — returning retrieval_failed');
      return {
        answer: '§§ 987–1003 BGB (Eigentümer-Besitzer-Verhältnis) wurde im geladenen Quellentext nicht korrekt abgebildet. Die Antwort kann nicht verifiziert werden.',
        citations: [],
        confidence: 0,
        documentsUsed: 0,
        metadata: {
          statute: 'BGB',
          ebv_guard: true,
          retrieval_failed: true,
          chunks_used: chunksWithEBV.length,
        },
      };
    }

    // Chunks are sufficient and contain the correct rule — let normal RAG proceed
    console.log(`[EBV Guard] ${chunksWithEBV.length} valid EBV chunks found — handing off to normal RAG`);
    return null;
  }
}

module.exports = new RAGService();