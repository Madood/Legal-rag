const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const natural = require('natural');
const stopword = require('stopword');
const { de } = require('stopword');

// Allowed base directories for file operations
const ALLOWED_DIRS = [
  path.resolve('./documents'),
  path.resolve('./uploads'),
];

/**
 * Validate that a file path is within an allowed directory.
 * Throws if path traversal is detected.
 */
function validateFilePath(filePath) {
  const resolved = path.resolve(filePath);
  const allowed = ALLOWED_DIRS.some(dir => resolved.startsWith(dir + path.sep) || resolved === dir);
  if (!allowed) {
    throw new Error(`Path traversal attempt blocked: ${filePath}`);
  }
  return resolved;
}

class FileProcessor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
  }

  // Extract text from different file types
  async extractText(filePath, fileType) {
    // Validate path before any file operation
    const safePath = validateFilePath(filePath);
    try {
      switch (fileType.toLowerCase()) {
        case 'pdf':
          return await this.extractFromPDF(safePath);
        case 'doc':
        case 'docx':
          return await this.extractFromDOCX(safePath);
        case 'txt':
        case 'md':
          return await this.extractFromText(safePath);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  async extractFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      return {
        text: pdfData.text,
        metadata: {
          pages: pdfData.numpages,
          info: pdfData.info,
          textLength: pdfData.text.length
        }
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  async extractFromDOCX(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      
      return {
        text: result.value,
        metadata: {
          textLength: result.value.length,
          ...result.metadata
        }
      };
    } catch (error) {
      throw new Error(`DOCX extraction failed: ${error.message}`);
    }
  }

  async extractFromText(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      
      return {
        text: text,
        metadata: {
          textLength: text.length,
          encoding: 'utf-8'
        }
      };
    } catch (error) {
      throw new Error(`Text file reading failed: ${error.message}`);
    }
  }

  // Clean and normalize German legal text
  cleanGermanLegalText(text) {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')       // Limit consecutive newlines
      .replace(/\s+/g, ' ')             // Normalize whitespace
      .replace(/§\s*(\d+)/g, '§$1')     // Fix paragraph formatting
      .replace(/Art\.\s*(\d+)/g, 'Art.$1') // Fix article formatting
      .replace(/Abs\.\s*(\d+)/g, 'Abs.$1') // Fix paragraph formatting
      .replace(/Nr\.\s*(\d+)/g, 'Nr.$1') // Fix number formatting
      .replace(/\s*-\s*/g, '-')         // Fix hyphen spacing
      .trim();
  }

  // Split text into chunks for German legal documents
  createLegalChunks(text, chunkSize = 1000, chunkOverlap = 200) {
    const chunks = [];
    
    // First, try to split by meaningful sections
    const sections = this.splitByLegalSections(text);
    
    for (const section of sections) {
      if (section.length <= chunkSize) {
        chunks.push(section);
      } else {
        // Further split large sections by sentences
        const sentences = this.sentenceTokenizer.tokenize(section);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk.length + sentence.length) <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = sentence;
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk);
        }
      }
    }
    
    // Add overlapping chunks for context preservation
    const overlappedChunks = this.addOverlap(chunks, chunkOverlap);
    
    return overlappedChunks.filter(chunk => chunk.length > 50);
  }

  splitByLegalSections(text) {
    // German legal document markers
    const sectionMarkers = [
      /(?=\n\s*(?:§\s*\d+[a-z]?\s|Artikel\s*\d+\s|Art\.\s*\d+\s|Absatz\s*\d+\s|Abs\.\s*\d+\s))/gi,
      /(?=\n\s*(?:[IVXLCDM]+\.\s|\([a-z]\)\s))/gi, // Roman numerals, lowercase letters
      /(?=\n\s*[A-ZÄÖÜ][A-Za-zäöüß]+\s*:)/gi, // Section titles
    ];
    
    let sections = [text];
    
    for (const marker of sectionMarkers) {
      const newSections = [];
      for (const section of sections) {
        const splitSections = section.split(marker).filter(s => s.trim());
        newSections.push(...splitSections);
      }
      sections = newSections;
    }
    
    return sections;
  }

  addOverlap(chunks, overlapSize) {
    const overlappedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      overlappedChunks.push(currentChunk);
      
      // Add overlapped chunk if not the last one
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapStart = Math.max(0, currentChunk.length - overlapSize);
        const overlapEnd = Math.min(overlapSize, nextChunk.length);
        
        const overlapText = currentChunk.substring(overlapStart) + 
                           ' ' + 
                           nextChunk.substring(0, overlapEnd);
        
        if (overlapText.trim().length > 50) {
          overlappedChunks.push(overlapText.trim());
        }
      }
    }
    
    return overlappedChunks;
  }

  // Extract German legal keywords
  extractGermanKeywords(text, maxKeywords = 20) {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    if (!tokens) return [];
    
    // Remove German stopwords
    const filteredTokens = stopword.removeStopwords(tokens, de);
    
    // German legal terms dictionary
    const germanLegalTerms = new Set([
      'grundgesetz', 'gesetz', 'recht', 'verfassung', 'paragraph',
      'artikel', 'gericht', 'urteil', 'verordnung', 'richtlinie',
      'vertrag', 'klage', 'anspruch', 'pflicht', 'haftung',
      'schaden', 'strafe', 'verwaltung', 'behörde', 'verfahren',
      'prozess', 'beweis', 'zeuge', 'anwalt', 'notar', 'richter',
      'bundesgerichtshof', 'bundesverfassungsgericht', 'landgericht',
      'amtsgericht', 'oberlandesgericht', 'eugh', 'menschenwürde',
      'grundrecht', 'gleichheit', 'freiheit', 'eigentum'
    ]);
    
    // Extract legal terms
    const legalKeywords = filteredTokens.filter(token => 
      germanLegalTerms.has(token) || 
      /^§\d+/.test(token) ||
      /^art\.\d+/i.test(token)
    );
    
    // Get unique keywords and limit count
    const uniqueKeywords = [...new Set(legalKeywords)];
    return uniqueKeywords.slice(0, maxKeywords);
  }

  // Detect document type for German legal documents
  detectGermanDocumentType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('grundgesetz') || lowerText.includes('basic law')) {
      return 'constitution';
    } else if (lowerText.includes('gesetz') && lowerText.includes('bundes')) {
      return 'federal_law';
    } else if (lowerText.includes('gesetz')) {
      return 'law';
    } else if (lowerText.includes('verordnung')) {
      return 'regulation';
    } else if (lowerText.includes('urteil') || lowerText.includes('gericht')) {
      return 'court_decision';
    } else if (lowerText.includes('vertrag') || lowerText.includes('vereinbarung')) {
      return 'contract';
    } else if (lowerText.includes('richtlinie')) {
      return 'directive';
    } else if (lowerText.includes('gutachten')) {
      return 'legal_opinion';
    }
    
    return 'legal_document';
  }

  // Extract metadata from German legal document
  extractGermanLegalMetadata(text, filename) {
    const metadata = {
      documentType: this.detectGermanDocumentType(text),
      language: this.detectLanguage(text),
      keywords: this.extractGermanKeywords(text),
      sections: this.extractSections(text)
    };
    
    // Try to extract title
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0 && lines[0].length < 200) {
      metadata.title = lines[0].trim();
    } else {
      metadata.title = path.parse(filename).name.replace(/_/g, ' ');
    }
    
    // Try to extract year
    const yearMatch = text.match(/(?:vom|vom\s+\d+\.\s+\w+\s+|Stand:\s*)(\d{4})/i);
    if (yearMatch) {
      metadata.year = parseInt(yearMatch[1]);
    }
    
    // Try to extract jurisdiction
    if (text.includes('Bundesrepublik Deutschland') || text.includes('BRD')) {
      metadata.jurisdiction = 'Germany (Federal)';
    } else if (text.includes('Europäische Union') || text.includes('EU')) {
      metadata.jurisdiction = 'European Union';
    } else {
      metadata.jurisdiction = 'Germany';
    }
    
    return metadata;
  }

  detectLanguage(text) {
    const germanWords = ['der', 'die', 'das', 'und', 'oder', 'für', 'mit', 'von'];
    const englishWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that'];
    
    const words = text.toLowerCase().split(/\W+/);
    const germanCount = words.filter(word => germanWords.includes(word)).length;
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    if (germanCount > englishCount * 2) {
      return 'german';
    } else if (englishCount > germanCount * 2) {
      return 'english';
    } else {
      return 'bilingual';
    }
  }

  extractSections(text) {
    const sections = [];
    const lines = text.split('\n');
    
    let currentSection = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for section markers
      const sectionMatch = trimmedLine.match(/^(§\s*\d+[a-z]?|Artikel\s*\d+|Art\.\s*\d+)\s+(.+)$/i);
      
      if (sectionMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          number: sectionMatch[1],
          title: sectionMatch[2],
          content: trimmedLine
        };
      } else if (currentSection && trimmedLine) {
        currentSection.content += '\n' + trimmedLine;
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  // Generate a simple summary
  generateSummary(text, maxLength = 200) {
    const sentences = this.sentenceTokenizer.tokenize(text);
    
    if (sentences.length === 0) {
      return 'No content available.';
    }
    
    // Take first few sentences that fit within maxLength
    let summary = '';
    for (const sentence of sentences) {
      if ((summary.length + sentence.length) <= maxLength) {
        summary += (summary ? ' ' : '') + sentence;
      } else {
        break;
      }
    }
    
    return summary + (summary.length < text.length ? '...' : '');
  }
}

module.exports = new FileProcessor();