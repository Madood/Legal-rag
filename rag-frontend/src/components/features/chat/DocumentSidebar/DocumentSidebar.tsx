import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Document } from '../../../../services/api';
import './DocumentSidebar.css';

const STATUTE_FULL_NAMES: Record<string, string> = {
  BGB:    'Bürgerliches Gesetzbuch',
  STGB:   'Strafgesetzbuch',
  HGB:    'Handelsgesetzbuch',
  GG:     'Grundgesetz',
  ZPO:    'Zivilprozessordnung',
  STPO:   'Strafprozessordnung',
  INSO:   'Insolvenzordnung',
  AKTG:   'Aktiengesetz',
  GMBHG:  'GmbH-Gesetz',
  AO:     'Abgabenordnung',
  ESTG:   'Einkommensteuergesetz',
  USTG:   'Umsatzsteuergesetz',
  GEWO:   'Gewerbeordnung',
  WEG:    'Wohnungseigentumsgesetz',
  'EU-GDPR': 'EU-Datenschutz-Grundverordnung',
};

function resolveFullName(filename: string, fallback: string): string {
  const abbr = filename.replace(/\.pdf$/i, '').toUpperCase();
  return STATUTE_FULL_NAMES[abbr] || fallback || abbr;
}

interface DocumentSidebarProps {
  onCitationClick: (citation: any) => void;
  documents: Document[];
  isLoading: boolean;
}

export function DocumentSidebar({ onCitationClick, documents, isLoading }: DocumentSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className="dsb-root">
        <div className="dsb-header">
          <h3 className="dsb-title">Dokumente</h3>
        </div>
        <div className="dsb-loading">
          <Loader2 size={16} className="dsb-spin" />
          <span>Laden…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dsb-root">
      <div className="dsb-header">
        <h3 className="dsb-title">Dokumente</h3>
        {documents.length > 0 && (
          <span className="dsb-count">{documents.length} geladen</span>
        )}
      </div>

      <div className="dsb-list">
        {documents.length === 0 ? (
          <p className="dsb-empty">Keine Dokumente gefunden</p>
        ) : (
          documents.map(doc => {
            const isOpen  = expanded.has(doc.id);
            const abbr    = doc.filename.replace(/\.pdf$/i, '').toUpperCase();
            const fullName = resolveFullName(doc.filename, doc.title);

            return (
              <div key={doc.id} className="dsb-item">
                <button className="dsb-item-btn" onClick={() => toggle(doc.id)}>
                  <FileText size={13} className="dsb-item-icon" />
                  <div className="dsb-item-body">
                    <span className="dsb-item-abbr">{abbr}</span>
                    <span className="dsb-item-name">{fullName}</span>
                  </div>
                  <div className="dsb-item-right">
                    {doc.chunks != null && (
                      <span className="dsb-chunk-badge">
                        {doc.chunks.toLocaleString()} §§
                      </span>
                    )}
                    {isOpen
                      ? <ChevronDown size={12} className="dsb-chevron" />
                      : <ChevronRight size={12} className="dsb-chevron" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="dsb-details">
                    {doc.pages > 0 && (
                      <div className="dsb-detail-row">
                        <span className="dsb-detail-key">Seiten</span>
                        <span className="dsb-detail-val">{doc.pages}</span>
                      </div>
                    )}
                    {doc.words != null && doc.words > 0 && (
                      <div className="dsb-detail-row">
                        <span className="dsb-detail-key">Wörter</span>
                        <span className="dsb-detail-val">{doc.words.toLocaleString()}</span>
                      </div>
                    )}
                    {doc.type && (
                      <div className="dsb-detail-row">
                        <span className="dsb-detail-key">Typ</span>
                        <span className="dsb-detail-val">{doc.type.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {doc.language && (
                      <div className="dsb-detail-row">
                        <span className="dsb-detail-key">Sprache</span>
                        <span className="dsb-detail-val">{doc.language}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
