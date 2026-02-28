/**
 * ResultFormatter.js
 * 
 * 🔒 SAFETY LAYER that prevents:
 * - NaN in scores
 * - Missing metadata
 * - UI formatting errors
 * - Epistemic violations
 */

class ResultFormatter {
  constructor() {
    console.log('✅ ResultFormatter initialized - protecting against NaN and epistemic violations');
  }

  // ===========================================================================
  // 🔴 CRITICAL FIX: PREVENT NaN AND SCORE CALCULATION ERRORS
  // ===========================================================================

  formatResponse(rawResponse, authority) {
    if (!rawResponse || !rawResponse.success) {
      return rawResponse; // Don't format errors
    }

    // Deep clone to avoid mutation
    const response = JSON.parse(JSON.stringify(rawResponse));

    // 🔴 CRITICAL: Handle exact mode specially
    if (authority?.authority_mode === 'exact') {
      return this.formatExactModeResponse(response, authority);
    }

    // Handle other modes
    return this.formatGeneralResponse(response, authority);
  }

  // ===========================================================================
  // EXACT MODE FORMATTING (NO SCORES, NO RANKING, NO PERCENTAGES)
  // ===========================================================================

  formatExactModeResponse(response, authority) {
    console.log('🎯 [ResultFormatter] Formatting exact mode response');

    // Remove all scores and percentages
    if (response.data) {
      // Ensure confidence is 1.0 for exact mode
      response.data.confidence = 1.0;
      
      // Remove any score properties
      delete response.data.score;
      delete response.data.relevance;
      delete response.data.ranking;
      
      // Update metadata
      if (response.data.metadata) {
        response.data.metadata.exact_mode = true;
        response.data.metadata.authority_mode = 'exact';
        response.data.metadata.epistemic_certainty = 'authoritative';
        response.data.metadata.score_disabled = true;
        response.data.metadata.ranking_disabled = true;
        
        // Ensure statute metadata is preserved
        response.data.metadata.statute = authority.statute;
        response.data.metadata.paragraph = authority.paragraph;
        
        // Validate metadata exists
        this.validateMetadata(response.data.metadata);
      }

      // Update structured answer
      if (response.data.structuredAnswer) {
        response.data.structuredAnswer.confidence = 1.0;
        response.data.structuredAnswer.scoreLabel = 'Authoritative';
        response.data.structuredAnswer.score = null;
        
        if (response.data.structuredAnswer.metadata) {
          response.data.structuredAnswer.metadata.exact_mode = true;
          response.data.structuredAnswer.metadata.authority_mode = 'exact';
        }
      }

      // Format sources properly
      if (response.data.sources && Array.isArray(response.data.sources)) {
        response.data.sources = response.data.sources.map(source => ({
          ...source,
          statute: source.statute || authority.statute,
          paragraph: source.paragraph || authority.paragraph,
          relevance: 'authoritative',
          score: null
        }));
      }
    }

    // Add exact mode indicator
    response.exact_mode = true;
    response.epistemic_status = 'authoritative';
    response.score_calculation_disabled = true;

    return response;
  }

  // ===========================================================================
  // GENERAL RESPONSE FORMATTING (WITH SCORES)
  // ===========================================================================

  formatGeneralResponse(response, authority) {
    console.log('📊 [ResultFormatter] Formatting general response');

    if (response.data) {
      // Ensure confidence is within bounds
      if (response.data.confidence !== undefined) {
        response.data.confidence = this.clampConfidence(response.data.confidence);
      }

      // Calculate scores only if they exist and are valid
      if (response.data.metadata) {
        // Clean up any NaN
        this.cleanNaNValues(response.data.metadata);

        // Add safe score calculation
        if (response.data.metadata.chunksUsed !== undefined) {
          response.data.metadata.safeRelevanceScore = this.calculateSafeScore(
            response.data.metadata.chunksUsed,
            authority
          );
        }

        // Ensure statute metadata exists
        this.ensureStatuteMetadata(response.data.metadata, authority);
      }

      // Format structured answer
      if (response.data.structuredAnswer) {
        this.formatStructuredAnswer(response.data.structuredAnswer, authority);
      }

      // Format sources
      if (response.data.sources && Array.isArray(response.data.sources)) {
        response.data.sources = response.data.sources.map(source => 
          this.formatSource(source)
        );
      }
    }

    return response;
  }

  // ===========================================================================
  // 🔴 CRITICAL: VALIDATE METADATA EXISTS
  // ===========================================================================

  validateMetadata(metadata) {
    const requiredFields = ['statute', 'paragraph', 'authority_mode'];
    const missingFields = requiredFields.filter(field => !metadata[field]);

    if (missingFields.length > 0) {
      console.warn(`⚠️ [ResultFormatter] Missing metadata fields: ${missingFields.join(', ')}`);
      
      // Don't throw, but log for debugging
      metadata.metadata_warning = `Missing: ${missingFields.join(', ')}`;
    }

    return metadata;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  clampConfidence(confidence) {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      return 0.7; // Default
    }
    return Math.max(0, Math.min(1, confidence));
  }

  cleanNaNValues(obj) {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'number' && isNaN(obj[key])) {
        console.log(`🔄 [ResultFormatter] Replaced NaN in ${key} with null`);
        obj[key] = null;
      }
      if (typeof obj[key] === 'object') {
        this.cleanNaNValues(obj[key]);
      }
    });
  }

  calculateSafeScore(chunksUsed, authority) {
    if (!chunksUsed || chunksUsed === 0) return null;
    
    // Different scoring for different authority modes
    switch (authority?.authority_mode) {
      case 'overview':
        return Math.min(95, 70 + (chunksUsed * 5));
      case 'exact':
        return 100; // Exact mode is always 100
      default:
        return Math.min(100, 60 + (chunksUsed * 10));
    }
  }

  ensureStatuteMetadata(metadata, authority) {
    if (!metadata.statute && authority?.statute) {
      metadata.statute = authority.statute;
    }
    if (!metadata.paragraph && authority?.paragraph) {
      metadata.paragraph = authority.paragraph;
    }
    if (!metadata.authority_mode && authority?.authority_mode) {
      metadata.authority_mode = authority.authority_mode;
    }
  }

  formatStructuredAnswer(structuredAnswer, authority) {
    if (!structuredAnswer) return;

    // Ensure confidence is valid
    if (structuredAnswer.confidence !== undefined) {
      structuredAnswer.confidence = this.clampConfidence(structuredAnswer.confidence);
    }

    // Add score label
    if (authority?.authority_mode === 'exact') {
      structuredAnswer.scoreLabel = 'Authoritative';
      structuredAnswer.score = null;
    } else {
      structuredAnswer.scoreLabel = 'Relevance';
      if (structuredAnswer.confidence !== undefined) {
        structuredAnswer.score = Math.round(structuredAnswer.confidence * 100);
      }
    }

    // Ensure metadata exists
    if (!structuredAnswer.metadata) {
      structuredAnswer.metadata = {};
    }

    // Add authority info
    structuredAnswer.metadata.authority_mode = authority?.authority_mode || 'none';
    structuredAnswer.metadata.epistemic_certainty = authority?.epistemicCertainty || 'unknown';
  }

  formatSource(source) {
    if (!source) return source;

    // Ensure statute and paragraph exist
    const safeSource = {
      ...source,
      statute: source.statute || null,
      paragraph: source.paragraph || null,
      content: source.content || source.text || '',
      metadata: source.metadata || {}
    };

    // Clean NaN from relevance score
    if (safeSource.relevance !== undefined && isNaN(safeSource.relevance)) {
      safeSource.relevance = null;
    }

    // Add safe relevance indicator
    if (safeSource.relevance === null || safeSource.relevance === undefined) {
      safeSource.relevance = 'not_calculated';
    }

    return safeSource;
  }

  // ===========================================================================
  // STATIC UTILITY: Format any raw result
  // ===========================================================================

  static formatResult(rawResult, authority) {
    const formatter = new ResultFormatter();
    return formatter.formatResponse(rawResult, authority);
  }

  // ===========================================================================
  // EPISTEMIC SAFETY: Guard against authority violations
  // ===========================================================================

  enforceEpistemicSafety(response, authority) {
    if (!authority) return response;

    // Exact mode must not have scores
    if (authority.authority_mode === 'exact') {
      this.removeAllScores(response);
      response.epistemic_status = 'authoritative';
    }

    // Doctrine questions must have proper labels
    if (authority.question_type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE') {
      this.addDoctrineLabels(response);
    }

    return response;
  }

  removeAllScores(response) {
    const removeScoresRecursive = (obj) => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        if (key.toLowerCase().includes('score') || key.toLowerCase().includes('relevance')) {
          obj[key] = null;
        }
        if (typeof obj[key] === 'object') {
          removeScoresRecursive(obj[key]);
        }
      });
    };

    removeScoresRecursive(response);
    return response;
  }

  addDoctrineLabels(response) {
    if (response.data) {
      response.data.doctrine_question = true;
      if (response.data.metadata) {
        response.data.metadata.doctrine_classification = true;
      }
    }
    return response;
  }
}

module.exports = new ResultFormatter();