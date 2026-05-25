import { useState, useEffect, useRef } from 'react';
import { DocumentSidebar } from '../DocumentSidebar/DocumentSidebar';
import { MessageCard } from '../MessageCard/MessageCard';
import { LoadingScales } from '../LoadingScales/LoadingScales';
import { LoginModal } from '../../auth/LoginModal/LoginModal';
import { PdfViewerModal } from '../PdfViewerModal/PdfViewerModal';
import type { PdfViewerSource } from '../PdfViewerModal/PdfViewerModal';
import { useChat } from '../../../../hooks/useChat';
import { useDocuments } from '../../../../hooks/useDocuments';
import { useAuth } from '../../../../context/AuthContext';
import { useTranslation } from '../../../../i18n';
import { Citation } from '../../../../services/api';
import { Send, Loader2, BookOpen } from 'lucide-react';
import './ChatScreen.css';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

type TokenErrorCode = 'TOKEN_EXHAUSTED' | 'SESSION_LIMIT' | 'AUTH_REQUIRED';

export function ChatScreen() {
  const { t } = useTranslation();
  const suggestions = [t('chat.s1'), t('chat.s2'), t('chat.s3'), t('chat.s4')];

  const [input, setInput]                       = useState('');
  const [sourcesOpen, setSourcesOpen]           = useState(false);
  const [activeCitations, setActiveCitations]   = useState<Citation[]>([]);
  const [errorMessage, setErrorMessage]         = useState<string | null>(null);
  const [tokenModalReason, setTokenModalReason] = useState<TokenErrorCode | null>(null);
  const [pdfViewer, setPdfViewer]               = useState<PdfViewerSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const { refreshUser } = useAuth();

  const {
    messages: chatMessages,
    askQuestion,
    isLoading,
    isStreaming,
    cancelStream,
    conversationId,
    startNewConversation,
    clearConversation,
  } = useChat({
    autoScroll: true,
    onError: (msg) => setErrorMessage(msg),
  });

  const { documents, isLoading: docsLoading } = useDocuments();

  const formattedMessages: Message[] = chatMessages.map(msg => ({
    id:        msg.id,
    type:      msg.role === 'user' ? 'user' : 'assistant',
    content:   msg.content,
    citations: msg.citations,
    timestamp: msg.timestamp,
  }));

  /* Last assistant message that carries citations — feeds the sources panel */
  const lastCitedMsg = [...formattedMessages]
    .reverse()
    .find(m => m.type === 'assistant' && m.citations?.length);

  const sourcesToShow = activeCitations.length
    ? activeCitations
    : lastCitedMsg?.citations ?? [];

  /* ── Handlers ── */
  const handleSend = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || isLoading || isStreaming) return;
    setErrorMessage(null);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await askQuestion(q, true);
      refreshUser();
    } catch (err: any) {
      const status = err?.response?.status;
      const code   = err?.response?.data?.code as TokenErrorCode | undefined;
      if (status === 402 && code) setTokenModalReason(code);
      else if (status === 401)    setTokenModalReason('AUTH_REQUIRED');
      else                        setErrorMessage(err.message || 'Anfrage fehlgeschlagen');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const handleCitationClick = (citation: Citation) => {
    setActiveCitations([citation]);
    setSourcesOpen(true);
  };

  const handleViewPdf = (citation: Citation) => {
    setPdfViewer({
      statute:      citation.statute,
      paragraph:    citation.paragraph,
      documentName: citation.documentName || (citation.statute ? `${citation.statute}.pdf` : undefined),
      page:         citation.page || 1,
      excerpt:      citation.excerpt,
    });
  };

  const handleNewConversation = () => {
    clearConversation();
    startNewConversation();
    setActiveCitations([]);
    setSourcesOpen(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [formattedMessages]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  return (
    <>
      {tokenModalReason && (
        <LoginModal reason={tokenModalReason} onClose={() => setTokenModalReason(null)} />
      )}

      {pdfViewer && (
        <PdfViewerModal source={pdfViewer} onClose={() => setPdfViewer(null)} />
      )}

      <div className="cs-root">

        {/* ── Left Sidebar ── */}
        <aside className="cs-sidebar">
          <DocumentSidebar
            onCitationClick={handleCitationClick}
            documents={documents}
            isLoading={docsLoading}
          />
        </aside>

        {/* ── Main Chat Column ── */}
        <div className="cs-main">

          {/* Messages area */}
          <div className="cs-messages">
            {formattedMessages.length === 0 ? (
              isLoading ? (
                <div className="cs-loading-center"><LoadingScales /></div>
              ) : (
                <div className="cs-empty">
                  <div className="cs-empty-icon">⚖</div>
                  <h2 className="cs-empty-title">{t('chat.welcome')}</h2>
                  <p className="cs-empty-sub">{t('chat.welcomeSubtitle')}</p>
                  <div className="cs-chips">
                    {suggestions.map(s => (
                      <button key={s} className="cs-chip" onClick={() => handleSend(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="cs-messages-list">
                {formattedMessages.map(msg => (
                  <MessageCard
                    key={msg.id}
                    message={msg}
                    onCitationClick={handleCitationClick}
                    onViewPdf={handleViewPdf}
                  />
                ))}
                {isLoading && <LoadingScales />}
                {isStreaming && (
                  <div className="cs-stream-cancel">
                    <button className="cs-cancel-btn" onClick={cancelStream}>{t('chat.stop')}</button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="cs-input-wrap">
            <div className="cs-input-box">
              <textarea
                ref={textareaRef}
                className="cs-textarea"
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                disabled={isLoading || isStreaming}
                rows={1}
              />
              <button
                className="cs-send-btn"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading || isStreaming}
              >
                {isLoading || isStreaming
                  ? <Loader2 size={15} className="cs-spin" />
                  : <Send size={15} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Sources Panel ── */}
        {sourcesOpen && (
          <aside className="cs-sources-panel">
            <div className="cs-sources-header">
              <BookOpen size={13} />
              <span>{t('message.sources')}</span>
              <button className="cs-sources-close" onClick={() => setSourcesOpen(false)}>×</button>
            </div>
            <div className="cs-sources-body">
              {sourcesToShow.length === 0 ? (
                <p className="cs-sources-empty">{t('sidebar.noDocuments')}</p>
              ) : (
                sourcesToShow.map((c, i) => {
                  const pct = (c.confidence != null && !isNaN(c.confidence))
                    ? Math.min(100, Math.round(Math.abs(c.confidence) * 100))
                    : null;
                  const confCls = pct == null ? '' : pct >= 90 ? ' conf-high' : pct >= 70 ? ' conf-med' : ' conf-low';
                  return (
                    <div
                      key={i}
                      className="cs-source-item cs-source-clickable"
                      onClick={() => handleViewPdf(c)}
                      title="PDF öffnen"
                    >
                      <div className="cs-source-stat">
                        <span className="cs-source-statute">
                          {c.statute
                            ? `${c.statute}${c.paragraph ? ` §${c.paragraph}` : ''}`
                            : c.chunkId}
                        </span>
                        <span className={`cs-source-conf${confCls}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </div>
                      <p className="cs-source-doc">
                        {c.documentName || `${c.statute}.pdf`} · S.&nbsp;{c.page}
                      </p>
                      {c.excerpt && (
                        <p className="cs-source-excerpt">„{c.excerpt}"</p>
                      )}
                      <div className="cs-source-bar">
                        <div
                          className="cs-source-bar-fill"
                          style={{ width: `${pct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

      </div>
    </>
  );
}
