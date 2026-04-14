import { User, BookOpen, ExternalLink } from 'lucide-react';
import { Card } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { SourceVerificationModal } from '../../legal/VerificationModal/VerificationModal';
import ComparisonCard from '../ComparisonCard';
import { useState } from 'react';
import { useTranslation } from '../../../../i18n';
import './MessageCard.css';

interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  page: number;
  excerpt: string;
  confidence: number;
  statute?: string;
  paragraph?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface MessageCardProps {
  message: Message;
  onCitationClick: (citation: Citation) => void;
}

export function MessageCard({ message, onCitationClick }: MessageCardProps) {
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const { t } = useTranslation();

  if (message.type === 'user') {
    return (
      <div className="message-container message-container-user">
        <div className="message-content-wrapper message-content-wrapper-user">
          <div className="user-message-bubble">
            <p className="user-message-text">{message.content}</p>
          </div>
          <div className="user-avatar">
            <User className="user-avatar-icon" />
          </div>
        </div>
      </div>
    );
  }

  // Strip ADDITIONAL PROVISIONS block — internal debug artifact from the synthesis pipeline.
  const cleanContent = message.content
    .replace(/\n\nADDITIONAL PROVISIONS:[\s\S]*?(?=\n\n\d\.|$)/g, '')
    .trim();

  // Structured comparison: must have a [ConceptTag] AND the Key Differences marker.
  // Doctrine fallback answers are excluded via the disclaimer text they always carry.
  const isComparison =
    !cleanContent.includes('allgemeinem Rechtswissen') &&
    /\[[^\]]+\]/.test(cleanContent) &&
    (cleanContent.includes('Key Differences') ||
      cleanContent.includes('Wesentliche Unterschiede'));

  const renderContent = () => {
    const lines = cleanContent.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={i} className="message-subheading">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      if (line.trim().match(/^\d+\./)) {
        return (
          <p key={i} className="message-list-item">
            {line}
          </p>
        );
      }
      if (line.trim()) {
        return (
          <p key={i} className="message-paragraph">
            {line}
          </p>
        );
      }
      return <br key={i} />;
    });
  };

  return (
    <>
      <div className="message-container message-container-assistant">
        <div className={`message-content-wrapper message-content-wrapper-assistant${isComparison ? ' message-content-wrapper-comparison' : ''}`}>
          <div className="assistant-avatar">
            <BookOpen className="assistant-avatar-icon" />
          </div>
          <Card className="assistant-card">
            <div className="assistant-answer">
              {isComparison ? (
                <>
                  <ComparisonCard answer={cleanContent} />
                </>
              ) : (
                <div className="message-content">
                  {renderContent()}
                </div>
              )}
            </div>

            {message.citations && message.citations.length > 0 && (
              <div className="citations-section">
                <div className="citations-header">
                  <BookOpen className="citations-icon" />
                  <span className="citations-title">
                    {t('message.sources')} ({message.citations.length})
                  </span>
                </div>
                <div className="citations-list">
                  {message.citations.map((citation, idx) => (
                    <div
                      key={idx}
                      className="citation-item"
                    >
                      <div className="citation-header">
                        <div className="citation-meta">
                          <code className="citation-chunk-id">
                            {citation.chunkId}
                          </code>
                          <Badge
                            variant="secondary"
                            className={`confidence-badge ${
                              citation.confidence >= 0.9
                                ? 'confidence-high'
                                : citation.confidence >= 0.7
                                ? 'confidence-medium'
                                : 'confidence-low'
                            }`}
                          >
                            {isNaN(citation.confidence) || citation.confidence == null ? '—' : `${(citation.confidence * 100).toFixed(0)}%`}
                          </Badge>
                        </div>
                        <p className="citation-source">
                          {citation.documentName || (citation.statute ? `${citation.statute}.pdf` : '')}{citation.paragraph ? ` · §${citation.paragraph}` : ''} · {t('message.page')} {citation.page}
                        </p>
                      </div>
                      <div className="citation-footer">
                        <p className="citation-excerpt">
                          {citation.excerpt}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCitation(citation)}
                          className="citation-view-button"
                        >
                          <ExternalLink className="citation-view-icon" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {selectedCitation && (
        <SourceVerificationModal
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </>
  );
}
