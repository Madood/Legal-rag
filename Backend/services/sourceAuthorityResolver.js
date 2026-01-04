// services/sourceAuthorityResolver.js
class SourceAuthorityResolver {
  constructor() {
    // Authority hierarchy: 1 = highest authority, 100 = lowest
    this.authorityRanks = {
      // Primary sources
      'official_statute_de': 1,      // Official German statute text
      'official_statute_en': 2,      // Official English translation
      'official_eu_en': 1,           // Official EU English (GDPR)
      'official_eu_de': 2,           // Official EU German
      
      // Secondary sources
      'consolidated_translation': 3,  // Verified consolidated translation
      'annotated_version': 4,         // Statute with annotations
      'doctrine_commentary': 5,       // Legal commentary/doctrine
      
      // Tertiary sources
      'unofficial_translation': 6,    // Unofficial translation
      'summary_explanation': 7,       // Summary or explanation
      
      // Excluded sources
      'registry_boilerplate': 99,     // Commercial register notices
      'metadata_only': 98,            // Metadata without content
      'unknown': 100                  // Unknown source type
    };
    
    // Document type classifications
    this.documentTypes = {
      'code': ['BGB', 'StGB', 'HGB', 'GG'],
      'regulation': ['EU-GDPR'],
      'constitution': ['GG'],
      'treaty': [],
      'directive': []
    };
    
    // Language priority by statute
    this.languagePriority = {
      'BGB': ['de', 'en'],    // German Civil Code: German first
      'StGB': ['de', 'en'],   // German Criminal Code
      'HGB': ['de', 'en'],    // German Commercial Code
      'GG': ['de', 'en'],     // German Basic Law
      'EU-GDPR': ['en', 'de'] // EU Regulation: English first
    };
    
    console.log('✅ SourceAuthorityResolver initialized');
  }

  /**
   * Main authority resolution method
   */
  resolve(question, statute, questionType, allDocuments) {
    const startTime = Date.now();
    console.log(`\n[Authority] Resolving sources for "${question.substring(0, 50)}..."`);
    console.log(`  Statute: ${statute}, Question Type: ${questionType}`);
    
    // Step 1: Filter by statute
    const statuteDocs = this.filterByStatute(allDocuments, statute);
    console.log(`  Found ${statuteDocs.length} documents for ${statute}`);
    
    if (statuteDocs.length === 0) {
      return this.handleMissingStatute(statute, questionType);
    }
    
    // Step 2: Classify each document
    const classifiedDocs = statuteDocs.map(doc => 
      this.classifyDocument(doc, statute)
    );
    
    // Step 3: Apply question-type specific filtering
    const filteredDocs = this.applyQuestionTypeRules(
      classifiedDocs, 
      questionType, 
      statute
    );
    
    // Step 4: Sort by authority rank
    const sortedDocs = filteredDocs.sort((a, b) => 
      a.authority_metadata.authority_rank - b.authority_metadata.authority_rank
    );
    
    const endTime = Date.now();
    
    // Create authority summary
    const authoritySummary = {
      statute: statute,
      question_type: questionType,
      total_documents: statuteDocs.length,
      authoritative_documents: sortedDocs.filter(d => d.authority_metadata.is_authoritative).length,
      excluded_documents: statuteDocs.length - sortedDocs.length,
      processing_time_ms: endTime - startTime,
      primary_source_type: sortedDocs[0]?.authority_metadata?.source_type || 'none',
      language_distribution: this.getLanguageDistribution(sortedDocs),
      rank_distribution: this.getRankDistribution(sortedDocs)
    };
    
    console.log(`[Authority] Selected ${sortedDocs.length} authoritative sources`);
    console.log(`  Primary source: ${authoritySummary.primary_source_type}`);
    console.log(`  Authoritative: ${authoritySummary.authoritative_documents}/${authoritySummary.total_documents}`);
    
    return {
      allowed_documents: sortedDocs,
      authority_summary: authoritySummary
    };
  }
  
  /**
   * Filter documents by statute
   */
  filterByStatute(documents, statute) {
    return documents.filter(doc => {
      const docStatute = doc.metadata?.statute || 
                        doc.statute || 
                        this.inferStatuteFromContent(doc.content || '');
      return docStatute === statute;
    });
  }
  
  /**
   * Classify a single document
   */
  classifyDocument(doc, statute) {
    const metadata = doc.metadata || {};
    const content = doc.content || '';
    const filename = doc.filename || '';
    
    // Default classification
    let sourceType = 'unknown';
    let classificationReason = 'Could not determine source type';
    
    // Check for official German statute
    if (this.isOfficialGermanStatute(metadata, content, filename)) {
      sourceType = 'official_statute_de';
      classificationReason = `Official German ${statute} text`;
    }
    // Check for official English translation
    else if (this.isOfficialEnglishTranslation(metadata, content, filename)) {
      sourceType = 'official_statute_en';
      classificationReason = `Official English translation of ${statute}`;
    }
    // Check for EU GDPR (English first)
    else if (statute === 'EU-GDPR' && this.isOfficialEUEnglish(metadata, content)) {
      sourceType = 'official_eu_en';
      classificationReason = 'Official EU GDPR text (English)';
    }
    // Check for consolidated translation
    else if (this.isConsolidatedTranslation(metadata, content)) {
      sourceType = 'consolidated_translation';
      classificationReason = `Consolidated translation of ${statute}`;
    }
    // Check for doctrine/commentary
    else if (this.isDoctrinalCommentary(metadata, content)) {
      sourceType = 'doctrine_commentary';
      classificationReason = `Legal commentary on ${statute}`;
    }
    // Check for registry boilerplate (HGB specific)
    else if (this.isRegistryBoilerplate(metadata, content)) {
      sourceType = 'registry_boilerplate';
      classificationReason = 'Commercial register notice or boilerplate';
    }
    // Check for unofficial translation
    else if (this.isUnofficialTranslation(metadata, content)) {
      sourceType = 'unofficial_translation';
      classificationReason = `Unofficial translation of ${statute}`;
    }
    
    const authorityRank = this.authorityRanks[sourceType] || 100;
    
    return {
      ...doc,
      authority_metadata: {
        source_type: sourceType,
        authority_rank: authorityRank,
        is_authoritative: authorityRank <= 5, // Ranks 1-5 are authoritative
        classification_reason: classificationReason,
        language: metadata.language || this.detectLanguage(content),
        has_normative_content: this.hasNormativeContent(content),
        paragraph_count: this.countParagraphs(content),
        article_count: this.countArticles(content),
        word_count: content.split(/\s+/).length
      }
    };
  }

  /**
   * Classify a single chunk (simplified version of classifyDocument)
   */
  classifyChunk(content, statute, document) {
    // For chunks, we'll inherit the document's authority
    // but also check if the chunk itself has normative content
    
    const docAuthority = document.authority_metadata || {
      source_type: 'unknown',
      authority_rank: 100,
      is_authoritative: false,
      classification_reason: 'No document authority metadata'
    };
    
    // Check if this specific chunk has normative content
    const hasNormativeContent = this.hasNormativeContent(content);
    const paragraphCount = this.countParagraphs(content);
    const articleCount = this.countArticles(content);
    const language = this.detectLanguage(content);
    
    // Boost authority if chunk contains legal references
    let authorityBoost = 0;
    if (paragraphCount > 0 || articleCount > 0) {
      authorityBoost = -5; // Lower number = higher authority
    }
    if (hasNormativeContent) {
      authorityBoost -= 3;
    }
    
    // Language preference based on statute
    const preferredLanguages = this.languagePriority[statute] || ['de', 'en'];
    const languageMatch = preferredLanguages.includes(language) ? -2 : 0;
    
    return {
      authority_metadata: {
        ...docAuthority,
        authority_rank: Math.max(1, Math.min(100, docAuthority.authority_rank + authorityBoost + languageMatch)),
        chunk_analysis: {
          language: language,
          has_legal_references: paragraphCount > 0 || articleCount > 0,
          has_normative_content: hasNormativeContent,
          paragraph_count: paragraphCount,
          article_count: articleCount,
          word_count: content.split(/\s+/).length,
          is_boilerplate: this.isBoilerplateChunk(content)
        }
      }
    };
  }

  /**
   * Check if chunk is boilerplate
   */
  isBoilerplateChunk(content) {
    const boilerplateMarkers = [
      'Copyright',
      '©',
      'All rights reserved',
      'Translated by',
      'Übersetzt von',
      'Translation provided by',
      'This is a translation',
      'Dies ist eine Übersetzung',
      'Stand:',
      'As of:',
      'Version:',
      'Last updated:',
      'Zuletzt aktualisiert:',
      'Ein Service des Bundesministerium',
      'Service provided by',
      'reproduced',
      'PDF generated',
      'Samson Übersetzungen',
      'Dr. Carmen',
      'Michael Bohlander'
    ];
    
    const lowerContent = content.toLowerCase();
    return boilerplateMarkers.some(marker => 
      lowerContent.includes(marker.toLowerCase())
    );
  }
  
  /**
   * Detection methods
   */
  isOfficialGermanStatute(metadata, content, filename) {
    // Official German statutes have specific patterns
    const hasOfficialMarkers = (
      content.includes('Bundesgesetzblatt') ||
      content.includes('BGBl.') ||
      content.includes('Vom') ||
      content.includes('Der Bundestag hat das folgende Gesetz beschlossen') ||
      content.includes('(StGB)') ||
      content.includes('(BGB)') ||
      content.includes('(HGB)') ||
      content.includes('(GG)')
    );
    
    const isGerman = (
      metadata.language === 'de' ||
      content.includes('§') ||
      content.includes('Absatz') ||
      content.includes('Artikel')
    );
    
    const notTranslation = !(
      content.includes('Translation') ||
      content.includes('Übersetzung') ||
      content.includes('translated by') ||
      content.includes('übersetzt von')
    );
    
    return hasOfficialMarkers && isGerman && notTranslation;
  }
  
  isOfficialEnglishTranslation(metadata, content) {
    // Official translations from government sources
    const officialSources = [
      'Federal Ministry of Justice',
      'Bundesministerium der Justiz',
      'Official translation',
      'Translation provided by',
      'Translated by the Federal Ministry'
    ];
    
    return officialSources.some(source => 
      content.includes(source) || (metadata.source && metadata.source.includes(source))
    );
  }
  
  isOfficialEUEnglish(metadata, content) {
    // EU Official Journal publications
    return (
      content.includes('REGULATION (EU) 2016/679') ||
      content.includes('Official Journal of the European Union') ||
      content.includes('L 119/1') || // GDPR publication reference
      content.includes('THE EUROPEAN PARLIAMENT AND THE COUNCIL OF THE EUROPEAN UNION')
    );
  }
  
  isConsolidatedTranslation(metadata, content) {
    return (
      content.includes('consolidated version') ||
      content.includes('Consolidated text') ||
      content.includes('consolidated translation') ||
      (metadata.version && metadata.version.includes('consolidated'))
    );
  }
  
  isDoctrinalCommentary(metadata, content) {
    return (
      content.includes('commentary') ||
      content.includes('Kommentar') ||
      content.includes('doctrine') ||
      content.includes('Dogmatik') ||
      content.includes('Rechtslehre') ||
      (metadata.documentType && metadata.documentType.includes('commentary'))
    );
  }
  
  isRegistryBoilerplate(metadata, content) {
    // HGB-specific registry notices
    const boilerplateMarkers = [
      'register notices',
      'Commercial Register',
      'Handelsregister',
      'Amtsgericht',
      'HRB',
      'HRA',
      'Company registration',
      'Samson Übersetzungen',
      'Dr. Carmen',
      'Michael Bohlander',
      'Vollständige Überarbeitung',
      'laufende Aktualisierung',
      'Eintragungen im Handelsregister'
    ];
    
    return boilerplateMarkers.some(marker => 
      content.toLowerCase().includes(marker.toLowerCase())
    );
  }
  
  isUnofficialTranslation(metadata, content) {
    return (
      (content.includes('translation') || content.includes('übersetzt')) &&
      !this.isOfficialEnglishTranslation(metadata, content) &&
      !this.isConsolidatedTranslation(metadata, content)
    );
  }
  
  /**
   * Content analysis methods
   */
  hasNormativeContent(content) {
    if (!content) return false;
    
    const normativePatterns = [
      /§\s*\d+/,
      /(?:Artikel|Art\.|Article)\s*\d+/,
      /(?:ist|sind|hat|haben|gilt|gelten|muss|müssen|darf|dürfen|kann|können|soll|sollen)\s+[A-Z]/i,
      /(?:bestimmt|regelt|vorsieht|sieht vor|legt fest)/i,
      /(?:Ansprüche|Pflichten|Rechte|Verpflichtung|Haftung|Schaden)/i
    ];
    
    return normativePatterns.some(pattern => pattern.test(content));
  }
  
  countParagraphs(content) {
    if (!content) return 0;
    const matches = content.match(/§\s*\d+/g);
    return matches ? matches.length : 0;
  }
  
  countArticles(content) {
    if (!content) return 0;
    const matches = content.match(/(?:Artikel|Art\.|Article)\s*\d+/g);
    return matches ? matches.length : 0;
  }
  
  detectLanguage(content) {
    if (!content) return 'unknown';
    const sample = content.substring(0, 1000).toLowerCase();
    
    const germanIndicators = ['der', 'die', 'das', 'und', 'für', 'mit', 'von', 'zu', 'auf', 'ist'];
    const englishIndicators = ['the', 'and', 'for', 'with', 'from', 'to', 'in', 'of', 'on', 'is'];
    
    let de = 0, en = 0;
    germanIndicators.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      de += (sample.match(regex) || []).length;
    });
    englishIndicators.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      en += (sample.match(regex) || []).length;
    });
    
    return de > en ? 'de' : 'en';
  }
  
  /**
   * Apply question-type specific rules
   */
  applyQuestionTypeRules(documents, questionType, statute) {
    console.log(`[Authority] Applying ${questionType} rules for ${statute}`);
    
    let filteredDocs = [...documents];
    
    switch (questionType) {
      case 'NORMATIVE':
        // §280 BGB - ONLY official German text or EU English
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.source_type === 'official_statute_de' ||
          (statute === 'EU-GDPR' && doc.authority_metadata.source_type === 'official_eu_en')
        );
        break;
        
      case 'DEFINITION':
        // Can use translations if German not available
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.authority_rank <= 5
        );
        break;
        
      case 'DOCTRINE':
        // Use doctrine only
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.source_type === 'doctrine_commentary'
        );
        break;
        
      case 'OFFENSE':
        // Criminal law - German official only
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.source_type === 'official_statute_de'
        );
        break;
        
      case 'GENERAL_STATUTE':
        // General questions about a statute
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.is_authoritative
        );
        break;
        
      case 'SYSTEM':
        // Legal system questions - use any authoritative
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.authority_rank <= 7
        );
        break;
        
      default:
        // GENERAL - Use authoritative sources
        filteredDocs = documents.filter(doc => 
          doc.authority_metadata.authority_rank <= 5
        );
    }
    
    // Apply statute-specific exceptions
    if (statute === 'HGB' && questionType === 'NORMATIVE') {
      // HGB has translations for § references, be more lenient
      filteredDocs = documents.filter(doc => 
        doc.authority_metadata.authority_rank <= 3 ||
        (doc.authority_metadata.has_normative_content && doc.authority_metadata.paragraph_count > 0)
      );
    }
    
    console.log(`[Authority] Filtered to ${filteredDocs.length} documents for ${questionType}`);
    return filteredDocs;
  }
  
  /**
   * Helper methods for summaries
   */
  getLanguageDistribution(documents) {
    const distribution = {};
    documents.forEach(doc => {
      const lang = doc.authority_metadata?.language || 'unknown';
      distribution[lang] = (distribution[lang] || 0) + 1;
    });
    return distribution;
  }
  
  getRankDistribution(documents) {
    const distribution = {};
    documents.forEach(doc => {
      const rank = doc.authority_metadata?.authority_rank || 100;
      distribution[rank] = (distribution[rank] || 0) + 1;
    });
    return distribution;
  }
  
  inferStatuteFromContent(content) {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('strafgesetzbuch') || lowerContent.includes('stgb')) return 'StGB';
    if (lowerContent.includes('bürgerliches gesetzbuch') || lowerContent.includes('bgb')) return 'BGB';
    if (lowerContent.includes('handelsgesetzbuch') || lowerContent.includes('hgb')) return 'HGB';
    if (lowerContent.includes('grundgesetz') || lowerContent.includes('gg')) return 'GG';
    if (lowerContent.includes('datenschutz-grundverordnung') || lowerContent.includes('gdpr') || lowerContent.includes('dsgvo')) return 'EU-GDPR';
    return null;
  }
  
  handleMissingStatute(statute, questionType) {
    return {
      allowed_documents: [],
      authority_summary: {
        statute: statute,
        question_type: questionType,
        error: 'NO_AUTHORITATIVE_SOURCES',
        message: `No authoritative sources available for ${statute}. Please load official ${statute} documents.`,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Debug method to show authority classification
   */
  debugClassification(documents) {
    console.log('\n🔍 AUTHORITY CLASSIFICATION DEBUG:');
    console.log('='.repeat(80));
    
    documents.forEach((doc, index) => {
      const meta = doc.authority_metadata || {};
      console.log(`${index + 1}. ${doc.filename || doc.id}`);
      console.log(`   Source Type: ${meta.source_type}`);
      console.log(`   Authority Rank: ${meta.authority_rank}`);
      console.log(`   Authoritative: ${meta.is_authoritative ? '✅' : '❌'}`);
      console.log(`   Reason: ${meta.classification_reason}`);
      console.log(`   Language: ${meta.language}`);
      console.log(`   Paragraphs: ${meta.paragraph_count}, Articles: ${meta.article_count}`);
      console.log();
    });
  }
}

module.exports = new SourceAuthorityResolver();