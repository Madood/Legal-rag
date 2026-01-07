const embeddingService = require("./embeddingService");
const safetyCheck = require("../validation/safetyCheck");

class RAGService {
  constructor() {
    this.MAX_CHUNKS = 5;

    // Statute display names
    this.statuteDisplayNames = {
      StGB: "Strafgesetzbuch (StGB)",
      BGB: "Bürgerliches Gesetzbuch (BGB)",
      HGB: "Handelsgesetzbuch (HGB)",
      GG: "Grundgesetz (GG)",
      "EU-GDPR": "EU-Datenschutz-Grundverordnung (GDPR)",
    };

    console.log("✅ RAGService initialized as STATUTE-ENFORCED EXECUTION ENGINE");
  }

  /**
   * RAGService - STATUTE ENFORCEMENT ONLY
   * Assumes ALL authority resolution is done by Python upstream
   * Performs no legal inference, only statute enforcement
   */
  async generateResponse(question, allDocuments, options = {}) {
    const startTime = Date.now();
    const language = options.language || "german";

    console.log(`\n🤖 RAG Execution: "${question.substring(0, 60)}..."`);

    // ⭐⭐ CRITICAL: Authority must be pre-resolved by Python
    if (!options.authority) {
      throw new Error(
        "RAGService called without authority metadata. Authority must be resolved by Python service."
      );
    }

    const { authority } = options;
    
    // ⭐⭐ Validate required inputs
    if (!authority.statute) {
      throw new Error("RAGService requires pre-resolved statute from Python");
    }

    const { statute, paragraph, isArticle } = authority;

    console.log(
      `🔒 [Authority] Python-resolved: ${statute}${
        paragraph ? ` ${isArticle ? "Art." : "§"}${paragraph}` : ""
      }`
    );

    // ⭐⭐ STEP 1: FILTER DOCUMENTS BY STATUTE ONLY
    const statuteDocuments = this.filterByStatute(statute, allDocuments);

    if (statuteDocuments.length === 0) {
      console.log(`⚠️  No documents for statute: ${statute}`);
      return this.handleMissingSourceQuestion(
        question,
        statute,
        startTime,
        language
      );
    }

    // ⭐⭐ STEP 2: CONVERT TO RAG FORMAT (no authority processing)
    const ragDocuments = this.convertToRAGFormat(statuteDocuments);

    if (ragDocuments.length === 0) {
      return this.getNoDocumentsResponse(startTime, language, statute);
    }

    // ⭐⭐ STEP 3: EXTRACT CHUNKS
    let allChunks = [];

    ragDocuments.forEach((doc, docIndex) => {
      if (doc.chunks && Array.isArray(doc.chunks)) {
        doc.chunks.forEach((chunk, chunkIndex) => {
          const content = chunk.content || chunk;
          
          allChunks.push({
            content: content,
            embeddings: chunk.embeddings || [],
            documentId: doc.id || `doc_${docIndex}`,
            documentName: doc.filename || `Document ${docIndex}`,
            documentStatute: statute, // Already filtered by statute
            chunkIndex: chunkIndex,
            isBoilerplate: this.isBoilerplateContent(content),
            metadata: {
              wordCount: content.split(/\s+/).length,
              hasParagraph: /§\s*\d+/.test(content),
              hasArticle: /(?:Artikel|Art\.|Article)\s*\d+/.test(content),
            },
          });
        });
      }
    });

    console.log(`📑 Total chunks for ${statute}: ${allChunks.length}`);

    if (allChunks.length === 0) {
      return this.getNoContentResponse(startTime, language, statute);
    }

    // ⭐⭐ STEP 4: REMOVE BOILERPLATE
    const originalCount = allChunks.length;
    allChunks = allChunks.filter((chunk) => !chunk.isBoilerplate);
    console.log(
      `🧹 Removed ${originalCount - allChunks.length} boilerplate chunks`
    );

    // ⭐⭐ STEP 5: ENFORCE PARAGRAPH MATCHING IF PROVIDED BY PYTHON
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

    // ⭐⭐ STEP 6: GENERATE EMBEDDINGS AND FIND SIMILAR CHUNKS
    const questionEmbedding = await embeddingService.generateQueryEmbedding(
      question
    );

    // Ensure all chunks have embeddings
    allChunks = await embeddingService.ensureChunksHaveEmbeddings(allChunks);

    const similarChunks = await embeddingService.findSimilarChunks(
      questionEmbedding,
      allChunks,
      {
        similarityThreshold: 0.15,
        maxResults: 50,
        boostStatute: statute, // Only boost the pre-resolved statute
      }
    );

    console.log(
      `🔍 Found ${similarChunks.length} similar chunks in ${statute}`
    );

    if (similarChunks.length === 0) {
      return this.getNoRelevantContentResponse(startTime, language, statute);
    }

    // ⭐⭐ STEP 7: VALIDATE STATUTE STRUCTURE ONLY
    const structureValidation = this.validateAnswerStructure(
      similarChunks[0]?.content || "",
      statute,
      paragraph,
      isArticle
    );

    if (!structureValidation.isValid) {
      console.log(`⚠️  Structure warning: ${structureValidation.message}`);
      // Continue anyway - Python has already done deep validation
    }

    // ⭐⭐ STEP 8: FINAL RANKING
    const rankedChunks = this.rerankWithWeights(
      similarChunks,
      statute,
      paragraph,
      isArticle
    );

    const topChunks = this.selectDiverseTopChunks(
      rankedChunks,
      this.MAX_CHUNKS
    );
    console.log(`🎯 Selected ${topChunks.length} top chunks for answer`);

    // ⭐⭐ STEP 9: EXTRACT CONTENT
    const legalRule = this.extractContentFromChunks(
      topChunks,
      statute,
      paragraph
    );

    // ⭐⭐ STEP 10: GENERATE ANSWER
    const answer = this.generateStructuredAnswer(
      legalRule,
      topChunks,
      language,
      statute,
      paragraph,
      isArticle
    );

    // ⭐⭐ STEP 11: PREPARE CITATIONS
    const citations = this.prepareCitations(
      topChunks.slice(0, 3),
      statute
    );

    // ⭐⭐ STEP 12: CALCULATE CONFIDENCE
    const confidence = this.calculateConfidence(
      topChunks,
      exactReferenceMatch,
      legalRule,
      statute
    );

    // ⭐⭐ STEP 13: BUILD RESPONSE
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
      authority // Include Python authority metadata
    );

    // ⭐⭐ STEP 14: RUN SAFETY CHECK
    const safetyValidation = await safetyCheck.validateBeforeAnswer(
      question,
      response
    );
    response.safetyCheck = safetyValidation;

    console.log(
      `✅ Answer generated for ${statute} with confidence: ${confidence.toFixed(2)}`
    );

    return response;
  }

  /* -------------------------------------------------
     CORE METHODS (SIMPLIFIED)
  -------------------------------------------------- */

  filterByStatute(statute, allDocuments) {
    return allDocuments.filter(doc => {
      const docStatute = this.extractStatuteFromDoc(doc);
      return docStatute === statute;
    });
  }

  convertToRAGFormat(documents) {
    return documents.map((doc) => {
      if (doc.chunks && Array.isArray(doc.chunks)) {
        return doc;
      }

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
    // Simple extraction - assumes documents are pre-classified
    return doc.metadata?.statute || 
           (doc.filename || "").match(/(StGB|BGB|HGB|GG|GDPR)/i)?.[1]?.toUpperCase() || 
           null;
  }

  doesChunkContainExactReference(chunk, statute, paragraph, isArticle) {
    const content = chunk.content || "";
    
    if (isArticle) {
      const articlePattern = new RegExp(
        `(?:Artikel|Art\\.|Article)\\s*${paragraph}\\b`,
        "i"
      );
      return articlePattern.test(content);
    } else {
      const paragraphPattern = new RegExp(`§\\s*${paragraph}\\b`, "i");
      return paragraphPattern.test(content);
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

  extractContentFromChunks(chunks, statute, paragraph) {
    if (!chunks || chunks.length === 0) {
      return "No relevant content found.";
    }

    // Look for exact paragraph match first
    if (paragraph) {
      for (const chunk of chunks) {
        const content = chunk.content || "";
        const pattern = /^\d+$/.test(paragraph) 
          ? new RegExp(`§\\s*${paragraph}\\b`, "i")
          : new RegExp(`(?:Artikel|Art\\.|Article)\\s*${paragraph}\\b`, "i");

        if (pattern.test(content)) {
          const sentences = content.split(/[.!?]+/);
          for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (pattern.test(trimmed) && trimmed.length > 30 && trimmed.length < 300) {
              return trimmed + ".";
            }
          }
        }
      }
    }

    // Fallback: first meaningful content
    for (const chunk of chunks) {
      const content = chunk.content || "";
      const sentences = content.split(/[.!?]+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 40 && trimmed.length < 200 && !this.isBoilerplateContent(trimmed)) {
          return trimmed + ".";
        }
      }
    }

    return "No specific rule identified.";
  }

  rerankWithWeights(chunks, statute, paragraph, isArticle) {
    return chunks.sort((a, b) => {
      const scoreA = this.calculateChunkScore(a, statute, paragraph, isArticle);
      const scoreB = this.calculateChunkScore(b, statute, paragraph, isArticle);
      return scoreB - scoreA;
    });
  }

  calculateChunkScore(chunk, statute, paragraph, isArticle) {
    let score = chunk.similarity || 0.5;
    const content = chunk.content || "";

    // Boost for correct statute (should always be true due to filtering)
    if (chunk.documentStatute === statute) {
      score += 0.3;
    }

    // Boost for exact paragraph match
    if (paragraph && this.doesChunkContainExactReference(chunk, statute, paragraph, isArticle)) {
      score += 0.5;
    }

    // Boost for containing statute name
    if (content.includes(statute)) {
      score += 0.2;
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  selectDiverseTopChunks(chunks, limit) {
    const selected = [];
    const usedDocuments = new Set();

    for (const chunk of chunks) {
      if (selected.length >= limit) break;
      if (!usedDocuments.has(chunk.documentId)) {
        selected.push(chunk);
        usedDocuments.add(chunk.documentId);
      }
    }

    return selected;
  }

  generateStructuredAnswer(legalRule, chunks, language, statute, paragraph, isArticle) {
    const statuteName = this.statuteDisplayNames[statute] || statute;

    let answer = `**Legal situation according to ${statuteName}:**\n\n`;

    if (paragraph) {
      answer += `**Norm:** ${isArticle ? 'Article' : '§'} ${paragraph}\n\n`;
    }

    answer += `**Rule:**\n${legalRule}\n\n`;

    // Add context
    if (chunks.length > 0) {
      answer += `**Context:**\n`;
      chunks.slice(0, 2).forEach((chunk) => {
        const content = chunk.content || "";
        const firstSentence = content.split(/[.!?]+/)[0];
        if (firstSentence && firstSentence.trim().length > 20) {
          answer += `${firstSentence.trim()}.\n`;
        }
      });
    }

    answer += `\n*Based on German legal documents. This is not legal advice.*`;
    return answer.trim();
  }

  prepareCitations(chunks, statute) {
    return chunks.map((chunk, index) => {
      const content = chunk.content || "";
      let excerpt = content.replace(/\s+/g, " ").trim();
      if (excerpt.length > 150) excerpt = excerpt.substring(0, 150) + "...";

      return {
        id: index + 1,
        document: chunk.documentName,
        statute: statute,
        excerpt: excerpt,
        similarity: chunk.similarity?.toFixed(3) || "0.500",
      };
    });
  }

  calculateConfidence(topChunks, exactReferenceMatch, legalRule, statute) {
    if (topChunks.length === 0) return 0.1;

    let confidence = topChunks.reduce((sum, chunk) => sum + (chunk.similarity || 0), 0) / topChunks.length;
    
    if (exactReferenceMatch) confidence += 0.2;
    if (legalRule.includes("§") || legalRule.includes("Artikel")) confidence += 0.1;
    
    // Base confidence for different statutes
    if (statute === "BGB" || statute === "StGB") confidence *= 1.1;
    
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  buildResponse(answer, citations, confidence, documentsUsed, chunksUsed, startTime, statute, paragraph, exactReferenceMatch, structureValidation, chunks, authority) {
    return {
      answer: answer,
      citations: citations,
      confidence: confidence,
      documentsUsed: documentsUsed,
      metadata: {
        statute: statute,
        paragraph: paragraph,
        exactReferenceMatch: exactReferenceMatch,
        chunksUsed: chunksUsed,
        processingTime: Date.now() - startTime,
        architecture: "statute_enforced_rag",
        authoritySource: "python_service",
        structureValidation: structureValidation,
        pythonAuthority: authority, // Include the Python authority result
      },
    };
  }

  /* -------------------------------------------------
     ERROR HANDLERS
  -------------------------------------------------- */

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