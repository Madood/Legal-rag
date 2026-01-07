const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

class PDFStructureExtractor {
  extractStatuteMetadata(chunks) {
    // Analyze chunks to automatically detect statute type
    const statuteHints = [];
    
    chunks.forEach(chunk => {
      const content = chunk.content || '';
      
      // Detect statute from content patterns
      if (content.includes('Strafgesetzbuch') || content.includes('StGB')) {
        statuteHints.push({
          statute: 'StGB',
          confidence: 0.9,
          evidence: content.substring(0, 100)
        });
      }
      
      if (content.includes('Bürgerliches Gesetzbuch') || content.includes('BGB')) {
        statuteHints.push({
          statute: 'BGB',
          confidence: 0.9,
          evidence: content.substring(0, 100)
        });
      }
      
      if (content.includes('Handelsgesetzbuch') || content.includes('HGB')) {
        statuteHints.push({
          statute: 'HGB',
          confidence: 0.9,
          evidence: content.substring(0, 100)
        });
      }
      
      if (content.includes('Grundgesetz') || content.includes('GG')) {
        statuteHints.push({
          statute: 'GG',
          confidence: 0.9,
          evidence: content.substring(0, 100)
        });
      }
      
      if (content.includes('Datenschutz-Grundverordnung') || content.includes('GDPR') || content.includes('DSGVO')) {
        statuteHints.push({
          statute: 'EU-GDPR',
          confidence: 0.9,
          evidence: content.substring(0, 100)
        });
      }
    });
    
    // Find most likely statute
    const statuteCounts = {};
    statuteHints.forEach(hint => {
      statuteCounts[hint.statute] = (statuteCounts[hint.statute] || 0) + 1;
    });
    
    let mostLikelyStatute = null;
    let maxCount = 0;
    
    Object.entries(statuteCounts).forEach(([statute, count]) => {
      if (count > maxCount) {
        mostLikelyStatute = statute;
        maxCount = count;
      }
    });
    
    return mostLikelyStatute;
  }
  
  extractNormClusters(chunks) {
    // Group paragraphs into legal topic clusters
    const normPattern = /§\s*(\d+[a-z]?)/g;
    const clusters = {};
    
    chunks.forEach(chunk => {
      const content = chunk.content || '';
      const matches = [...content.matchAll(normPattern)];
      
      matches.forEach(match => {
        const paragraph = match[1];
        const section = this.getSectionFromParagraph(paragraph);
        
        if (!clusters[section]) {
          clusters[section] = {
            paragraphs: new Set(),
            keywords: new Set(),
            chunks: []
          };
        }
        
        clusters[section].paragraphs.add(paragraph);
        clusters[section].chunks.push(chunk);
        
        // Extract keywords from context
        const context = content.substring(
          Math.max(0, match.index - 100),
          Math.min(content.length, match.index + 100)
        );
        
        const keywords = this.extractKeywords(context);
        keywords.forEach(keyword => clusters[section].keywords.add(keyword));
      });
    });
    
    // Convert to array format
    return Object.entries(clusters).map(([section, data]) => ({
      section,
      paragraphs: [...data.paragraphs],
      keywords: [...data.keywords].slice(0, 10),
      chunkCount: data.chunks.length
    }));
  }
  
  getSectionFromParagraph(paragraph) {
    // Group paragraphs into logical sections
    const num = parseInt(paragraph, 10);
    
    if (isNaN(num)) return 'other';
    
    // Legal grouping logic
    if (num >= 174 && num <= 184) return 'sexual_offences';
    if (num >= 211 && num <= 216) return 'homicide';
    if (num >= 223 && num <= 231) return 'bodily_harm';
    if (num >= 242 && num <= 248) return 'property_offences';
    if (num >= 38 && num <= 40) return 'punishment_general';
    if (num >= 46 && num <= 47) return 'sentencing';
    
    // BGB groupings
    if (num >= 433 && num <= 453) return 'sales_contract';
    if (num >= 535 && num <= 580) return 'rental_law';
    if (num >= 823 && num <= 853) return 'tort_law';
    
    // HGB groupings
    if (num >= 1 && num <= 7) return 'merchant_definition';
    if (num >= 8 && num <= 16) return 'commercial_register';
    if (num >= 343 && num <= 372) return 'commercial_transactions';
    
    return 'general';
  }
  
  extractKeywords(text) {
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stopWords = new Set(['der', 'die', 'das', 'und', 'für', 'mit', 'von', 'zu', 'auf']);
    
    return tokens
      .filter(token => token.length > 3 && !stopWords.has(token))
      .slice(0, 5);
  }
  
  buildLegalTopicMap(chunks) {
    // Auto-discover what topics exist in the statute
    const statute = this.extractStatuteMetadata(chunks);
    const clusters = this.extractNormClusters(chunks);
    
    return {
      statute,
      clusters,
      summary: this.generateStatuteSummary(clusters, statute)
    };
  }
  
  generateStatuteSummary(clusters, statute) {
    if (statute === 'StGB') {
      const hasSexual = clusters.some(c => c.section === 'sexual_offences');
      const hasHomicide = clusters.some(c => c.section === 'homicide');
      const hasProperty = clusters.some(c => c.section === 'property_offences');
      
      let summary = 'Criminal law covering: ';
      const parts = [];
      if (hasSexual) parts.push('sexual offences');
      if (hasHomicide) parts.push('homicide');
      if (hasProperty) parts.push('property offences');
      if (parts.length === 0) parts.push('various criminal offences');
      
      return summary + parts.join(', ');
    }
    
    if (statute === 'BGB') {
      return 'German Civil Code covering contracts, obligations, property';
    }
    
    if (statute === 'HGB') {
      return 'German Commercial Code covering merchants, companies, trade';
    }
    
    if (statute === 'GG') {
      return 'German Basic Law (Constitution) covering fundamental rights';
    }
    
    if (statute === 'EU-GDPR') {
      return 'EU Data Protection Regulation covering personal data privacy';
    }
    
    return 'Legal statute';
  }
}

module.exports = new PDFStructureExtractor();