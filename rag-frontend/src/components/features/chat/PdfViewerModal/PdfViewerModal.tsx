import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Minus, Plus, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfViewerModal.css';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export interface PdfViewerSource {
  statute?: string;
  paragraph?: string;
  filename?: string;
  documentName?: string;
  page?: number;
  excerpt?: string;
}

interface PdfViewerModalProps {
  source: PdfViewerSource;
  onClose: () => void;
}

type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

function getApiBase(): string {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return 'http://localhost:5000/api';
  }
  return '/api';
}

const API_BASE = getApiBase();
const FOUND_PAGE_CACHE: Record<string, number> = {};

function cleanParagraph(paragraph?: string): string {
  return String(paragraph || '').replace(/^§\s*/, '').trim();
}

function buildPdfUrl(source: PdfViewerSource): string {
  const statute = (source.statute || '').toUpperCase();
  const fileOrStatute = source.filename || source.documentName || (statute ? `${statute}.pdf` : '');
  return `${API_BASE}/documents/pdf/${encodeURIComponent(fileOrStatute)}`;
}

function getPdfLabel(source: PdfViewerSource): string {
  const statute = (source.statute || '').toUpperCase();
  return source.filename || source.documentName || (statute ? `${statute}.pdf` : 'document.pdf');
}

function getTextItemString(item: unknown): string {
  if (item && typeof item === 'object' && 'str' in item) {
    return String((item as { str?: unknown }).str || '');
  }
  return '';
}

function hasParagraphHeading(pageText: string, paragraph: string): boolean {
  const escaped = paragraph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`§\\s*${escaped}\\s+[A-ZÄÖÜ]`);
  return heading.test(pageText);
}

export function PdfViewerModal({ source, onClose }: PdfViewerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PdfDocument | null>(null);
  const pageCache = useRef<Record<string, number>>(FOUND_PAGE_CACHE);
  const [status, setStatus] = useState('Loading PDF...');
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.35);
  const scaleRef = useRef(1.35);
  const [foundPage, setFoundPage] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const statute = (source.statute || '').toUpperCase();
  const paragraph = cleanParagraph(source.paragraph);
  const filename = getPdfLabel(source);
  const pdfUrl = useMemo(() => buildPdfUrl(source), [source]);
  const cacheKey = `${statute || filename}_${paragraph}`;

  const findParagraphPage = useCallback(async (pdf: PdfDocument): Promise<number> => {
    if (!paragraph) return source.page && source.page > 0 ? source.page : 1;

    if (pageCache.current[cacheKey]) {
      const cached = pageCache.current[cacheKey];
      setStatus(`Found § ${paragraph} on page ${cached}`);
      return cached;
    }

    const terms = [`§ ${paragraph}`, `§${paragraph}`, `§ ${paragraph} `];
    setIsSearching(true);
    setStatus(`Searching for § ${paragraph}...`);

    let firstOccurrence: number | null = null;

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(getTextItemString).join(' ');

      if (!firstOccurrence && terms.some(term => pageText.includes(term))) {
        firstOccurrence = i;
      }

      if (terms.some(term => pageText.includes(term)) && hasParagraphHeading(pageText, paragraph)) {
        pageCache.current[cacheKey] = i;
        setStatus(`Found § ${paragraph} on page ${i}`);
        setIsSearching(false);
        return i;
      }

      if (i % 20 === 0) {
        setStatus(`Searching... (${i}/${pdf.numPages})`);
      }
    }

    const fallbackPage = firstOccurrence || 1;
    pageCache.current[cacheKey] = fallbackPage;
    setStatus(
      firstOccurrence
        ? `Found § ${paragraph} reference on page ${fallbackPage}`
        : `§ ${paragraph} not found, showing page 1`
    );
    setIsSearching(false);
    return fallbackPage;
  }, [cacheKey, paragraph, source.page]);

  const renderPage = useCallback(async (pdf: PdfDocument, num: number, nextScale: number) => {
    if (!canvasRef.current) return;

    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale: nextScale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    setPageNum(num);
    setStatus(`Page ${num} of ${pdf.numPages}`);
  }, []);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const loadAndSearch = async () => {
      try {
        setError(false);
        setFoundPage(null);
        setTotalPages(0);
        setStatus('Loading PDF...');

        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        if (cancelled) return;

        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);

        const targetPage = await findParagraphPage(pdf);
        if (cancelled) return;

        setFoundPage(targetPage);
        await renderPage(pdf, targetPage, scaleRef.current);
      } catch (err) {
        if (!cancelled) {
          setError(true);
          setIsSearching(false);
          setStatus('Error loading PDF');
          console.error('[PDF]', err);
        }
      }
    };

    loadAndSearch();

    return () => {
      cancelled = true;
      setIsSearching(false);
    };
  }, [findParagraphPage, pdfUrl, renderPage]);

  useEffect(() => {
    if (!pdfRef.current) return;
    renderPage(pdfRef.current, pageNum, scale).catch(err => {
      setStatus('Error rendering page');
      console.error('[PDF]', err);
    });
  }, [pageNum, renderPage, scale]);

  const goToPage = async (num: number) => {
    if (!pdfRef.current || totalPages < 1) return;
    const clamped = Math.max(1, Math.min(num, totalPages));
    await renderPage(pdfRef.current, clamped, scaleRef.current);
  };

  const zoomIn = () => setScale(value => Math.min(value + 0.25, 3));
  const zoomOut = () => setScale(value => Math.max(value - 0.25, 0.75));

  return (
    <div className="pvm-overlay" onClick={onClose}>
      <div className="pvm-modal" onClick={event => event.stopPropagation()}>
        <div className="pvm-header">
          <div className="pvm-title-row">
            <FileText size={15} className="pvm-icon" />
            <span className="pvm-statute">
              {paragraph ? `§ ${paragraph} ${statute}` : statute}
            </span>
            <span className="pvm-filename">{filename}</span>
            {foundPage && (
              <span className="pvm-found-badge">Found on page {foundPage}</span>
            )}
          </div>

          <div className="pvm-status-wrap">
            {isSearching && (
              <div className="pvm-progress" aria-hidden="true">
                <div className="pvm-progress-bar" />
              </div>
            )}
            <span className="pvm-status">{status}</span>
          </div>

          <div className="pvm-header-actions">
            <button
              className="pvm-icon-button"
              onClick={() => goToPage(pageNum - 1)}
              disabled={pageNum <= 1 || totalPages < 1}
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="pvm-icon-button"
              onClick={() => goToPage(pageNum + 1)}
              disabled={pageNum >= totalPages || totalPages < 1}
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button className="pvm-icon-button" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
              <Minus size={15} />
            </button>
            <button className="pvm-icon-button" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
              <Plus size={15} />
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pvm-icon-button pvm-open-tab"
              title="Open PDF in new tab"
              aria-label="Open PDF in new tab"
              onClick={event => event.stopPropagation()}
            >
              <ExternalLink size={15} />
            </a>
            <button className="pvm-icon-button" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {source.excerpt && (
          <div className="pvm-excerpt">
            <p className="pvm-excerpt-text">{source.excerpt}</p>
          </div>
        )}

        <div className="pvm-canvas-wrap">
          {error ? (
            <div className="pvm-fallback">
              <p className="pvm-fallback-title">PDF not available</p>
              <p className="pvm-fallback-hint">
                The document could not be loaded from the backend.
              </p>
              {source.excerpt && (
                <div className="pvm-fallback-excerpt">
                  <p className="pvm-fallback-label">
                    {paragraph ? `§ ${paragraph} ${statute}` : statute}
                  </p>
                  <p className="pvm-fallback-text">{source.excerpt}</p>
                </div>
              )}
            </div>
          ) : (
            <canvas ref={canvasRef} className="pvm-canvas" />
          )}
        </div>
      </div>
    </div>
  );
}
