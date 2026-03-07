import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useTranslation } from '../../../i18n';
import type { Lang } from '../../../i18n';

const LANGS: { code: Lang; flag: string; label: string; short: string }[] = [
  { code: 'en', flag: '🇬🇧', label: 'English', short: 'EN' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch', short: 'DE' },
  { code: 'pl', flag: '🇵🇱', label: 'Polski', short: 'PL' },
  { code: 'no', flag: '🇳🇴', label: 'Norsk', short: 'NO' },
];

export function LanguageSelector() {
  const { lang, changeLang } = useTranslation();
  const active = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="lang-selector-trigger"
          aria-label="Select language"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid var(--border, #e2e8f0)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: 'inherit',
          }}
        >
          <span>{active.flag}</span>
          <span>{active.short}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="user-menu-content">
        {LANGS.map(({ code, flag, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => changeLang(code)}
            className="menu-item"
            style={lang === code ? { color: 'hsl(221, 83%, 53%)', fontWeight: 600 } : {}}
          >
            <span style={{ marginRight: '8px' }}>{flag}</span>
            <span>{label}</span>
            {lang === code && <span style={{ marginLeft: 'auto' }}>✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
