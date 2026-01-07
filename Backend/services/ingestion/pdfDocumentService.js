const fs = require("fs").promises;
const path = require("path");
const pdf = require("pdf-parse");
const natural = require("natural");

// ⭐⭐ FIXED: Authority resolution moved to Python - no longer needed in Node
// const sourceAuthorityResolver = require('../authority/sourceAuthorityResolver');

class PDFDocumentService {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.documents = [];
    this.statuteDocuments = {}; // Cache for faster statute lookups
    console.log('✅ PDFDocumentService initialized for STATUTE-FIRST architecture');
    this.loadDocuments();
  }

  async loadDocuments() {
    try {
      // Try different paths to find documents
      const possiblePaths = [
        path.join(__dirname, "..", "documents"),
        path.join(process.cwd(), "documents"),
        path.resolve(__dirname, "../documents"),
        "C:/Users/madoo/Desktop/React-projects/Legal-Rag/Backend/documents"
      ];
      
      let documentsDir = "";
      for (const dirPath of possiblePaths) {
        try {
          await fs.access(dirPath);
          documentsDir = dirPath;
          console.log(`✅ Found documents directory: ${dirPath}`);
          break;
        } catch (error) {
          console.log(`❌ Not found: ${dirPath}`);
        }
      }
      
      if (!documentsDir) {
        console.log("⚠️  Could not find documents directory!");
        return;
      }

      console.log(`📂 Loading PDF documents from: ${documentsDir}`);

      // Find all .pdf files recursively
      const files = await this.findFilesRecursive(documentsDir, [".pdf"]);
      console.log(`📄 Found ${files.length} PDF files in total`);

      // Debug: Show all found files
      console.log("\nFound files:");
      files.forEach((file, index) => {
        const relativePath = path.relative(documentsDir, file);
        console.log(`  ${index + 1}. ${relativePath}`);
      });
      console.log("");

      let loadedCount = 0;
      for (const file of files) {
        try {
          const dataBuffer = await fs.readFile(file);
          const pdfData = await pdf(dataBuffer);
          const content = pdfData.text;

          if (content && content.trim().length > 50) {
            const relativePath = path.relative(documentsDir, file);
            
            // ⭐⭐ CRITICAL FIX: Enhanced cleaning FIRST
            const cleanContent = this.cleanLegalText(content);
            
            // ⭐⭐ ENHANCED: Extract statute with confidence
            const statuteInfo = this.extractStatuteWithConfidence(cleanContent, path.basename(file));
            const statute = statuteInfo.statute;
            const statuteType = this.getStatuteTypeFromStatute(statute);
            
            // ⭐⭐ CRITICAL FIX: Extract title from CLEANED content
            const title = this.extractGermanLegalTitle(cleanContent, path.basename(file), statute);
            
            const chunks = this.createLegalChunks(cleanContent);
            
            // ⭐⭐ STEP 2: Create document object first
            const document = {
              id: relativePath,
              filename: path.basename(file),
              filepath: relativePath,
              content: cleanContent,
              chunks: chunks,
              metadata: {
                title: title,
                type: statuteType,
                statute: statute,
                statuteConfidence: statuteInfo.confidence,
                statuteDetectionMethod: statuteInfo.method,
                statuteEvidence: statuteInfo.evidence,
                language: this.detectLanguage(cleanContent),
                wordCount: cleanContent.split(/\s+/).length,
                pages: pdfData.numpages,
                // ⭐⭐ NEW: Enhanced legal metadata
                jurisdiction: this.extractJurisdiction(cleanContent, statute),
                year: this.extractYearFromText(cleanContent),
                isOfficialText: this.isOfficialText(cleanContent),
                legalTopics: this.extractLegalTopics(cleanContent),
                // ⭐⭐ NEW: For statute-first architecture
                hasParagraphs: this.hasParagraphs(cleanContent),
                hasArticles: this.hasArticles(cleanContent),
                paragraphCount: this.countParagraphs(cleanContent),
                articleCount: this.countArticles(cleanContent)
              },
            };

            // ⭐⭐ FIXED: Authority classification moved to Python
            // Provide neutral placeholder metadata
            document.authority_metadata = {
              source_type: 'unclassified',
              authority_rank: 100,
              is_authoritative: false,
              classification_reason: 'authority_resolution_moved_to_python',
              classification_method: 'python_service',
              weight: 1.0,
              requires_python_evaluation: true
            };

            this.documents.push(document);
            
            // Cache by statute for faster access
            if (statute) {
              if (!this.statuteDocuments[statute]) {
                this.statuteDocuments[statute] = [];
              }
              this.statuteDocuments[statute].push(document);
            }

            loadedCount++;
            // ⭐⭐ CRITICAL: Add debug logging with authority info
            console.log(`   ✅ Loaded: ${relativePath}`);
            console.log(`       Title: ${title}`);
            console.log(`       Statute: ${statute || 'Unknown'} (${statuteInfo.confidence * 100}% confidence)`);
            console.log(`       Authority: ${document.authority_metadata.source_type} (Python will evaluate)`);
            console.log(`       Chunks: ${chunks.length}`);
            console.log(`       Detection: ${statuteInfo.method}`);
          }
        } catch (error) {
          console.log(`   ❌ Failed to load ${file}: ${error.message}`);
        }
      }

      console.log(`\n✅ Successfully loaded ${loadedCount}/${files.length} PDF documents`);
      
      // Show what was loaded with better formatting
      console.log("\n📚 LOADED DOCUMENTS SUMMARY:");
      console.log("=".repeat(80));
      this.documents.forEach((doc, index) => {
        const statInfo = doc.metadata.statute ? `(${doc.metadata.statute})` : '';
        console.log(`  ${index + 1}. ${doc.metadata.title} ${statInfo}`);
        console.log(`     Type: ${doc.metadata.type} | Pages: ${doc.metadata.pages} | Chunks: ${doc.chunks.length}`);
        console.log(`     Statute Confidence: ${(doc.metadata.statuteConfidence * 100).toFixed(0)}%`);
        console.log(`     Authority: ${doc.authority_metadata?.source_type || 'unclassified'} (Python evaluation)`);
        console.log(`     Path: ${doc.filepath}`);
        console.log();
      });

      // Show statute distribution
      console.log("\n⚖️  STATUTE DISTRIBUTION:");
      console.log("=".repeat(40));
      const statuteStats = this.getStatuteStatistics();
      Object.entries(statuteStats).forEach(([statute, count]) => {
        console.log(`  ${statute}: ${count} document${count !== 1 ? 's' : ''}`);
      });

      // Show authority distribution - now all unclassified
      console.log("\n🏛️  AUTHORITY DISTRIBUTION:");
      console.log("=".repeat(40));
      console.log(`  unclassified: ${this.documents.length} documents (Python will classify)`);

      console.log('📚 Documents loaded. Authority resolution will be done by Python service.');

    } catch (error) {
      console.log("⚠️  Error loading PDF documents:", error.message);
    }
  }

  // ⭐⭐ ENHANCED: Extract statute with confidence scoring
  extractStatuteWithConfidence(content, filename) {
    const sampleStart = Math.min(2000, content.length);
    const sample = content.substring(0, sampleStart);
    const fname = filename.toLowerCase();
    
    let bestMatch = { statute: null, confidence: 0, method: 'none', evidence: '' };
    
    // Score each statute possibility
    const statuteChecks = [
      {
        statute: 'StGB',
        patterns: [
          { pattern: /\bStrafgesetzbuch\b/, score: 1.0, evidence: 'Exact statute name' },
          { pattern: /§\s*\d+\s*StGB\b/, score: 0.9, evidence: 'Paragraph with StGB reference' },
          { pattern: /^StGB\b/, score: 0.8, evidence: 'Starts with StGB' },
          { pattern: /\bStGB\b.*?(?:§|Artikel|Abschnitt|Titel)/, score: 0.7, evidence: 'StGB in legal context' }
        ],
        keywords: ['strafbar', 'Freiheitsstrafe', 'Geldstrafe', 'Verbrechen', 'Vergehen'],
        filenamePattern: /stgb|straf/
      },
      {
        statute: 'BGB',
        patterns: [
          { pattern: /\bBürgerliches Gesetzbuch\b/, score: 1.0, evidence: 'Exact statute name' },
          { pattern: /§\s*\d+\s*BGB\b/, score: 0.9, evidence: 'Paragraph with BGB reference' },
          { pattern: /^BGB\b/, score: 0.8, evidence: 'Starts with BGB' },
          { pattern: /\bBGB\b.*?(?:§|Artikel|Abschnitt|Titel)/, score: 0.7, evidence: 'BGB in legal context' }
        ],
        keywords: ['Schuldrecht', 'Vertrag', 'Kauf', 'Miete', 'Eigentum'],
        filenamePattern: /bgb|bürgerlich/
      },
      {
        statute: 'HGB',
        patterns: [
          { pattern: /\bHandelsgesetzbuch\b/, score: 1.0, evidence: 'Exact statute name' },
          { pattern: /§\s*\d+\s*HGB\b/, score: 0.9, evidence: 'Paragraph with HGB reference' },
          { pattern: /^HGB\b/, score: 0.8, evidence: 'Starts with HGB' },
          { pattern: /\bHGB\b.*?(?:§|Artikel|Abschnitt|Titel)/, score: 0.7, evidence: 'HGB in legal context' }
        ],
        keywords: ['Kaufmann', 'Handelsregister', 'Prokura', 'Firma', 'Handelsgeschäft'],
        filenamePattern: /hgb|handels/
      },
      {
        statute: 'GG',
        patterns: [
          { pattern: /\bGrundgesetz\b/, score: 1.0, evidence: 'Exact statute name' },
          { pattern: /Artikel\s*\d+\s*GG\b/, score: 0.9, evidence: 'Article with GG reference' },
          { pattern: /^GG\b/, score: 0.8, evidence: 'Starts with GG' },
          { pattern: /\bGG\b.*?Artikel/, score: 0.7, evidence: 'GG in constitutional context' }
        ],
        keywords: ['Grundrecht', 'Menschenwürde', 'Verfassung', 'Bundesrepublik'],
        filenamePattern: /gg|grundgesetz/
      },
      {
        statute: 'EU-GDPR',
        patterns: [
          { pattern: /REGULATION\s*\(EU\)\s*2016\/679/, score: 1.0, evidence: 'Exact regulation number' },
          { pattern: /Datenschutz-Grundverordnung/, score: 0.9, evidence: 'German name' },
          { pattern: /\bGDPR\b/, score: 0.8, evidence: 'GDPR abbreviation' },
          { pattern: /\bDSGVO\b/, score: 0.8, evidence: 'DSGVO abbreviation' }
        ],
        keywords: ['Datenschutz', 'personenbezogen', 'Einwilligung', 'Verprocessing'],
        filenamePattern: /gdpr|dsgvo/
      }
    ];
    
    // Check each statute
    for (const check of statuteChecks) {
      let statuteScore = 0;
      let evidence = '';
      
      // Check patterns
      for (const patternCheck of check.patterns) {
        if (patternCheck.pattern.test(sample)) {
          statuteScore = Math.max(statuteScore, patternCheck.score);
          evidence = patternCheck.evidence;
          break;
        }
      }
      
      // Check keywords
      if (statuteScore < 0.7) {
        const keywordMatch = check.keywords.some(keyword => sample.includes(keyword));
        if (keywordMatch) {
          statuteScore = Math.max(statuteScore, 0.6);
          evidence = evidence || 'Keywords match';
        }
      }
      
      // Check filename
      if (statuteScore < 0.5 && check.filenamePattern.test(fname)) {
        statuteScore = Math.max(statuteScore, 0.5);
        evidence = evidence || 'Filename suggests statute';
      }
      
      // Update best match if this statute has higher confidence
      if (statuteScore > bestMatch.confidence) {
        bestMatch = {
          statute: check.statute,
          confidence: statuteScore,
          method: evidence ? 'content_analysis' : 'filename',
          evidence: evidence || `Filename contains ${check.statute}`
        };
      }
    }
    
    return bestMatch;
  }

  // ⭐⭐ NEW: Get statute statistics
  getStatuteStatistics() {
    const stats = {};
    this.documents.forEach(doc => {
      const statute = doc.metadata.statute || 'unknown';
      stats[statute] = (stats[statute] || 0) + 1;
    });
    return stats;
  }

  // ⭐⭐ FIXED: Simplified authority statistics (now all unclassified)
  getAuthorityStatistics() {
    const stats = {};
    this.documents.forEach(doc => {
      const authorityType = doc.authority_metadata?.source_type || 'unclassified';
      stats[authorityType] = (stats[authorityType] || 0) + 1;
    });
    return stats;
  }

  // ⭐⭐ NEW: Enhanced getDocumentsByStatute with confidence filtering
  getDocumentsByStatute(statute, minConfidence = 0.5) {
    if (!statute) return [];
    
    // Use cached documents if available
    if (this.statuteDocuments[statute]) {
      return this.statuteDocuments[statute].filter(doc => 
        doc.metadata.statuteConfidence >= minConfidence
      );
    }
    
    // Fallback to filtering all documents
    return this.documents.filter(doc => 
      doc.metadata.statute === statute && 
      doc.metadata.statuteConfidence >= minConfidence
    );
  }

  // ⭐⭐ NEW: Get documents grouped by statute
  getDocumentsGroupedByStatute() {
    const grouped = {};
    
    this.documents.forEach(doc => {
      const statute = doc.metadata.statute || 'unknown';
      if (!grouped[statute]) {
        grouped[statute] = {
          statute: statute,
          count: 0,
          totalChunks: 0,
          totalPages: 0,
          documents: []
        };
      }
      
      grouped[statute].count++;
      grouped[statute].totalChunks += doc.chunks?.length || 0;
      grouped[statute].totalPages += doc.metadata.pages || 0;
      grouped[statute].documents.push({
        id: doc.id,
        filename: doc.filename,
        title: doc.metadata.title,
        chunkCount: doc.chunks?.length || 0,
        pages: doc.metadata.pages,
        confidence: doc.metadata.statuteConfidence,
        detectionMethod: doc.metadata.statuteDetectionMethod,
        authority: doc.authority_metadata?.source_type || 'unclassified'
      });
    });
    
    return grouped;
  }

  // ⭐⭐ FIXED: Simplified authority grouping (all unclassified)
  getDocumentsGroupedByAuthority() {
    const grouped = {};
    
    this.documents.forEach(doc => {
      const authority = doc.authority_metadata?.source_type || 'unclassified';
      if (!grouped[authority]) {
        grouped[authority] = {
          authority: authority,
          authorityRank: 100,
          count: 0,
          totalChunks: 0,
          totalPages: 0,
          documents: []
        };
      }
      
      grouped[authority].count++;
      grouped[authority].totalChunks += doc.chunks?.length || 0;
      grouped[authority].totalPages += doc.metadata.pages || 0;
      grouped[authority].documents.push({
        id: doc.id,
        filename: doc.filename,
        title: doc.metadata.title,
        statute: doc.metadata.statute,
        chunkCount: doc.chunks?.length || 0,
        pages: doc.metadata.pages,
        confidence: doc.metadata.statuteConfidence
      });
    });
    
    return grouped;
  }

  // ⭐⭐ NEW: Check if document contains paragraphs
  hasParagraphs(content) {
    return /§\s*\d+/.test(content);
  }

  // ⭐⭐ NEW: Check if document contains articles
  hasArticles(content) {
    return /(?:Artikel|Art\.|Article)\s*\d+/.test(content);
  }

  // ⭐⭐ NEW: Count paragraphs in document
  countParagraphs(content) {
    const matches = content.match(/§\s*\d+/g);
    return matches ? matches.length : 0;
  }

  // ⭐⭐ NEW: Count articles in document
  countArticles(content) {
    const matches = content.match(/(?:Artikel|Art\.|Article)\s*\d+/g);
    return matches ? matches.length : 0;
  }

  // ⭐⭐ NEW: Get all available statutes
  getAvailableStatutes() {
    const statutes = new Set();
    this.documents.forEach(doc => {
      if (doc.metadata.statute && doc.metadata.statuteConfidence >= 0.7) {
        statutes.add(doc.metadata.statute);
      }
    });
    return Array.from(statutes).sort();
  }

  // ⭐⭐ FIXED: Simplified authority types (all unclassified)
  getAvailableAuthorityTypes() {
    return ['unclassified'];
  }

  // ⭐⭐ NEW: Validate document for statute-first architecture
  validateDocumentForStatute(doc) {
    const issues = [];
    const metadata = doc.metadata || {};
    
    if (!metadata.statute) {
      issues.push('No statute detected');
    }
    
    if (metadata.statuteConfidence < 0.5) {
      issues.push(`Low statute confidence: ${(metadata.statuteConfidence * 100).toFixed(0)}%`);
    }
    
    if (!doc.chunks || doc.chunks.length === 0) {
      issues.push('No chunks created');
    }
    
    // Check for normative content
    if (metadata.statute && metadata.hasParagraphs === false && metadata.hasArticles === false) {
      issues.push('No paragraphs or articles found - may not contain normative text');
    }
    
    return {
      id: doc.id,
      filename: doc.filename,
      statute: metadata.statute,
      confidence: metadata.statuteConfidence,
      authority: doc.authority_metadata?.source_type || 'unclassified',
      authorityRank: doc.authority_metadata?.authority_rank || 100,
      isValid: issues.length === 0,
      issues: issues,
      chunkCount: doc.chunks?.length || 0,
      paragraphCount: metadata.paragraphCount || 0,
      articleCount: metadata.articleCount || 0,
      requires_python_evaluation: true
    };
  }

  // ⭐⭐ FIXED: Updated validation report
  getValidationReport() {
    const report = {
      totalDocuments: this.documents.length,
      validDocuments: 0,
      invalidDocuments: 0,
      byStatute: {},
      byAuthority: {},
      issues: []
    };
    
    this.documents.forEach(doc => {
      const validation = this.validateDocumentForStatute(doc);
      
      if (validation.isValid) {
        report.validDocuments++;
      } else {
        report.invalidDocuments++;
        report.issues.push({
          document: doc.filename,
          statute: doc.metadata.statute,
          authority: doc.authority_metadata?.source_type || 'unclassified',
          issues: validation.issues
        });
      }
      
      // Group by statute
      const statute = doc.metadata.statute || 'unknown';
      if (!report.byStatute[statute]) {
        report.byStatute[statute] = {
          count: 0,
          valid: 0,
          invalid: 0,
          totalChunks: 0
        };
      }
      
      report.byStatute[statute].count++;
      report.byStatute[statute].totalChunks += doc.chunks?.length || 0;
      if (validation.isValid) {
        report.byStatute[statute].valid++;
      } else {
        report.byStatute[statute].invalid++;
      }
      
      // Group by authority (all unclassified)
      const authority = doc.authority_metadata?.source_type || 'unclassified';
      if (!report.byAuthority[authority]) {
        report.byAuthority[authority] = {
          count: 0,
          valid: 0,
          invalid: 0,
          totalChunks: 0,
          averageRank: 100,
          rankCount: 0,
          requires_python_evaluation: true
        };
      }
      
      report.byAuthority[authority].count++;
      report.byAuthority[authority].totalChunks += doc.chunks?.length || 0;
      if (validation.isValid) {
        report.byAuthority[authority].valid++;
      } else {
        report.byAuthority[authority].invalid++;
      }
      
      report.byAuthority[authority].rankCount++;
    });
    
    report.validationRate = report.totalDocuments > 0 ? 
      (report.validDocuments / report.totalDocuments) * 100 : 0;
    
    report.authority_note = 'Authority classification deferred to Python service';
    
    return report;
  }

  // Helper: Map statute to document type
  getStatuteTypeFromStatute(statute) {
    const statuteMap = {
      'StGB': 'criminal_code',
      'BGB': 'civil_code',
      'HGB': 'commercial_code',
      'GG': 'constitution',
      'EU-GDPR': 'data_protection'
    };
    
    return statuteMap[statute] || 'legal_document';
  }

  async findFilesRecursive(dir, extensions) {
    const files = [];

    async function traverse(currentDir) {
      try {
        const items = await fs.readdir(currentDir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);

          if (item.isDirectory()) {
            await traverse(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Cannot read directory ${currentDir}: ${error.message}`);
      }
    }

    await traverse(dir);
    return files;
  }

  // ⭐⭐ CRITICAL FIX: AGGRESSIVE BOILERPLATE REMOVAL
  cleanLegalText(content) {
    let cleaned = content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*Seite\s*\d+\s*$/gm, '') // Remove "Seite X" lines
      .replace(/^\s*\d+\s*$/gm, '') // Remove standalone numbers
      .replace(/\b\d{1,3}\s+von\s+\d{1,3}\b/g, '') // Remove "X von Y"
      .trim();
    
    // Remove common German legal boilerplate
    const boilerplatePatterns = [
      'Ein Service des Bundesministerium.*',
      'Service provided by the Federal Ministry.*',
      '©.*',
      'Copyright.*',
      'CELEX.*',
      'Official Journal.*',
      'Amtsblatt.*',
      'Bundesanzeiger.*',
      'Stand:.*',
      'Fassung vom.*',
      'This publication as a fully accessible PDF.*',
      'PDF generated on.*',
      'BGBl\..*',
      'Bundesgesetzblatt.*',
      'gesetze-im-internet\\.de.*',
      'Juris.*',
      'Bundesministerium.*Justiz.*',
      'Federal Ministry.*Justice.*',
      'Zurück zum Inhaltsverzeichnis.*',
      'Navigation.*',
      'Menü.*',
      'Sitemap.*',
      'Impressum.*',
      'Datenschutz.*',
      'Kontakt.*',
      'Help.*',
      'Hilfe.*'
    ];
    
    boilerplatePatterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'gmi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Remove empty lines and excessive whitespace
    cleaned = cleaned
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.trim())
      .join('\n');
    
    return cleaned;
  }

  // Special chunking for German legal documents - chunk by paragraph (§)
  createLegalChunks(content, maxChunkSize = 600) {
    const chunks = [];
    
    // Split by paragraphs starting with §
    const paragraphs = content.split(/(?=§\s*\d+[a-z]?)/g);
    
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed.length < 30) continue; // Skip very short paragraphs
      
      // If paragraph is too long, split it by sentences
      if (trimmed.length > maxChunkSize) {
        const sentences = trimmed.split(/[.!?]+/);
        let currentChunk = "";
        
        for (const sentence of sentences) {
          const sentenceTrimmed = sentence.trim();
          if (sentenceTrimmed.length === 0) continue;
          
          if ((currentChunk.length + sentenceTrimmed.length) <= maxChunkSize) {
            currentChunk += (currentChunk ? ". " : "") + sentenceTrimmed;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk + ".");
            }
            currentChunk = sentenceTrimmed;
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk + ".");
        }
      } else {
        chunks.push(trimmed);
      }
    }
    
    // If no § paragraphs found, fall back to regular chunking
    if (chunks.length === 0) {
      return this.createChunks(content, maxChunkSize);
    }
    
    return chunks.filter(chunk => chunk.length > 30);
  }

  // Original chunking for non-legal text
  createChunks(content, chunkSize = 800) {
    const chunks = [];
    const sentences = content.split(/[.!?]+/);

    let currentChunk = "";
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) continue;

      if ((currentChunk.length + trimmed.length) <= chunkSize) {
        currentChunk += (currentChunk ? ". " : "") + trimmed;
      } else {
        if (currentChunk) chunks.push(currentChunk + ".");
        currentChunk = trimmed;
      }
    }

    if (currentChunk) chunks.push(currentChunk + ".");
    return chunks.filter(chunk => chunk.length > 30);
  }

  // ⭐⭐ CRITICAL FIX: IMPROVED GERMAN LEGAL TITLE EXTRACTION
  extractGermanLegalTitle(content, filename, detectedStatute = null) {
    const lines = content.split("\n").filter(line => line.trim().length > 10);
    
    // Remove boilerplate patterns FIRST
    const cleanLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return !(
        lower.includes('service') ||
        lower.includes('bundesministerium') ||
        lower.includes('federal ministry') ||
        lower.includes('celex') ||
        lower.includes('copyright') ||
        lower.includes('amtsblatt') ||
        lower.includes('reproduced') ||
        lower.includes('gesetze-im-internet') ||
        lower.includes('juris') ||
        lower.includes('stand:') ||
        lower.includes('fassung vom')
      );
    });
    
    // Look for actual German law titles in first 20 clean lines
    for (const line of cleanLines.slice(0, 20)) {
      const trimmed = line.trim();
      
      // Skip if looks like boilerplate (all caps, very short, etc.)
      if (trimmed.length < 20 || trimmed.length > 300) continue;
      if (trimmed === trimmed.toUpperCase()) continue; // Skip all caps
      if (trimmed.match(/^[0-9\s\.\-]+$/)) continue; // Skip just numbers/dashes
      
      // German Criminal Code
      if (trimmed.match(/Strafgesetzbuch/)) return "Strafgesetzbuch (StGB)";
      if (trimmed.match(/^StGB\b/)) return "Strafgesetzbuch (StGB)";
      
      // German Civil Code
      if (trimmed.match(/Bürgerliches Gesetzbuch/)) return "Bürgerliches Gesetzbuch (BGB)";
      if (trimmed.match(/^BGB\b/)) return "Bürgerliches Gesetzbuch (BGB)";
      
      // German Constitution
      if (trimmed.match(/Grundgesetz/)) return "Grundgesetz (GG)";
      if (trimmed.match(/^GG\b/)) return "Grundgesetz (GG)";
      
      // German Commercial Code
      if (trimmed.match(/Handelsgesetzbuch/)) return "Handelsgesetzbuch (HGB)";
      if (trimmed.match(/^HGB\b/)) return "Handelsgesetzbuch (HGB)";
      
      // GDPR
      if (trimmed.match(/Datenschutz-Grundverordnung/)) return "EU-Datenschutz-Grundverordnung (GDPR)";
      if (trimmed.match(/REGULATION \(EU\) 2016\/679/)) return "EU-Datenschutz-Grundverordnung (GDPR)";
      
      // Look for meaningful content (contains lowercase, has spaces)
      if (trimmed.length > 30 && trimmed.length < 200 && 
          /[a-zäöüß]/.test(trimmed) && // Contains lowercase German letters
          trimmed.includes(' ') && // Contains spaces
          !trimmed.includes('http') && // No URLs
          !trimmed.includes('www.')) {
        return trimmed;
      }
    }
    
    // Use detected statute to generate meaningful title
    if (detectedStatute) {
      const statuteTitles = {
        'StGB': 'Strafgesetzbuch (StGB)',
        'BGB': 'Bürgerliches Gesetzbuch (BGB)',
        'GG': 'Grundgesetz (GG)',
        'HGB': 'Handelsgesetzbuch (HGB)',
        'EU-GDPR': 'EU-Datenschutz-Grundverordnung (GDPR)'
      };
      return statuteTitles[detectedStatute] || `${detectedStatute} - German Law`;
    }
    
    // Fallback based on filename
    const filenameLower = filename.toLowerCase();
    if (filenameLower.includes('stgb') || filenameLower.includes('straf')) return "Strafgesetzbuch (StGB)";
    if (filenameLower.includes('bgb') || filenameLower.includes('bürgerlich')) return "Bürgerliches Gesetzbuch (BGB)";
    if (filenameLower.includes('gg') || filenameLower.includes('grundgesetz')) return "Grundgesetz (GG)";
    if (filenameLower.includes('hgb') || filenameLower.includes('handels')) return "Handelsgesetzbuch (HGB)";
    if (filenameLower.includes('gdpr') || filenameLower.includes('dsgvo')) return "EU-Datenschutz-Grundverordnung (GDPR)";
    
    // Last resort: clean filename
    return filename
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[_-]/g, " ") // Replace underscores and dashes with spaces
      .replace(/\bpdf\b/gi, "") // Remove "pdf"
      .trim();
  }

  // ⭐⭐ NEW: Enhanced legal metadata methods
  extractJurisdiction(content, statute) {
    if (statute === 'EU-GDPR') return 'EU';
    if (content.includes('Bundesrepublik Deutschland') || 
        content.includes('Deutschland') ||
        statute === 'StGB' || statute === 'BGB' || statute === 'GG' || statute === 'HGB') {
      return 'DE';
    }
    return 'Unknown';
  }

  extractYearFromText(content) {
    const yearMatch = content.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
  }

  isOfficialText(content) {
    return content.includes('Bundesgesetzblatt') ||
           content.includes('BGBl.') ||
           content.includes('Amtsblatt') ||
           content.includes('Official Journal');
  }

  extractLegalTopics(content) {
    const topics = new Set();
    const contentLower = content.toLowerCase();
    
    // German legal topics
    if (contentLower.includes('miete') || contentLower.includes('mieter')) topics.add('Mietrecht');
    if (contentLower.includes('kauf') || contentLower.includes('käufer')) topics.add('Kaufrecht');
    if (contentLower.includes('vertrag')) topics.add('Vertragsrecht');
    if (contentLower.includes('schaden') || contentLower.includes('haftung')) topics.add('Schadensersatzrecht');
    if (contentLower.includes('urheber') || contentLower.includes('copyright')) topics.add('Urheberrecht');
    if (contentLower.includes('datenschutz') || contentLower.includes('gdpr')) topics.add('Datenschutzrecht');
    if (contentLower.includes('handel') || contentLower.includes('kaufmann')) topics.add('Handelsrecht');
    if (contentLower.includes('straf') || contentLower.includes('strafbar')) topics.add('Strafrecht');
    if (contentLower.includes('verfassung') || contentLower.includes('grundrecht')) topics.add('Verfassungsrecht');
    if (contentLower.includes('verwaltung') || contentLower.includes('behörde')) topics.add('Verwaltungsrecht');
    if (contentLower.includes('arbeit') || contentLower.includes('arbeitsvertrag')) topics.add('Arbeitsrecht');
    
    return Array.from(topics);
  }

  detectLanguage(content) {
    const sample = content.substring(0, 2000).toLowerCase();
    const germanWords = ["der", "die", "das", "und", "für", "mit", "von", "zu", "auf", "ist", 
                         "dem", "den", "im", "am", "um", "als", "aus", "bei", "nach", "über",
                         "ein", "eine", "einer", "einem", "einen", "eines", "dass", "daß",
                         "aber", "oder", "wenn", "weil", "obwohl", "sowie", "sondern"];
    const englishWords = ["the", "and", "for", "with", "from", "to", "in", "of", "on", "is",
                          "a", "an", "that", "this", "by", "at", "as", "it", "be", "are",
                          "but", "or", "if", "because", "although", "as well as", "but rather"];

    let de = 0, en = 0;
    germanWords.forEach(w => { 
      const regex = new RegExp(`\\b${w}\\b`, 'gi');
      de += (sample.match(regex) || []).length;
    });
    englishWords.forEach(w => { 
      const regex = new RegExp(`\\b${w}\\b`, 'gi');
      en += (sample.match(regex) || []).length;
    });

    return de > en ? "german" : "english";
  }

  // 🎯 SIMPLIFIED: Only basic search for documents (not answering questions)
  async searchDocuments(query, options = {}) {
    const { limit = 5 } = options;
    const results = [];

    if (this.documents.length === 0) {
      console.log("⚠️  No documents available for search");
      return results;
    }

    console.log(`🔍 Simple document search for: "${query}"`);

    const queryLower = query.toLowerCase();

    for (const doc of this.documents) {
      let score = 0;
      const contentLower = doc.content.toLowerCase();

      // Simple keyword matching
      if (contentLower.includes(queryLower)) {
        score += 5;
      }

      // Check title
      if (doc.metadata.title.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      // Check statute
      if (doc.metadata.statute && doc.metadata.statute.toLowerCase().includes(queryLower)) {
        score += 2;
      }

      if (score > 0) {
        results.push({
          document: {
            id: doc.id,
            filename: doc.filename,
            title: doc.metadata.title,
            type: doc.metadata.type,
            statute: doc.metadata.statute,
            language: doc.metadata.language,
            pages: doc.metadata.pages,
            authority: doc.authority_metadata?.source_type || 'unclassified',
            authorityRank: doc.authority_metadata?.authority_rank || 100
          },
          score: score,
          excerpt: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
        });
      }
    }

    console.log(`📊 Found ${results.length} potential documents`);
    const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, limit);
    
    return sortedResults;
  }

  // 🎯 CRITICAL FIX: Fixed duplicate 'chunks' property name
  getAllDocuments() {
    return this.documents.map(d => ({
      id: d.id,
      filename: d.filename,
      path: d.filepath,
      title: d.metadata.title,
      type: d.metadata.type,
      statute: d.metadata.statute,
      statuteConfidence: d.metadata.statuteConfidence,
      statuteDetectionMethod: d.metadata.statuteDetectionMethod,
      language: d.metadata.language,
      words: d.metadata.wordCount,
      pages: d.metadata.pages,
      chunkCount: d.chunks.length,
      content: d.content, // Keep content for RAG system
      chunks: d.chunks, // Keep actual chunks for RAG system
      metadata: d.metadata, // Include enhanced metadata
      authority_metadata: d.authority_metadata // Include authority metadata placeholder
    }));
  }

  getDocumentContent(filename) {
    const doc = this.documents.find(d => d.filename === filename);
    return doc ? doc.content : null;
  }

  getDocumentChunks(filename) {
    const doc = this.documents.find(d => d.filename === filename);
    return doc ? doc.chunks : [];
  }

  // 🎯 NEW: Get document with authority metadata
  getDocumentWithAuthority(filename) {
    const doc = this.documents.find(d => d.filename === filename);
    if (!doc) return null;
    
    return {
      id: doc.id,
      filename: doc.filename,
      title: doc.metadata.title,
      statute: doc.metadata.statute,
      statuteConfidence: doc.metadata.statuteConfidence,
      language: doc.metadata.language,
      pages: doc.metadata.pages,
      chunkCount: doc.chunks?.length || 0,
      content: doc.content,
      authority_metadata: doc.authority_metadata
    };
  }

  // 🎯 NEW: Get document statistics including authority
  getStatistics() {
    const stats = {
      totalDocuments: this.documents.length,
      totalChunks: this.documents.reduce((sum, doc) => sum + (doc.chunks?.length || 0), 0),
      totalWords: this.documents.reduce((sum, doc) => sum + (doc.metadata.wordCount || 0), 0),
      statutes: {},
      types: {},
      jurisdictions: {},
      languages: {},
      authorities: {}
    };

    this.documents.forEach(doc => {
      const statute = doc.metadata.statute || 'unknown';
      const type = doc.metadata.type || 'unknown';
      const jurisdiction = doc.metadata.jurisdiction || 'unknown';
      const language = doc.metadata.language || 'unknown';
      const authority = doc.authority_metadata?.source_type || 'unclassified';
      
      stats.statutes[statute] = (stats.statutes[statute] || 0) + 1;
      stats.types[type] = (stats.types[type] || 0) + 1;
      stats.jurisdictions[jurisdiction] = (stats.jurisdictions[jurisdiction] || 0) + 1;
      stats.languages[language] = (stats.languages[language] || 0) + 1;
      stats.authorities[authority] = (stats.authorities[authority] || 0) + 1;
    });

    return stats;
  }

  // 🎯 FIXED: Debug method updated for Python authority
  debugStatuteAndAuthorityDetection() {
    console.log('\n🔍 STATUTE & AUTHORITY DETECTION DEBUG:');
    console.log('='.repeat(80));
    console.log('📌 NOTE: Authority resolution now handled by Python service');
    console.log('='.repeat(80));
    
    this.documents.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.filename}`);
      console.log(`   Title: ${doc.metadata.title}`);
      console.log(`   Statute: ${doc.metadata.statute || 'NOT DETECTED'}`);
      console.log(`   Statute Confidence: ${(doc.metadata.statuteConfidence * 100).toFixed(0)}%`);
      console.log(`   Statute Detection Method: ${doc.metadata.statuteDetectionMethod}`);
      console.log(`   Authority Type: unclassified (Python will evaluate)`);
      console.log(`   Authority Rank: 100 (default placeholder)`);
      console.log(`   Authority Weight: 1.0 (default)`);
      console.log(`   Authority Classification: deferred_to_python`);
      console.log(`   Type: ${doc.metadata.type}`);
      console.log();
    });
  }

  // 🎯 FIXED: All documents have same authority rank now
  getDocumentsByAuthorityRank(minRank = 0) {
    return this.documents.filter(doc => 
      doc.authority_metadata?.authority_rank >= minRank
    );
  }

  // 🎯 FIXED: Search documents - authority filtering now minimal
  async searchDocumentsWithAuthority(query, options = {}) {
    const { 
      limit = 5, 
      minAuthorityRank = 0,
      authorityType = null 
    } = options;
    
    const results = [];

    if (this.documents.length === 0) {
      console.log("⚠️  No documents available for search");
      return results;
    }

    console.log(`🔍 Advanced document search for: "${query}"`);
    console.log(`   Note: Authority filtering minimal - Python handles full classification`);

    const queryLower = query.toLowerCase();

    for (const doc of this.documents) {
      let score = 0;
      const contentLower = doc.content.toLowerCase();

      // Simple keyword matching
      if (contentLower.includes(queryLower)) {
        score += 5;
      }

      // Check title
      if (doc.metadata.title.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      // Check statute
      if (doc.metadata.statute && doc.metadata.statute.toLowerCase().includes(queryLower)) {
        score += 2;
      }

      if (score > 0) {
        results.push({
          document: {
            id: doc.id,
            filename: doc.filename,
            title: doc.metadata.title,
            type: doc.metadata.type,
            statute: doc.metadata.statute,
            language: doc.metadata.language,
            pages: doc.metadata.pages,
            authority: doc.authority_metadata?.source_type || 'unclassified',
            authorityRank: doc.authority_metadata?.authority_rank || 100,
            authorityWeight: doc.authority_metadata?.weight || 1.0
          },
          score: score,
          excerpt: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
        });
      }
    }

    console.log(`📊 Found ${results.length} matching documents`);
    const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, limit);
    
    return sortedResults;
  }
}

module.exports = new PDFDocumentService();