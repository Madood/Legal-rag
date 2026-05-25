import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import ComparisonCard from '../ComparisonCard';
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
  onViewPdf?: (citation: Citation) => void;
}

function renderLines(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <h4 key={i} className="mc-heading">{line.replace(/\*\*/g, '')}</h4>;
    }
    if (line.trim().match(/^\d+\./)) {
      return <p key={i} className="mc-list-item">{line}</p>;
    }
    if (line.trim()) {
      return <p key={i} className="mc-para">{line}</p>;
    }
    return <br key={i} />;
  });
}

export function MessageCard({ message, onCitationClick, onViewPdf }: MessageCardProps) {
  const [citOpen, setCitOpen] = useState(false);

  /* User bubble */
  if (message.type === 'user') {
    return (
      <div className="mc-row mc-row-user">
        <div className="mc-user-bubble">{message.content}</div>
      </div>
    );
  }

  /* Strip internal debug block */
  const clean = message.content
    .replace(/\n\nADDITIONAL PROVISIONS:[\s\S]*?(?=\n\n\d\.|$)/g, '')
    .trim();

  /* Detect structured legal comparison */
  const isComparison =
    !clean.includes('allgemeinem Rechtswissen') &&
    /\[[^\]]+\]/.test(clean) &&
    (clean.includes('Key Differences') || clean.includes('Wesentliche Unterschiede'));

  const hasCitations = (message.citations?.length ?? 0) > 0;
  const citCount     = message.citations?.length ?? 0;

  return (
    <>
      <div className="mc-row mc-row-assistant">
        <div className="mc-assistant-card">

          {/* Answer body */}
          {isComparison
            ? <ComparisonCard answer={clean} />
            : <div className="mc-content">{renderLines(clean)}</div>
          }

          {/* Collapsible citations */}
          {hasCitations && (
            <div className="mc-cit-section">
              <button
                className="mc-cit-toggle"
                onClick={() => setCitOpen(o => !o)}
              >
                <BookOpen size={12} />
                <span>{citCount} Quelle{citCount !== 1 ? 'n' : ''}</span>
                {citOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {citOpen && (
                <div className="mc-cit-list">
                  {message.citations!.map((c, i) => (
                    <div key={i} className="mc-cit-item">
                      <div className="mc-cit-head">
                        <span className="mc-cit-ref">
                          {c.statute
                            ? `${c.statute}${c.paragraph ? ` §${c.paragraph}` : ''}`
                            : c.chunkId}
                        </span>
                        {(() => {
                          const pct = (c.confidence != null && !isNaN(c.confidence))
                            ? Math.min(100, Math.round(Math.abs(c.confidence) * 100))
                            : null;
                          const cls = pct == null ? '' : pct >= 90 ? ' cc-h' : pct >= 70 ? ' cc-m' : ' cc-l';
                          return (
                            <span className={`mc-cit-conf${cls}`}>
                              {pct !== null ? `${pct}%` : '—'}
                            </span>
                          );
                        })()}
                        <button
                          className="mc-cit-view"
                          title="PDF öffnen"
                          onClick={() => { onCitationClick(c); if (onViewPdf) onViewPdf(c); }}
                        >
                          <ExternalLink size={10} />
                        </button>
                      </div>
                      <p className="mc-cit-doc">
                        {c.documentName || `${c.statute}.pdf`} · S.&nbsp;{c.page}
                      </p>
                      {c.excerpt && (
                        <p className="mc-cit-excerpt">„{c.excerpt}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </>
  );
}
