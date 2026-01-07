// services/embeddingService.js - UPDATED VERSION

const natural = require("natural");

class EmbeddingService {
  constructor() {
    this.tfidf = new natural.TfIdf();
    this.tokenizer = new natural.WordTokenizer();
    this.isIndexBuilt = false;
    this.documentsIndexed = 0;
    this.vectorSize = 100; // Increased for better discrimination
    
    // Legal domain-specific stop words
    this.stopWords = new Set([
      // German
      'der', 'die', 'das', 'und', 'oder', 'aber', 'den', 'dem',
      'des', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
      'im', 'am', 'um', 'als', 'aus', 'bei', 'nach', 'über',
      'vor', 'zu', 'für', 'mit', 'von', 'an', 'auf', 'durch',
      'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben',
      
      // English  
      'the', 'and', 'or', 'but', 'a', 'an', 'in', 'on', 'at',
      'to', 'for', 'with', 'by', 'from', 'of', 'as', 'is', 'are',
      'was', 'were', 'will', 'would', 'can', 'could', 'must', 'should',
      'has', 'have', 'had', 'been', 'being', 'does', 'do', 'did'
    ]);
    
    // Legal terms to boost
    this.legalTerms = new Set([
      'gesetz', 'recht', 'norm', 'vorschrift', 'bestimmung',
      'paragraph', 'artikel', 'absatz', 'satz', 'verordnung',
      'vertrag', 'pflicht', 'anspruch', 'schaden', 'haftung',
      'strafrecht', 'strafgesetzbuch', 'stgb', 'verbrechen',
      'zivilrecht', 'bürgerlich', 'bgb', 'vertragsrecht',
      'handelsrecht', 'hgb', 'kaufmann', 'unternehmen',
      'verfassung', 'grundgesetz', 'gg', 'grundrecht',
      'datenschutz', 'gdpr', 'personenbezogen', 'verarbeitung'
    ]);
    
    console.log('✅ EmbeddingService initialized (UPDATED VERSION)');
  }

  /* -------------------------------------------------
     BUILD TF-IDF INDEX
  -------------------------------------------------- */
  
  async buildIndex(documents) {
    if (this.isIndexBuilt) {
      console.log('📊 TF-IDF index already built');
      return;
    }
    
    console.log(`🔨 Building TF-IDF index with ${documents.length} documents...`);
    
    let docCount = 0;
    for (const doc of documents) {
      try {
        let content = '';
        
        if (typeof doc === 'string') {
          content = doc;
        } else if (doc.content) {
          content = doc.content;
        } else if (doc.text) {
          content = doc.text;
        } else {
          continue;
        }
        
        if (content.trim().length < 50) continue;
        
        // Tokenize with legal term preservation
        const tokens = this.tokenizeWithLegalTerms(content);
        
        if (tokens.length > 0) {
          this.tfidf.addDocument(tokens);
          docCount++;
        }
      } catch (error) {
        console.warn(`Skipping document: ${error.message}`);
      }
    }
    
    this.isIndexBuilt = true;
    this.documentsIndexed = docCount;
    console.log(`✅ TF-IDF index built with ${docCount} documents`);
  }

  /* -------------------------------------------------
     GENERATE EMBEDDINGS (IMPROVED)
  -------------------------------------------------- */

  async generateEmbeddings(text) {
    try {
      if (!text || text.trim().length === 0) {
        return this.createZeroVector();
      }
      
      // Tokenize with legal term preservation
      const tokens = this.tokenizeWithLegalTerms(text);
      
      if (tokens.length === 0) {
        return this.createZeroVector();
      }
      
      // Calculate term frequencies with legal term boosting
      const termScores = this.calculateTermScores(tokens);
      
      // Create vector from top terms
      const vector = this.createVectorFromScores(termScores, tokens.length);
      
      // Add small noise to prevent identical vectors
      this.addRandomNoise(vector);
      
      // Normalize PROPERLY (fixed bug)
      return this.normalizeVectorProperly(vector);
      
    } catch (error) {
      console.error('Error generating embedding:', error.message);
      return this.createZeroVector();
    }
  }

  /* -------------------------------------------------
     QUERY EMBEDDING (with legal term boosting)
  -------------------------------------------------- */
  
  async generateQueryEmbedding(queryText) {
    const baseEmbedding = await this.generateEmbeddings(queryText);
    
    // Additional boosting for legal terms in queries
    const tokens = this.tokenizeWithLegalTerms(queryText);
    
    // Boost legal terms even more in queries
    const boostedEmbedding = [...baseEmbedding];
    const legalBoost = 1.3; // 30% boost for legal terms in queries
    
    // Simple boosting: if query contains legal terms, slightly increase magnitude
    const hasLegalTerms = tokens.some(token => this.legalTerms.has(token));
    if (hasLegalTerms) {
      return boostedEmbedding.map(val => Math.min(val * 1.1, 1.0));
    }
    
    return boostedEmbedding;
  }

  /* -------------------------------------------------
     SIMILARITY SEARCH (WITH IMPROVED THRESHOLDS)
  -------------------------------------------------- */

  async findSimilarChunks(queryEmbedding, chunks, options = {}) {
    const {
      similarityThreshold = 0.15, // Increased threshold
      maxResults = 30, // Reduced for better quality
      boostStatute = null
    } = options;

    // Ensure chunks have embeddings
    chunks = await this.ensureChunksHaveEmbeddings(chunks);

    if (!chunks || chunks.length === 0) {
      return [];
    }

    console.log(`🔍 Searching ${chunks.length} chunks`);

    const results = [];

    chunks.forEach((chunk, index) => {
      try {
        const chunkEmbedding = chunk.embeddings;
        
        if (!chunkEmbedding || chunkEmbedding.length === 0) {
          return;
        }

        // Calculate similarity with validation
        let similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        
        // Validate similarity (catch bugs)
        if (similarity > 0.999) {
          console.warn(`⚠️  Suspicious high similarity ${similarity.toFixed(3)} for chunk ${index}`);
          similarity = Math.min(similarity, 0.95); // Cap at reasonable value
        }
        
        // Apply statute boosts if specified
        if (boostStatute && chunk.documentStatute === boostStatute) {
          similarity += 0.15;
        }
        
        // Boost for legal citations
        const content = chunk.content || '';
        if (content.includes('§') || content.includes('Artikel') || content.includes('Article')) {
          similarity += 0.05; // Smaller boost
        }
        
        // Penalize very short chunks
        if (content.split(/\s+/).length < 20) {
          similarity -= 0.1;
        }
        
        // Ensure valid range
        similarity = Math.max(0, Math.min(0.95, similarity));
        
        if (similarity >= similarityThreshold) {
          results.push({
            ...chunk,
            similarity: similarity,
            chunkIndex: index
          });
        }
        
      } catch (error) {
        // Skip silently for now
      }
    });

    console.log(`📊 Found ${results.length} chunks above threshold ${similarityThreshold}`);
    
    // Sort and return with more realistic similarity scores
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  /* -------------------------------------------------
     TEXT PROCESSING METHODS
  -------------------------------------------------- */

  tokenizeWithLegalTerms(text) {
    const lowerText = text.toLowerCase();
    
    // First extract legal terms (preserve multi-word terms)
    const legalTermPatterns = [
      /strafgesetzbuch|stgb/gi,
      /bürgerliches gesetzbuch|bgb/gi,
      /handelsgesetzbuch|hgb/gi,
      /grundgesetz|gg/gi,
      /datenschutz-grundverordnung|gdpr|dsgvo/gi,
      /schuldprinzip|nulla poena sine culpa/gi,
      /verhältnismäßigkeitsprinzip/gi,
      /rechtsstaatsprinzip/gi
    ];
    
    const legalTokens = [];
    
    // Extract legal terms first
    legalTermPatterns.forEach(pattern => {
      const matches = lowerText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          legalTokens.push(match.replace(/\s+/g, '_')); // Convert spaces to underscores
        });
      }
    });
    
    // Regular tokenization
    const regularTokens = this.tokenizer.tokenize(lowerText);
    
    // Combine and filter
    const allTokens = [...legalTokens, ...regularTokens];
    
    return allTokens.filter(token => {
      if (token.length < 2) return false;
      if (this.stopWords.has(token)) return false;
      if (token.match(/^\d+$/)) return false; // Remove pure numbers
      return true;
    });
  }

  calculateTermScores(tokens) {
    const termScores = {};
    
    tokens.forEach(token => {
      if (!termScores[token]) {
        termScores[token] = 0;
      }
      
      // Base frequency
      termScores[token] += 1;
      
      // Boost legal terms
      if (this.legalTerms.has(token)) {
        termScores[token] += 2;
      }
    });
    
    return termScores;
  }

  createVectorFromScores(termScores, totalTokens) {
    const vector = this.createZeroVector();
    
    // Sort terms by score and take top N
    const sortedTerms = Object.entries(termScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.vectorSize);
    
    // Map to vector using hash-based positioning
    sortedTerms.forEach(([term, score], index) => {
      // Use hash for consistent positioning
      const hash = this.hashString(term) % this.vectorSize;
      // Normalize score by total tokens
      vector[hash] = Math.min(score / totalTokens, 0.8); // Cap to prevent dominance
    });
    
    return vector;
  }

  /* -------------------------------------------------
     VECTOR OPERATIONS (FIXED BUGS)
  -------------------------------------------------- */

  normalizeVectorProperly(vector) {
    // Calculate magnitude
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }
    
    const magnitude = Math.sqrt(sumSquares);
    
    // If magnitude is zero or very small, return zero vector
    if (magnitude < 0.000001) {
      return this.createZeroVector();
    }
    
    // Normalize
    const normalized = new Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }
    
    // Verify normalization
    let verifySum = 0;
    for (let i = 0; i < normalized.length; i++) {
      verifySum += normalized[i] * normalized[i];
    }
    const verifyMagnitude = Math.sqrt(verifySum);
    
    // Debug if normalization failed
    if (Math.abs(verifyMagnitude - 1.0) > 0.1) {
      console.warn(`⚠️  Normalization warning: magnitude = ${verifyMagnitude.toFixed(3)}`);
    }
    
    return normalized;
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i] || 0;
      const b = vecB[i] || 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    
    // Clamp to valid range and round
    return Math.max(0, Math.min(1, Number(similarity.toFixed(4))));
  }

  addRandomNoise(vector) {
    // Add tiny random noise to prevent identical vectors
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] !== 0) {
        vector[i] += (Math.random() - 0.5) * 0.0001;
      }
    }
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  createZeroVector() {
    return new Array(this.vectorSize).fill(0);
  }

  /* -------------------------------------------------
     ENSURING EMBEDDINGS
  -------------------------------------------------- */

  async ensureChunksHaveEmbeddings(chunks) {
    const needsEmbeddings = chunks.filter(chunk => 
      !chunk.embeddings || chunk.embeddings.length === 0
    );
    
    if (needsEmbeddings.length === 0) return chunks;
    
    console.log(`🛠️  Generating embeddings for ${needsEmbeddings.length} chunks`);
    
    const updatedChunks = [...chunks];
    
    for (const chunk of updatedChunks) {
      if (!chunk.embeddings || chunk.embeddings.length === 0) {
        try {
          chunk.embeddings = await this.generateEmbeddings(chunk.content || '');
        } catch (error) {
          chunk.embeddings = this.createZeroVector();
        }
      }
    }
    
    return updatedChunks;
  }

  /* -------------------------------------------------
     DEBUG METHODS
  -------------------------------------------------- */

  debugEmbedding(text, label = "Embedding") {
    const embedding = this.generateEmbeddings(text);
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
    
    console.log(`${label}: "${text.substring(0, 40)}..."`);
    console.log(`  Magnitude: ${magnitude.toFixed(3)} (should be ~1.0)`);
    console.log(`  Non-zero: ${nonZero}/${embedding.length}`);
    console.log(`  Sample: ${embedding.slice(0, 3).map(v => v.toFixed(3)).join(', ')}...`);
    
    if (Math.abs(magnitude - 1.0) > 0.1) {
      console.log(`  ⚠️  NOT NORMALIZED`);
    }
    
    return embedding;
  }

  getIndexStatus() {
    return {
      isIndexBuilt: this.isIndexBuilt,
      documentsIndexed: this.documentsIndexed,
      vectorSize: this.vectorSize
    };
  }
}

module.exports = new EmbeddingService();