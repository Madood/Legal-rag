import { useState, useEffect, useRef } from 'react';
import {
  FileText, RefreshCw, CheckCircle, Clock,
  AlertCircle, Database, Loader2, Upload, Zap,
} from 'lucide-react';
import { useTranslation } from '../../../i18n';
import './DocumentManagement.css';

interface StatuteDef {
  key: string;
  fullName: string;
  category: string;
}

const STATUTE_KEYS = ['BGB', 'StGB', 'HGB', 'ZPO', 'GG', 'GmbHG', 'AktG', 'InsO', 'StPO', 'ArbGG'];

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

export function DocumentManagement() {
  const [activeCountry, setActiveCountry]     = useState<Country>('DE');
  const [status, setStatus]                   = useState<IngestionStatus | null>(null);
  const [statusLoading, setStatusLoading]     = useState(true);
  const [statusError, setStatusError]         = useState<string | null>(null);
  const [uploading, setUploading]             = useState<Record<string, boolean>>({});
  const [uploadSuccess, setUploadSuccess]     = useState<Record<string, string>>({});
  const [selectedStatute, setSelectedStatute] = useState<string>('BGB');
  const [globalDragOver, setGlobalDragOver]   = useState(false);
  const fileInputRef                          = useRef<HTMLInputElement>(null);
  const [pendingStatute, setPendingStatute]   = useState<string | null>(null);
  const { t } = useTranslation();

  const GERMAN_STATUTES: StatuteDef[] = STATUTE_KEYS.map(key => ({
    key,
    fullName: t(`documents.statutes.${key}.name`),
    category: t(`documents.statutes.${key}.category`),
  }));

  const COUNTRIES = [
    { code: 'DE' as Country, flag: '🇩🇪', label: t('documents.germany') },
    { code: 'PL' as Country, flag: '🇵🇱', label: t('documents.poland')  },
    { code: 'NO' as Country, flag: '🇳🇴', label: t('documents.norway')  },
  ];

  const fetchStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`${PYTHON_BASE}/ingestion/status`);
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

  const lookupStatute = (key: string): StatuteIndexInfo | undefined => {
    if (!status?.statute_indices) return undefined;
    return (
      status.statute_indices[key] ??
      Object.entries(status.statute_indices).find(
        ([k]) => k.toLowerCase() === key.toLowerCase(),
      )?.[1]
    );
  };

  const getVectors    = (key: string): number             => lookupStatute(key)?.vectors ?? 0;
  const getParagraphs = (key: string): number | undefined => lookupStatute(key)?.paragraphs;
  const getIngestedAt = (key: string): string | undefined => lookupStatute(key)?.ingested_at;
  const isIndexed     = (key: string): boolean            => getVectors(key) > 0;

  const formatDate = (iso: string | undefined): string => {
    if (!iso) return '–';
    try {
      return new Date(iso).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: '2-digit',
      });
    } catch { return '–'; }
  };

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

  const indexedCount  = statusLoading ? 0 : GERMAN_STATUTES.filter(s => isIndexed(s.key)).length;
  const plannedCount  = statusLoading ? 0 : GERMAN_STATUTES.filter(s => !isIndexed(s.key)).length;
  const totalVectors  = Object.values(status?.statute_indices ?? {})
    .reduce((sum, v) => sum + (v.vectors ?? 0), 0);
  const serviceOnline = !statusError && !statusLoading;
  const isGlobalBusy  = uploading[selectedStatute];
  const anyUploading  = Object.values(uploading).some(Boolean);

  return (
    <div className="dm-page">
      <div className="dm-container">

        {/* ── Page header ── */}
        <div className="dm-header">
          <div>
            <h1 className="dm-title">{t('documents.title')}</h1>
            <p className="dm-subtitle">{t('documents.subtitle')}</p>
          </div>
          <button className="dm-refresh-btn" onClick={fetchStatus} disabled={statusLoading}>
            <RefreshCw size={14} className={statusLoading ? 'dm-spin' : ''} />
            {t('documents.refresh')}
          </button>
        </div>

        {/* ── Stat cards ── */}
        <div className="dm-stats">
          <div className="dm-stat">
            <div className="dm-stat-icon dm-stat-icon-blue">
              <Database size={18} />
            </div>
            <div>
              <p className="dm-stat-val">{statusLoading ? '…' : indexedCount}</p>
              <p className="dm-stat-label">{t('documents.indexedStatutes')}</p>
            </div>
          </div>

          <div className="dm-stat">
            <div className="dm-stat-icon dm-stat-icon-green">
              <Zap size={18} />
            </div>
            <div>
              <p className="dm-stat-val">
                {statusLoading ? '…' : totalVectors.toLocaleString('de-DE')}
              </p>
              <p className="dm-stat-label">{t('documents.totalVectors')}</p>
            </div>
          </div>

          <div className="dm-stat">
            <div className="dm-stat-icon dm-stat-icon-amber">
              <Clock size={18} />
            </div>
            <div>
              <p className="dm-stat-val">{statusLoading ? '…' : plannedCount}</p>
              <p className="dm-stat-label">{t('documents.pending')}</p>
            </div>
          </div>

          <div className="dm-stat">
            <div className={`dm-stat-icon${serviceOnline ? ' dm-stat-icon-green' : ' dm-stat-icon-red'}`}>
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="dm-stat-val dm-stat-val-sm">
                {statusLoading
                  ? '…'
                  : serviceOnline ? t('status.online') : t('status.offline')}
              </p>
              <p className="dm-stat-label">{t('documents.pythonService')}</p>
            </div>
          </div>
        </div>

        {/* ── Error banner ── */}
        {statusError && (
          <div className="dm-error">
            <AlertCircle size={14} className="dm-error-icon" />
            <span>
              {statusError}. {t('documents.startServiceWith')}{' '}
              <code>uvicorn main:app --port 8000</code>.
            </span>
          </div>
        )}

        {/* ── Country tabs ── */}
        <div className="dm-tabs">
          {COUNTRIES.map(({ code, flag, label }) => (
            <button
              key={code}
              className={`dm-tab${activeCountry === code ? ' dm-tab-active' : ''}`}
              onClick={() => setActiveCountry(code)}
            >
              <span>{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Germany content ── */}
        {activeCountry === 'DE' && (
          <>
            {/* Upload section: statute pills + drop zone */}
            <div className="dm-upload-section">
              <div className="dm-statute-row">
                <span className="dm-statute-label">{t('documents.selectStatute')}</span>
                <div className="dm-pills">
                  {GERMAN_STATUTES.map(s => (
                    <button
                      key={s.key}
                      className={[
                        'dm-pill',
                        selectedStatute === s.key ? 'dm-pill-active'  : '',
                        isIndexed(s.key)          ? 'dm-pill-indexed' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedStatute(s.key)}
                      disabled={isGlobalBusy}
                      title={`${s.fullName}${isIndexed(s.key) ? ' · Indexiert' : ' · Nicht indexiert'}`}
                    >
                      {s.key}
                      {isIndexed(s.key) && <span className="dm-pill-dot" />}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={[
                  'dm-drop-zone',
                  globalDragOver ? 'dm-drop-zone-over' : '',
                  isGlobalBusy   ? 'dm-drop-zone-busy' : '',
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
                    <Loader2 size={22} className="dm-drop-spin" />
                    <span className="dm-drop-title">{t('documents.indexing')}</span>
                    <span className="dm-drop-sub">
                      {selectedStatute} — {t('documents.pleaseWait')}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="dm-drop-icon-wrap">
                      <Upload size={18} className="dm-drop-icon" />
                    </div>
                    <span className="dm-drop-title">
                      {t('documents.dropHere')}{' '}
                      <span className="dm-drop-link">{t('documents.clickToSelect')}</span>
                    </span>
                    <span className="dm-drop-sub">
                      {selectedStatute} —{' '}
                      {GERMAN_STATUTES.find(s => s.key === selectedStatute)?.fullName}
                      {isIndexed(selectedStatute) ? ' · Neu indexieren' : ' · Erste Indexierung'}
                    </span>
                    <span className="dm-drop-hint">PDF, max. 50 MB</span>
                  </>
                )}
              </div>
            </div>

            {/* Document list table */}
            <div className="dm-table-wrap">
              <table className="dm-table">
                <thead>
                  <tr>
                    <th className="dm-th">Dokument</th>
                    <th className="dm-th dm-th-num">Chunks</th>
                    <th className="dm-th dm-th-num">Vektoren</th>
                    <th className="dm-th dm-th-num">Datum</th>
                    <th className="dm-th">Status</th>
                    <th className="dm-th dm-th-action">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {statusLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="dm-tr">
                          <td className="dm-td">
                            <div className="dm-skeleton dm-sk-wide" />
                          </td>
                          <td className="dm-td dm-td-num">
                            <div className="dm-skeleton dm-sk-sm" />
                          </td>
                          <td className="dm-td dm-td-num">
                            <div className="dm-skeleton dm-sk-sm" />
                          </td>
                          <td className="dm-td dm-td-num">
                            <div className="dm-skeleton dm-sk-sm" />
                          </td>
                          <td className="dm-td">
                            <div className="dm-skeleton dm-sk-badge" />
                          </td>
                          <td className="dm-td dm-td-action">
                            <div className="dm-skeleton dm-sk-btn" />
                          </td>
                        </tr>
                      ))
                    : GERMAN_STATUTES.map(s => {
                        const vectors    = getVectors(s.key);
                        const paragraphs = getParagraphs(s.key);
                        const ingestedAt = getIngestedAt(s.key);
                        const indexed    = vectors > 0;
                        const isUp       = uploading[s.key];

                        return (
                          <tr key={s.key} className={`dm-tr${indexed ? '' : ' dm-tr-dim'}`}>
                            <td className="dm-td">
                              <div className="dm-doc-cell">
                                <div className={`dm-doc-icon-wrap${indexed ? ' dm-doc-icon-wrap-ok' : ''}`}>
                                  <FileText size={12} />
                                </div>
                                <div className="dm-doc-text">
                                  <span className="dm-doc-key">{s.key}</span>
                                  <span className="dm-doc-name">{s.fullName}</span>
                                </div>
                              </div>
                            </td>
                            <td className="dm-td dm-td-num">
                              {indexed
                                ? (paragraphs ?? vectors).toLocaleString('de-DE')
                                : '–'}
                            </td>
                            <td className="dm-td dm-td-num">
                              {indexed ? vectors.toLocaleString('de-DE') : '–'}
                            </td>
                            <td className="dm-td dm-td-num dm-td-date">
                              {indexed
                                ? (uploadSuccess[s.key]
                                    ? uploadSuccess[s.key].split(',')[0]
                                    : formatDate(ingestedAt))
                                : '–'}
                            </td>
                            <td className="dm-td">
                              {indexed
                                ? <span className="dm-badge dm-badge-ok">Indexiert</span>
                                : <span className="dm-badge dm-badge-pending">Ausstehend</span>
                              }
                            </td>
                            <td className="dm-td dm-td-action">
                              <button
                                className={indexed ? 'dm-action-reingest' : 'dm-action-upload'}
                                onClick={() => triggerUpload(s.key)}
                                disabled={isUp || anyUploading}
                                title={indexed ? 'Neu indexieren' : 'PDF hochladen'}
                              >
                                {isUp
                                  ? <Loader2 size={11} className="dm-spin" />
                                  : <Upload size={11} />
                                }
                                {isUp ? 'Lädt…' : indexed ? 'Neu' : 'Upload'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}

        {/* ── Poland / Norway coming soon ── */}
        {activeCountry !== 'DE' && (
          <div className="dm-coming-soon">
            <span className="dm-coming-flag">
              {activeCountry === 'PL' ? '🇵🇱' : '🇳🇴'}
            </span>
            <p className="dm-coming-title">
              {activeCountry === 'PL' ? t('documents.poland') : t('documents.norway')} —{' '}
              {t('documents.legalDocumentsLabel')}
            </p>
            <p className="dm-coming-sub">{t('documents.uploadComingSoon')}</p>
            <span className="dm-coming-badge">{t('documents.comingSoon')}</span>
          </div>
        )}

      </div>
    </div>
  );
}
