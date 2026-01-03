import { X, FileText, MapPin, Clock, BarChart } from 'lucide-react';
import { Dialog, DialogContent } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { ScrollArea } from '../../ui/scroll-area';
import './VerificationModal.css';

interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  page: number;
  excerpt: string;
  confidence: number;
}

interface SourceVerificationModalProps {
  citation: Citation;
  onClose: () => void;
}

export function SourceVerificationModal({ citation, onClose }: SourceVerificationModalProps) {
  // Mock document context
  const fullContext = `§ 535 Inhalt und Hauptpflichten des Mietvertrags

(1) Durch den Mietvertrag wird der Vermieter verpflichtet, dem Mieter den Gebrauch der Mietsache während der Mietzeit zu gewähren. Der Vermieter hat die Mietsache dem Mieter in einem zum vertragsgemäßen Gebrauch geeigneten Zustand zu überlassen und sie während der Mietzeit in diesem Zustand zu erhalten.

(2) ${citation.excerpt}

(3) Vereinbarungen, durch die Rechte oder Pflichten von den Vorschriften dieses Titels abweichend geregelt werden, sind unwirksam, soweit nicht ein anderes bestimmt ist.`;

  const chunkMetadata = {
    chunkIndex: 12,
    totalChunks: 24,
    vectorSimilarity: citation.confidence,
    semanticScore: 0.92,
    retrievalRank: 1,
    processingTime: '45ms',
    embeddingModel: 'multilingual-e5-large',
  };

  const getConfidenceBadgeClass = (confidence: number) => {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    return 'confidence-low';
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="source-verification-dialog">
        <div className="modal-container">
          {/* Left Side - Document Preview */}
          <div className="document-preview">
            <div className="document-header">
              <div className="document-header-content">
                <div className="document-info">
                  <FileText className="document-icon" />
                  <div>
                    <h3 className="document-title">
                      {citation.documentName}
                    </h3>
                    <p className="document-page">
                      Seite {citation.page} von 8
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="close-button">
                  <X className="close-icon" />
                </Button>
              </div>
            </div>

            <ScrollArea className="document-content-scroll">
              <div className="document-content">
                {/* Document Page View */}
                <div className="document-view">
                  <div className="document-text">
                    <h2 className="document-section-title">
                      § 535 Inhalt und Hauptpflichten des Mietvertrags
                    </h2>
                    
                    <p className="document-paragraph">
                      (1) Durch den Mietvertrag wird der Vermieter verpflichtet, dem Mieter den Gebrauch der Mietsache während der Mietzeit zu gewähren. Der Vermieter hat die Mietsache dem Mieter in einem zum vertragsgemäßen Gebrauch geeigneten Zustand zu überlassen und sie während der Mietzeit in diesem Zustand zu erhalten.
                    </p>

                    {/* Highlighted Relevant Text */}
                    <div className="highlighted-text">
                      <p className="highlighted-content">
                        (2) {citation.excerpt}
                      </p>
                    </div>

                    <p className="document-paragraph">
                      (3) Vereinbarungen, durch die Rechte oder Pflichten von den Vorschriften dieses Titels abweichend geregelt werden, sind unwirksam, soweit nicht ein anderes bestimmt ist.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right Side - Metadata */}
          <div className="metadata-panel">
            <div className="metadata-header">
              <h3 className="metadata-title">Chunk Metadaten</h3>
            </div>

            <ScrollArea className="metadata-scroll">
              <div className="metadata-content">
                {/* Chunk Info */}
                <div className="metadata-section">
                  <h4 className="metadata-section-title">
                    Chunk Information
                  </h4>
                  <div className="metadata-card">
                    <div className="metadata-row">
                      <span className="metadata-label">ID:</span>
                      <code className="metadata-value code">
                        {citation.chunkId}
                      </code>
                    </div>
                    <div className="metadata-row">
                      <span className="metadata-label">Position:</span>
                      <span className="metadata-value">
                        {chunkMetadata.chunkIndex} / {chunkMetadata.totalChunks}
                      </span>
                    </div>
                    <div className="metadata-row">
                      <span className="metadata-label">Seite:</span>
                      <span className="metadata-value">{citation.page}</span>
                    </div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="metadata-section">
                  <div className="metadata-header-row">
                    <h4 className="metadata-section-title">
                      Konfidenz
                    </h4>
                    <Badge
                      className={`confidence-badge ${getConfidenceBadgeClass(citation.confidence)}`}
                    >
                      {(citation.confidence * 100).toFixed(0)}% Übereinstimmung
                    </Badge>
                  </div>
                  <Progress value={citation.confidence * 100} className="confidence-progress" />
                </div>

                {/* Retrieval Metrics */}
                <div className="metadata-section">
                  <h4 className="metadata-section-title">
                    Retrieval Metriken
                  </h4>
                  <div className="metrics-card">
                    <div className="metric-item">
                      <div className="metric-header">
                        <span className="metric-label">
                          Vektor-Ähnlichkeit:
                        </span>
                        <span className="metric-value">
                          {(chunkMetadata.vectorSimilarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={chunkMetadata.vectorSimilarity * 100} className="metric-progress" />
                    </div>
                    <div className="metric-item">
                      <div className="metric-header">
                        <span className="metric-label">
                          Semantischer Score:
                        </span>
                        <span className="metric-value">
                          {(chunkMetadata.semanticScore * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={chunkMetadata.semanticScore * 100} className="metric-progress" />
                    </div>
                    <div className="metric-footer">
                      <span className="metric-label">
                        Retrieval Rang:
                      </span>
                      <Badge variant="secondary" className="rank-badge">#{chunkMetadata.retrievalRank}</Badge>
                    </div>
                  </div>
                </div>

                {/* Technical Details */}
                <div className="metadata-section">
                  <h4 className="metadata-section-title">
                    Technische Details
                  </h4>
                  <div className="metadata-card">
                    <div className="metadata-row icon-row">
                      <Clock className="metadata-icon" />
                      <span className="metadata-label">Verarbeitungszeit:</span>
                      <span className="metadata-value">{chunkMetadata.processingTime}</span>
                    </div>
                    <div className="metadata-row icon-row">
                      <BarChart className="metadata-icon" />
                      <span className="metadata-label">Embedding:</span>
                      <code className="metadata-value code">
                        {chunkMetadata.embeddingModel}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Full Context */}
                <div className="metadata-section">
                  <h4 className="metadata-section-title">
                    Vollständiger Kontext
                  </h4>
                  <div className="context-card">
                    <pre className="context-text">
                      {fullContext}
                    </pre>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}