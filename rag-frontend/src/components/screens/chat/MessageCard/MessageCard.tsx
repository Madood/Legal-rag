import { User, BookOpen, ExternalLink } from 'lucide-react';
import { Card } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { SourceVerificationModal } from '../../verification/VerificationModal';
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

  const renderContent = () => {
    const lines = message.content.split('\n');
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
        <div className="message-content-wrapper message-content-wrapper-assistant">
          <div className="assistant-avatar">
            <BookOpen className="assistant-avatar-icon" />
          </div>
          <Card className="assistant-card">
            {/* Answer */}
            <div className="assistant-answer">
              <div className="message-content">
                {renderContent()}
              </div>
            </div>

            {/* Citations */}
            {message.citations && message.citations.length > 0 && (() => {
              const visibleCitations = message.citations.filter(c => (parseFloat(String(c.confidence)) || 0) > 0.05);
              if (visibleCitations.length === 0) {
                return (
                  <div className="citations-section">
                    <p className="text-slate-500 text-xs">Keine direkten Quellentreffer für diese Anfrage.</p>
                  </div>
                );
              }
              return (
              <div className="citations-section">
                <div className="citations-header">
                  <BookOpen className="citations-icon" />
                  <span className="citations-title">
                    {t('message.sources')} ({visibleCitations.length})
                  </span>
                </div>
                <div className="citations-list">
                  {visibleCitations.map((citation, idx) => (
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
                          {citation.documentName} · {t('message.page')} {citation.page}
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
              );
            })()}
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