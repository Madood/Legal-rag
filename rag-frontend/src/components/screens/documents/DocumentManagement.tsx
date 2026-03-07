import { useState, useEffect, useRef } from 'react';
import {
  FileText, RefreshCw, CheckCircle, Clock,
  AlertCircle, Database, Loader2, Eye, Trash2, Upload,
} from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { useTranslation } from '../../../i18n';
import './DocumentManagement.css';

// ---------------------------------------------------------------------------
// Statute catalogue
// ---------------------------------------------------------------------------
interface StatuteDef {
  key: string;
  fullName: string;
  category: string;
}

const STATUTE_KEYS = ['BGB', 'StGB', 'HGB', 'ZPO', 'GG', 'GmbHG', 'AktG', 'InsO', 'StPO', 'ArbGG'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Country = 'DE' | 'PL' | 'NO';

interface StatuteIndexInfo {
  vectors: number;
  paragraphs?: number;
  ingested_at?: string;
}

interface IngestionStatus {
  indices_loaded: boolean;
  has_real_corpus: boolean;
  statute_indices: Record<string, StatuteIndexInfo>;
}

const PYTHON_BASE = 'http://localhost:8000/api';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DocumentManagement() {
  const [activeCountry, setActiveCountry]   = useState<Country>('DE');
  const [status, setStatus]                 = useState<IngestionStatus | null>(null);
  const [statusLoading, setStatusLoading]   = useState(true);
  const [statusError, setStatusError]       = useState<string | null>(null);
  const [uploading, setUploading]           = useState<Record<string, boolean>>({});
  const [uploadSuccess, setUploadSuccess]   = useState<Record<string, string>>({});
  const [selectedStatute, setSelectedStatute] = useState<string>('BGB');
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [pendingStatute, setPendingStatute] = useState<string | null>(null);
  const { t } = useTranslation();

  const GERMAN_STATUTES: StatuteDef[] = STATUTE_KEYS.map(key => ({
    key,
    fullName: t(`documents.statutes.${key}.name`),
    category: t(`documents.statutes.${key}.category`),
  }));

  // ── Status fetch ──────────────────────────────────────────────────────────
  const fetchStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res  = await fetch(`${PYTHON_BASE}/ingestion/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatusError(t('documents.serviceNotReachable'));
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  // ── Case-insensitive lookup ────────────────────────────────────────────────
  const lookupStatute = (key: string): StatuteIndexInfo | undefined => {
    if (!status?.statute_indices) return undefined;
    return (
      status.statute_indices[key] ??
      Object.entries(status.statute_indices).find(
        ([k]) => k.toLowerCase() === key.toLowerCase(),
      )?.[1]
    );
  };

  const getVectors    = (key: string): number           => lookupStatute(key)?.vectors ?? 0;
  const getParagraphs = (key: string): number | undefined => lookupStatute(key)?.paragraphs;
  const getIngestedAt = (key: string): string | undefined => lookupStatute(key)?.ingested_at;
  const isIndexed     = (key: string): boolean          => getVectors(key) > 0;

  const formatDate = (iso: string | undefined, short = false): string => {
    if (!iso) return '–';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('de-DE', short
        ? { day: '2-digit', month: '2-digit', year: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '–'; }
  };

  // ── Core upload logic ─────────────────────────────────────────────────────
  const handleFileUpload = async (statute: string, file: File) => {
    setUploading(prev => ({ ...prev, [statute]: true }));
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `${PYTHON_BASE}/ingestion/${statute}?force_reingest=true`,
        { method: 'POST', body: form },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail || `${t('documents.uploadFailed')} (${res.status})`);
      }
      setUploadSuccess(prev => ({
        ...prev,
        [statute]: new Date().toLocaleString('de-DE'),
      }));
      await fetchStatus();
    } catch (err: any) {
      alert(`${t('documents.uploadFailed')}: ${err.message}`);
    } finally {
      setUploading(prev => ({ ...prev, [statute]: false }));
    }
  };

  // File-input click path
  const triggerUpload = (statute: string) => {
    setPendingStatute(statute);
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingStatute) return;
    const statute = pendingStatute;
    e.target.value = '';
    setPendingStatute(null);
    await handleFileUpload(statute, file);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const indexedCount = statusLoading ? 0 : GERMAN_STATUTES.filter(s => isIndexed(s.key)).length;
  const plannedCount = statusLoading ? 0 : GERMAN_STATUTES.filter(s => !isIndexed(s.key)).length;
  const totalVectors = Object.values(status?.statute_indices ?? {})
    .reduce((sum, v) => sum + (v.vectors ?? 0), 0);
  const serviceOnline = !statusError && !statusLoading;

  const isGlobalBusy = uploading[selectedStatute];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="document-management">
      <div className="management-container">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="management-header">
          <div className="header-content">
            <h1 className="management-title">{t('documents.title')}</h1>
            <p className="management-subtitle">
              {t('documents.subtitle')}
            </p>
          </div>
          <Button className="upload-button" onClick={fetchStatus} disabled={statusLoading}>
            <RefreshCw className={`upload-icon${statusLoading ? ' animate-spin' : ''}`} />
            {t('documents.refresh')}
          </Button>
        </div>

        {/* ── Country selector ─────────────────────────────────────────────── */}
        <div className="country-selector">
          {([
            { code: 'DE' as Country, flag: '🇩🇪', label: t('documents.germany') },
            { code: 'PL' as Country, flag: '🇵🇱', label: t('documents.poland') },
            { code: 'NO' as Country, flag: '🇳🇴', label: t('documents.norway') },
          ] as const).map(({ code, flag, label }) => (
            <button
              key={code}
              className={`country-pill${activeCountry === code ? ' country-pill-active' : ''}`}
              onClick={() => setActiveCountry(code)}
            >
              <span className="country-flag">{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            GLOBAL UPLOAD ZONE — visible on every country tab
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="global-upload-section">
          {activeCountry === 'DE' ? (
            <>
              {/* Statute picker */}
              <div className="global-upload-header">
                <span className="global-upload-label">{t('documents.selectStatute')}</span>
                <div className="global-statute-pills">
                  {GERMAN_STATUTES.map(s => (
                    <button
                      key={s.key}
                      className={[
                        'global-statute-pill',
                        selectedStatute === s.key ? 'global-statute-pill-active' : '',
                        isIndexed(s.key) ? 'global-statute-pill-indexed' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedStatute(s.key)}
                      disabled={isGlobalBusy}
                      title={`${s.fullName}${isIndexed(s.key) ? ` · ${t('documents.alreadyIndexed')}` : ` · ${t('documents.notIndexed')}`}`}
                    >
                      {s.key}
                      {isIndexed(s.key) && <span className="global-pill-dot" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={[
                  'global-drop-zone',
                  globalDragOver ? 'global-drop-zone-over' : '',
                  isGlobalBusy   ? 'global-drop-zone-busy' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => !isGlobalBusy && triggerUpload(selectedStatute)}
                onDragOver={e => { e.preventDefault(); setGlobalDragOver(true); }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setGlobalDragOver(false);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setGlobalDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && !isGlobalBusy) handleFileUpload(selectedStatute, file);
                }}
                role="button"
                tabIndex={isGlobalBusy ? -1 : 0}
                onKeyDown={e =>
                  e.key === 'Enter' && !isGlobalBusy && triggerUpload(selectedStatute)
                }
                aria-label={`${t('documents.uploadFor')} ${selectedStatute}`}
              >
                {isGlobalBusy ? (
                  <>
                    <Loader2 className="global-drop-icon animate-spin" />
                    <span className="global-drop-title">{t('documents.indexing')}</span>
                    <span className="global-drop-sub">
                      {selectedStatute} &mdash; {t('documents.pleaseWait')}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="global-drop-icon-wrap">
                      <Upload className="global-drop-icon" />
                    </div>
                    <span className="global-drop-title">
                      {t('documents.dropHere')}{' '}
                      <span className="global-drop-link">{t('documents.clickToSelect')}</span>
                    </span>
                    <span className="global-drop-sub">
                      {selectedStatute} &mdash;{' '}
                      {GERMAN_STATUTES.find(s => s.key === selectedStatute)?.fullName}
                      {isIndexed(selectedStatute) ? ` · ${t('documents.alreadyIndexed')}` : ` · ${t('documents.firstIndex')}`}
                    </span>
                    <span className="global-drop-format">{t('documents.pdfOnly')}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            /* ── Poland / Norway — disabled coming-soon zone ── */
            <div className="global-drop-zone global-drop-zone-disabled">
              <span className="global-drop-flag">
                {activeCountry === 'PL' ? '🇵🇱' : '🇳🇴'}
              </span>
              <span className="global-drop-title">
                {activeCountry === 'PL' ? t('documents.poland') : t('documents.norway')}{' '}
                {t('documents.legalDocumentsLabel')}
              </span>
              <span className="global-drop-sub">
                {t('documents.uploadComingSoon')}
              </span>
              <Badge className="coming-soon-badge">{t('documents.comingSoon')}</Badge>
            </div>
          )}
        </div>

        {/* ── GERMANY — stats + statute cards ─────────────────────────────── */}
        {activeCountry === 'DE' && (
          <>
            {/* Stats row */}
            <div className="stats-grid">
              <Card className="stat-card">
                <div className="stat-card-content">
                  <div>
                    <p className="stat-label">{t('documents.indexedStatutes')}</p>
                    <p className="stat-value">{statusLoading ? '…' : indexedCount}</p>
                  </div>
                  <Database className="stat-icon stat-icon-blue" />
                </div>
              </Card>
              <Card className="stat-card">
                <div className="stat-card-content">
                  <div>
                    <p className="stat-label">{t('documents.totalVectors')}</p>
                    <p className="stat-value">
                      {statusLoading ? '…' : totalVectors.toLocaleString('de-DE')}
                    </p>
                  </div>
                  <FileText className="stat-icon stat-icon-green" />
                </div>
              </Card>
              <Card className="stat-card">
                <div className="stat-card-content">
                  <div>
                    <p className="stat-label">{t('documents.pending')}</p>
                    <p className="stat-value">{statusLoading ? '…' : plannedCount}</p>
                  </div>
                  <Clock className="stat-icon stat-icon-orange" />
                </div>
              </Card>
              <Card className="stat-card">
                <div className="stat-card-content">
                  <div>
                    <p className="stat-label">{t('documents.pythonService')}</p>
                    <p className="stat-value stat-value-sm">
                      {statusLoading ? '…' : serviceOnline ? t('status.online') : t('status.offline')}
                    </p>
                  </div>
                  <CheckCircle
                    className={`stat-icon ${statusError ? 'stat-icon-error' : 'stat-icon-green'}`}
                  />
                </div>
              </Card>
            </div>

            {/* Error banner */}
            {statusError && (
              <div className="status-error-banner">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {statusError}. {t('documents.startServiceWith')}{' '}
                  <code>uvicorn main:app --port 8000</code>.
                </span>
              </div>
            )}

            {/* Statute cards */}
            <div className="documents-grid">
              {GERMAN_STATUTES.map(statute => {
                const vectors    = getVectors(statute.key);
                const paragraphs = getParagraphs(statute.key);
                const ingestedAt = getIngestedAt(statute.key);
                const indexed    = vectors > 0;
                const isUp       = uploading[statute.key];
                const dateLabel  = uploadSuccess[statute.key] || formatDate(ingestedAt);

                const slug = statute.fullName
                  .replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae')
                  .replace(/Ü/g, 'Ue').replace(/Ö/g, 'Oe').replace(/Ä/g, 'Ae')
                  .replace(/ß/g, 'ss').replace(/[^a-zA-Z0-9]/g, '_')
                  .replace(/_+/g, '_').replace(/^_|_$/, '');
                const filename = `${statute.key}_${slug}.pdf`;

                const sizeKB  = Math.round(vectors * 0.5);
                const sizeStr = vectors === 0 ? '–'
                  : sizeKB < 1024 ? `~${sizeKB} KB`
                  : `~${(sizeKB / 1024).toFixed(1)} MB`;

                return (
                  <div key={statute.key} className="doc-card">
                    {/* Thumbnail */}
                    <div className={`doc-card-thumbnail${indexed ? ' doc-card-thumbnail-indexed' : ''}`}>
                      <FileText className="doc-card-icon" />
                    </div>

                    {/* Body */}
                    <div className="doc-card-body">
                      <div className="doc-card-meta">
                        <p className="doc-card-filename" title={filename}>{filename}</p>
                        <p className="doc-card-date">
                          {indexed ? dateLabel : t('documents.notIndexed')}
                        </p>
                      </div>

                      <div className="doc-card-badges">
                        <Badge className="badge-type">{t('documents.statute')}</Badge>
                        {indexed
                          ? <Badge className="badge-status-ok">{t('documents.indexed')}</Badge>
                          : <Badge className="badge-status-planned">{t('documents.planned')}</Badge>
                        }
                      </div>

                      <div className="doc-card-stats">
                        <div className="doc-stat-item">
                          <span className="doc-stat-value">
                            {statusLoading ? '…'
                              : indexed ? (paragraphs ?? vectors).toLocaleString('de-DE') : '–'}
                          </span>
                          <span className="doc-stat-label">{t('documents.paragraphs')}</span>
                        </div>
                        <div className="doc-stat-item">
                          <span className="doc-stat-value">
                            {statusLoading ? '…'
                              : indexed ? vectors.toLocaleString('de-DE') : '–'}
                          </span>
                          <span className="doc-stat-label">{t('documents.chunks')}</span>
                        </div>
                        <div className="doc-stat-item">
                          <span className="doc-stat-value">
                            {indexed ? formatDate(ingestedAt, true) : '–'}
                          </span>
                          <span className="doc-stat-label">{t('documents.time')}</span>
                        </div>
                      </div>

                      <p className="doc-card-size">{t('documents.size')}: {sizeStr}</p>

                      {/* Actions — indexed only */}
                      {indexed && (
                        <div className="doc-card-actions">
                          <button
                            className="doc-card-open"
                            onClick={() => triggerUpload(statute.key)}
                            disabled={isUp}
                            title={t('documents.alreadyIndexed')}
                          >
                            {isUp
                              ? <Loader2 className="doc-card-btn-icon animate-spin" />
                              : <Eye className="doc-card-btn-icon" />}
                            {t('documents.open')}
                          </button>
                          <button className="doc-card-delete" disabled title="Löschen (demnächst)">
                            <Trash2 className="doc-card-btn-icon" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}

      </div>
    </div>
  );
}
