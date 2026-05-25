import { useEffect, useState } from 'react';
import { X, FileText, ExternalLink, AlertCircle } from 'lucide-react';
import './PdfViewerModal.css';

export interface PdfViewerSource {
  statute?: string;
  paragraph?: string;
  documentName?: string;
  page?: number;
  excerpt?: string;
}

interface PdfViewerModalProps {
  source: PdfViewerSource;
  onClose: () => void;
}

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export function PdfViewerModal({ source, onClose }: PdfViewerModalProps) {
  const [pdfError, setPdfError] = useState(false);
  const [loading, setLoading]   = useState(true);

  const statute  = (source.statute || '').toUpperCase();
  const filename = source.documentName || (statute ? `${statute}.pdf` : 'document.pdf');
  // Endpoint accepts statute without extension; page anchor tells browser where to scroll
  const pdfBase  = `${API_BASE}/documents/pdf/${statute}`;
  const pdfUrl   = source.page ? `${pdfBase}#page=${source.page}` : pdfBase;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reset error state when source changes
  useEffect(() => {
    setPdfError(false);
    setLoading(true);
  }, [statute, source.page]);

  return (
    <div className="pvm-overlay" onClick={onClose}>
      <div className="pvm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pvm-header">
          <div className="pvm-title-row">
            <FileText size={14} className="pvm-icon" />
            <span className="pvm-statute">
              {statute}{source.paragraph ? ` § ${source.paragraph}` : ''}
            </span>
            <span className="pvm-filename">
              {filename}{source.page ? ` · Seite ${source.page}` : ''}
            </span>
          </div>
          <div className="pvm-header-actions">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pvm-open-tab"
              title="In neuem Tab öffnen"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={13} />
            </a>
            <button className="pvm-close" onClick={onClose} aria-label="Schließen">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Excerpt bar ── */}
        {source.excerpt && (
          <div className="pvm-excerpt">
            <p className="pvm-excerpt-text">„{source.excerpt}"</p>
          </div>
        )}

        {/* ── PDF iframe or fallback ── */}
        {pdfError ? (
          <div className="pvm-fallback">
            <AlertCircle size={28} className="pvm-fallback-icon" />
            <p className="pvm-fallback-title">PDF nicht verfügbar</p>
            <p className="pvm-fallback-hint">
              Der Backend-Server wurde möglicherweise noch nicht neu gestartet.
            </p>

            {source.excerpt && (
              <div className="pvm-fallback-excerpt">
                <p className="pvm-fallback-label">
                  {statute}{source.paragraph ? ` § ${source.paragraph}` : ''}
                </p>
                <p className="pvm-fallback-text">„{source.excerpt}"</p>
              </div>
            )}

            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pvm-fallback-link"
            >
              PDF in neuem Tab öffnen →
            </a>
          </div>
        ) : (
          <>
            {loading && (
              <div className="pvm-loading">
                <div className="pvm-spinner" />
                <span>Lade PDF…</span>
              </div>
            )}
            <iframe
              key={pdfUrl}
              src={pdfUrl}
              className={`pvm-iframe${loading ? ' pvm-iframe-hidden' : ''}`}
              title={statute + (source.paragraph ? ` §${source.paragraph}` : '')}
              onLoad={() => setLoading(false)}
              onError={() => { setPdfError(true); setLoading(false); }}
            />
          </>
        )}

      </div>
    </div>
  );
}
