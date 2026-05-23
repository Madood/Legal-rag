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

        // Skip if this statute was already loaded from a previous file
        const alreadyLoaded = this.documents.find(d => d.metadata?.statute === statute);
        if (alreadyLoaded) {
          console.warn(`⚠️ Skipping duplicate: ${path.basename(filePath)} — ${statute} already loaded from ${alreadyLoaded.filename}`);
          continue;
        }

        let chunks;
        // All statutes that use § N format get the paragraph splitter.
        // GG uses Art N format (splitByArtikel). Everything else falls back to createChunks.
        const PARAGRAPH_STATUTES = [
          'BGB', 'STGB', 'HGB', 'ZPO', 'STPO', 'GMBHG',
          'AKTG', 'INSO', 'KSCHG',
          'ABGG', 'ADVERIMG', 'AENTG', 'AGG', 'AMG', 'ANTIDOPG',
          'AO', 'ARBSTAETTV', 'ASYLG', 'AUFENTHG', 'EGAKTG', 'NKRG',
        ];
        if (PARAGRAPH_STATUTES.includes(statute)) {
          chunks = this.splitByParagraph(text, statute);
          if (chunks.length === 0) {
            console.warn(`⚠️ splitByParagraph returned 0 chunks for ${path.basename(filePath)} (text length: ${text.length}) — falling back to createChunks`);
            chunks = this.createChunks(text);
          }
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

        // Diagnostic: verify critical BGB paragraphs are indexed after load
        if (statute === 'BGB') {
          const _check = ['311', '823', '433', '242', '280'];
          for (const _p of _check) {
            const _rx = new RegExp(`§\\s*${_p}\\b`);
            const _found = chunks.some(c =>
              String(c.metadata?.paragraph || '').toLowerCase() === _p ||
              _rx.test(c.content || '')
            );
            if (!_found) {
              console.error(`CRITICAL: §${_p} BGB not found in parsed chunks — check PDF splitter`);
            }
          }
        }
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
    // Original (case-sensitive) basename for includes() checks below
    const origName = path.basename(filePath).replace(/\.pdf$/i, '');

    // ── Step 1: Case-sensitive filename includes() — resolves ambiguous short names
    // that are substrings of longer names (AbgG⊃GG, AGG⊃GG, AO⊃ZPO text triggers, etc.)
    // Order matters: longer/more-specific patterns first.
    if (origName.includes('EGAktG'))                                    return 'EGAKTG';
    if (origName.includes('AbgG'))                                      return 'ABGG';
    if (origName.includes('AdVermiG'))                                  return 'ADVERIMG';
    if (origName.includes('AEntG'))                                     return 'AENTG';
    if (origName.includes('AGG'))                                       return 'AGG';
    if (origName.includes('AMG'))                                       return 'AMG';
    if (origName.includes('AntiDopG'))                                  return 'ANTIDOPG';
    if (origName.includes('ArbStätt') || origName.includes('ArbStatt')) return 'ARBSTAETTV';
    if (origName.includes('AsylG'))                                     return 'ASYLG';
    if (origName.includes('AufenthG'))                                  return 'AUFENTHG';
    if (origName.includes('NKRG'))                                      return 'NKRG';
    if (origName.includes('InsO'))                                      return 'INSO';
    if (origName.includes('AktG'))                                      return 'AKTG';
    if (origName.includes('AO'))                                        return 'AO';

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

  // Split statute text into one chunk per §-paragraph.
  // Each chunk carries the paragraph number in metadata so findExactParagraph()
  // can locate it without relying solely on content regex.
  // Handles both "§311 Title\n..." and "§\n311\nTitle..." PDF extraction formats.
  // Strip standard Bundesministerium page-header boilerplate that pdf-parse injects
  // between paragraphs when a page break falls inside a statute section.
  // Pattern seen in all official German law PDFs from gesetze-im-internet.de:
  //   "- Seite N von M -\n\nEin Service des Bundesministerium...www.gesetze-im-internet.de\n"
  static _stripPdfHeaders(text) {
    return text
      // Multi-line page header block
      .replace(/\n?-\s*Seite\s+\d+\s+von\s+\d+\s*-[\s\S]*?www\.gesetze-im-internet\.de\s*/gi, '\n')
      // Standalone page-number line that slipped through
      .replace(/\n-\s*Seite\s+\d+\s+von\s+\d+\s*-\n/gi, '\n');
  }

  /**
   * Remove PDF extraction artifacts: adjacent duplicate words/phrases and
   * duplicate sentences within a single chunk.
   * Applied to every chunk on load — safe for valid legal text because it
   * only removes ADJACENT repetitions, not semantically valid repetitions.
   */
  static _cleanChunkText(text) {
    if (!text || text.length < 10) return text;
    let t = text;

    // Pass 1: adjacent duplicate single tokens ≥3 chars.
    // Avoids \b so German umlauts (ä, ö, ü, ß) are handled correctly.
    // "Tod Tod" → "Tod",  "anderen, anderen" → "anderen,"
    t = t.replace(/(^|[\s,;:()\[\]])([^\s,;:()\[\]]{3,})([\s,;:()\[\]])(\2)(?=[\s,;:()\[\].!?]|$)/gi,
      (_, pre, word, sep, _dup) => pre + word + sep);

    // Pass 2: adjacent duplicate 2–5 word phrases.
    // "eines anderen eines anderen" → "eines anderen"
    for (let n = 5; n >= 2; n--) {
      const re = new RegExp(
        `([^\\s]+(?:\\s[^\\s]+){${n - 1}})(\\s+)\\1(?=\\s|$)`,
        'g'
      );
      t = t.replace(re, '$1');
    }

    // Pass 3: remove exact duplicate sentences within the chunk.
    // Only deduplicates sentences ≥30 chars to avoid removing valid short clauses.
    const seen = new Set();
    t = t.replace(/[^.!?\n]+[.!?]*/g, sent => {
      const key = sent.trim().toLowerCase();
      if (key.length >= 30 && seen.has(key)) return '';
      if (key.length >= 30) seen.add(key);
      return sent;
    });

    // Normalize whitespace artefacts left by removals
    return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  splitByParagraph(text, statute) {
    // Strip PDF page-header boilerplate before any further processing.
    // 458 of 2518 BGB chunks were contaminated — clean at source.
    const clean = PdfDocumentService._stripPdfHeaders(text);

    // Normalise: collapse § followed only by whitespace/newline before the number
    // so "§\n311" becomes "§311" for the splitter.
    const normalised = clean.replace(/§\s*\n+\s*/g, '§');

    // Split on paragraph boundaries: capture everything from one § to the next.
    // The lookahead stops at the newline that precedes the next paragraph header.
    const regex = /§\s*(\d+[a-z]?)\b[\s\S]*?(?=\n\s*§\s*\d+[a-z]?\b|$)/g;
    const chunks = [];
    let m;

    while ((m = regex.exec(normalised)) !== null) {
      const block = m[0].trim();
      const paraNum = m[1].toLowerCase();           // e.g. "311", "311a"
      if (!block || block.length < 20) continue;    // skip noise / empty matches

      const cleanedBlock = PdfDocumentService._cleanChunkText(block);
      chunks.push({
        content: cleanedBlock,
        chunk_index: chunks.length,
        metadata: {
          statute,
          paragraph: paraNum,
          isNormParagraph: true,
          startsWithParagraph: true,
          wordCount: cleanedBlock.split(/\s+/).length
        }
      });
    }

    // Fallback: if exec loop found nothing, try match() (older behaviour)
    if (chunks.length === 0) {
      const fallback = normalised.match(/§\s*\d+[a-z]?\b[\s\S]*?(?=\n\s*§\s*\d+[a-z]?\b|$)/g) || [];
      fallback.forEach((block, index) => {
        const pm = block.match(/§\s*(\d+[a-z]?)/);
        if (!pm) return;
        const cleanedFb = PdfDocumentService._cleanChunkText(block.trim());
        chunks.push({
          content: cleanedFb,
          chunk_index: index,
          metadata: {
            statute,
            paragraph: pm[1].toLowerCase(),
            isNormParagraph: true,
            startsWithParagraph: true,
            wordCount: block.split(/\s+/).length
          }
        });
      });
    }

    return chunks;
  }

  splitByArtikel(text, statute) {
    // GG PDF uses "\nArt N \n" format (no period, standalone line)
    // Strip page headers first (same gesetze-im-internet.de source)
    const clean = PdfDocumentService._stripPdfHeaders(text);
    // Split on that boundary
    const regex = /\nArt\s+(\d+[a-z]?)\s*\n([\s\S]*?)(?=\nArt\s+\d+[a-z]?\s*\n|$)/g;
    const results = [];
    let m;
    while ((m = regex.exec(clean)) !== null) {
      const articleNum = m[1];
      const body = m[2].trim();
      if (!body) continue;
      const cleanedBody = PdfDocumentService._cleanChunkText(`Art ${articleNum}\n${body}`);
      results.push({
        content: cleanedBody,
        chunk_index: results.length,
        metadata: {
          statute,
          paragraph: articleNum.toLowerCase(),
          isNormParagraph: true,
          startsWithParagraph: true,
          isArticle: true,
          wordCount: cleanedBody.split(/\s+/).length
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
      .map((p, i) => {
        const cleanedP = PdfDocumentService._cleanChunkText(p);
        return {
          content: cleanedP,
          chunk_index: i,
          metadata: {
            wordCount: cleanedP.split(/\s+/).length,
            isNormParagraph: this.isNormParagraph(cleanedP),
            startsWithParagraph: /^§\s*\d+/.test(cleanedP)
          }
        };
      });
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