import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../../i18n';
import type { Lang } from '../../../i18n';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'pl', label: 'Polski',    flag: '🇵🇱' },
  { code: 'ar', label: 'العربية',  flag: '🇸🇦' },
  { code: 'no', label: 'Norsk',     flag: '🇳🇴' },
];

export function LanguageSelector() {
  const { lang, changeLang } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const active = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '13px',
          fontWeight: 500,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)';
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{active.flag}</span>
        <span style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '12px' }}>
          {active.code}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            opacity: 0.5,
          }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Language"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '180px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(15,23,42,0.97)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            padding: '8px 0',
            zIndex: 100,
          }}
        >
          {/* Section header */}
          <p
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '0 14px 8px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              margin: '0 0 4px',
            }}
          >
            Language
          </p>

          {/* Items */}
          {LANGS.map(({ code, label, flag }) => {
            const isActive = lang === code;
            return (
              <button
                key={code}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  changeLang(code);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: 'calc(100% - 8px)',
                  margin: '0 4px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: '13px',
                  textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = 'rgba(255,255,255,0.06)';
                  if (!isActive) btn.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = 'transparent';
                  if (!isActive) btn.style.color = 'rgba(255,255,255,0.45)';
                }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1, width: '20px', flexShrink: 0 }}>
                  {flag}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7L5.5 10L11.5 4"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
