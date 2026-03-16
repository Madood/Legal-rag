const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

class PdfDocumentService {
  constructor() {
    this.documents = [];
    this.ROOT_DIR = path.join(__dirname, "../../../documents");

    console.log("📄 PdfDocumentService initialized (PDF parsing enabled)");
  }

  async loadDocuments() {
    this.documents = [];

    if (!fs.existsSync(this.ROOT_DIR)) {
      throw new Error("❌ Documents root folder not found");
    }

    const pdfFiles = this._walk(this.ROOT_DIR);

    for (const filePath of pdfFiles) {
      try {
        const buffer = fs.readFileSync(filePath);
        const parsed = await pdf(buffer);

        const text = parsed.text?.trim();

        if (!text || text.length < 200) {
          console.warn(`⚠️ Skipped empty PDF: ${filePath}`);
          continue;
        }

        // Temporary debug: Show what's in the PDF
        console.log(`📄 First 200 chars of ${path.basename(filePath)}: ${text.substring(0, 200).replace(/\n/g, ' ')}`);

        // ✅ FIXED: DETECT STATUTE FIRST, THEN CHUNK ACCORDINGLY
        const statute = this.detectStatute(text, filePath);

        let chunks;
        if (["BGB", "STGB", "HGB", "ZPO", "STPO", "GMBHG"].includes(statute)) {
          chunks = this.splitByParagraph(text, statute);
        } else if (["GG"].includes(statute)) {
          chunks = this.splitByArtikel(text, statute);
        } else {
          chunks = this.createChunks(text);
        }

        this.documents.push({
          id: path.basename(filePath, '.pdf'),
          filename: path.basename(filePath),
          absolutePath: filePath,
          relativePath: path.relative(this.ROOT_DIR, filePath),
          corpus: path.relative(this.ROOT_DIR, filePath).split(path.sep)[0],

          content: text,
          chunks: chunks,
          pages: parsed.numpages || 1,

          metadata: {
            statute: statute,
            language: "german",
            source: "official_pdf",
            detectedParagraphs: this.detectParagraphsInText(text, statute),
            wordCount: text.split(/\s+/).length
          }
        });

        console.log(`📘 Loaded + parsed: ${path.basename(filePath)} (${statute}, ${chunks.length} chunks)`);
      } catch (error) {
        console.error(`❌ Failed to parse ${filePath}:`, error.message);
      }
    }

    console.log(`📚 Total parsed documents: ${this.documents.length}`);
    return this.documents;
  }

  // Filename-first statute detection — more specific names before less specific ones
  // to avoid substring false-matches (e.g. "gmbhg" contains "hgb", "stpo" context)
  detectStatute(text, filePath) {
    const lowerPath = filePath.replace(/\\/g, '/').toLowerCase();
    const lowerText = text.toLowerCase();
    const filename = path.basename(filePath).toLowerCase().replace(/\.pdf$/, '');

    // Helper: check filename OR parent directory segment
    const matchName = (code) =>
      filename === code ||
      filename.startsWith(code + '_') ||
      filename.endsWith('_' + code) ||
      lowerPath.includes('/' + code + '/');

    // CRITICAL: check longer/more-specific names BEFORE short names that are
    // substrings of them (e.g. "hgb" is a substring of "gmbhg").
    if (matchName('gmbhg'))   return 'GMBHG';
    if (matchName('aktg'))    return 'AKTG';
    if (matchName('kschg'))   return 'KSCHG';
    if (matchName('inso'))    return 'INSO';
    if (matchName('stgb'))    return 'STGB';
    if (matchName('stpo'))    return 'STPO';
    if (matchName('bgb'))     return 'BGB';
    if (matchName('hgb'))     return 'HGB';
    if (matchName('zpo'))     return 'ZPO';
    if (matchName('gg'))      return 'GG';
    if (matchName('eu-gdpr') || matchName('gdpr') || matchName('dsgvo')) return 'EU-GDPR';

    // Fallback: text-content heuristics (least reliable — log a warning)
    if (lowerText.includes('strafprozessordnung') || lowerText.includes(' stpo ')) return 'STPO';
    if (lowerText.includes('zivilprozessordnung') || lowerText.includes(' zpo '))  return 'ZPO';
    if (lowerText.includes('handelsgesetzbuch')   || lowerText.includes(' hgb '))  return 'HGB';
    if (lowerText.includes('bürgerliches gesetzbuch') || lowerText.includes(' bgb ')) return 'BGB';
    if (lowerText.includes('strafgesetzbuch')     || lowerText.includes(' stgb ')) return 'STGB';
    if (lowerText.includes('grundgesetz')         || lowerText.includes(' gg '))   return 'GG';
    if (lowerText.includes('datenschutz-grundverordnung') ||
        lowerText.includes('gdpr') || lowerText.includes('dsgvo'))                 return 'EU-GDPR';

    console.warn(`⚠️  Unknown statute for file: ${path.basename(filePath)}`);
    return 'UNKNOWN';
  }

  // ✅ FIXED: RENAMED AND GENERALIZED - Split by exact paragraph boundaries for §-based statutes
  splitByParagraph(text, statute) {
    const regex = /§\s*\d+[a-z]?\b[\s\S]*?(?=\n?\s*§\s*\d+[a-z]?\b|$)/g;
    const matches = text.match(regex) || [];

    return matches
      .map((block, index) => {
        const paraMatch = block.match(/§\s*(\d+[a-z]?)/);
        if (!paraMatch) return null;

        return {
          content: block.trim(),
          chunk_index: index,
          metadata: {
            statute,
            paragraph: paraMatch[1].toLowerCase(),
            isNormParagraph: true,
            startsWithParagraph: true,
            wordCount: block.split(/\s+/).length
          }
        };
      })
      .filter(Boolean);
  }

  splitByArtikel(text, statute) {
    // GG PDF uses "\nArt N \n" format (no period, standalone line)
    // Split on that boundary
    const regex = /\nArt\s+(\d+[a-z]?)\s*\n([\s\S]*?)(?=\nArt\s+\d+[a-z]?\s*\n|$)/g;
    const results = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      const articleNum = m[1];
      const body = m[2].trim();
      if (!body) continue;
      results.push({
        content: `Art ${articleNum}\n${body}`,
        chunk_index: results.length,
        metadata: {
          statute,
          paragraph: articleNum.toLowerCase(),
          isNormParagraph: true,
          startsWithParagraph: true,
          isArticle: true,
          wordCount: body.split(/\s+/).length
        }
      });
    }
    return results;
  }

  createChunks(text) {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 50)
      .map((p, i) => ({
        content: p,
        chunk_index: i,
        metadata: {
          wordCount: p.split(/\s+/).length,
          isNormParagraph: this.isNormParagraph(p),
          startsWithParagraph: /^§\s*\d+/.test(p)
        }
      }));
  }

  detectParagraphsInText(text, statute) {
    const paragraphs = [];
    
    const patterns = {
      BGB: /§\s*(\d+[a-z]?)\b/gi,
      STGB: /§\s*(\d+[a-z]?)\b/gi,
      GG: /Artikel\s*(\d+[a-z]?(?:\s*Abs\.?\s*\d+)?)\b/gi,
      HGB: /§\s*(\d+[a-z]?)\b/gi,
      "EU-GDPR": /Artikel\s*(\d+)\b/gi
    };
    
    const pattern = patterns[statute] || /§\s*(\d+[a-z]?)\b/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      paragraphs.push(match[1].trim());
    }
    
    return [...new Set(paragraphs)];
  }

  isNormParagraph(text) {
    const normPatterns = [
      /^§\s*\d+[a-z]?\b/,
      /^Artikel\s*\d+/i,
      /^\d+\s*\.\s*[A-Z]/,
      /^\([a-z]\)\s*[A-Z]/,
      /Absatz\s*\d+/i
    ];
    
    return normPatterns.some(pattern => pattern.test(text));
  }

  _walk(dir, results = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this._walk(fullPath, results);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".pdf")
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  getAllDocuments() {
    return this.documents;
  }

  clearDocuments() {
    this.documents = [];
  }

  getDocumentsByStatute(statute) {
    return this.documents.filter(doc => 
      doc.metadata?.statute === statute || doc.statute === statute
    );
  }

  searchDocuments(query, options = {}) {
    const { limit = 5, statute = null } = options;
    
    let filteredDocs = this.documents;
    if (statute) {
      filteredDocs = filteredDocs.filter(doc => 
        doc.metadata?.statute === statute || doc.statute === statute
      );
    }
    
    const results = filteredDocs.map(doc => {
      const content = doc.content || "";
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      
      const keywordMatches = lowerQuery.split(/\s+/).filter(word => 
        word.length > 3 && lowerContent.includes(word)
      ).length;
      
      const exactMatch = lowerContent.includes(lowerQuery) ? 1 : 0;
      
      return {
        document: doc.filename,
        statute: doc.metadata?.statute || "UNKNOWN",
        score: (keywordMatches * 0.3) + (exactMatch * 0.7),
        excerpt: content.substring(0, 150) + "...",
        metadata: doc.metadata
      };
    }).filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return results;
  }
}

module.exports = new PdfDocumentService();