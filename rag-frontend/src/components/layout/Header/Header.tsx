import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Scale, MessageSquare, FileText, BarChart3,
  Moon, Sun, Zap, LogOut, LogIn, UserCircle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { AuthUser } from '../../../context/AuthContext';
import { useTranslation } from '../../../i18n';
import { LanguageSelector } from './LanguageSelector';
import './Header.css';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

/* ── Inline user-menu dropdown ── */
function UserMenu({ user, darkMode }: { user: AuthUser | null; darkMode: boolean }) {
  const [open, setOpen]       = useState(false);
  const wrapRef               = useRef<HTMLDivElement>(null);
  const navigate              = useNavigate();
  const { logout }            = useAuth();
  const { t }                 = useTranslation();
  const isGuest               = user?.isGuest ?? true;
  const displayName           = isGuest ? t('nav.guestUser') : (user?.username || 'Nutzer');
  const displaySub            = isGuest ? t('nav.limitedAccess') : (user?.email || '');
  const avatarLetter          = displayName.charAt(0).toUpperCase();
  const tierLabel             = !isGuest ? (user?.tier === 'business' ? 'Business' : 'Pro') : null;

  /* Click-outside closes dropdown */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="um-wrap" ref={wrapRef}>
      {/* Trigger button */}
      <button
        className={`um-trigger${open ? ' um-trigger-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Benutzermenü"
        aria-expanded={open}
      >
        <span className="um-trigger-letter">{avatarLetter}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="um-panel">

          {/* Section 1 — user info */}
          <div className="um-info">
            <div className="um-avatar">{avatarLetter}</div>
            <div className="um-info-text">
              <div className="um-name-row">
                <span className="um-name">{displayName}</span>
                {tierLabel && <span className="um-tier">{tierLabel}</span>}
              </div>
              <span className="um-sub">{displaySub}</span>
            </div>
          </div>

          <div className="um-divider" />

          {/* Section 2 — actions */}
          <div className="um-section">
            {isGuest ? (
              <button className="um-item" onClick={() => handleNavigate('/login')}>
                <LogIn size={14} className="um-item-icon um-item-icon-blue" />
                <span>{t('nav.loginForFullFeatures')}</span>
              </button>
            ) : (
              <button className="um-item" onClick={() => handleNavigate('/profile')}>
                <UserCircle size={14} className="um-item-icon um-item-icon-blue" />
                <span>{t('nav.myProfile')}</span>
              </button>
            )}
          </div>

          <div className="um-divider" />

          {/* Section 3 — logout */}
          <div className="um-section um-section-last">
            <button className="um-item um-item-danger" onClick={handleLogout}>
              <LogOut size={14} className="um-item-icon" />
              <span>{isGuest ? t('nav.endGuestMode') : t('nav.logout')}</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

/* ── Header ── */
export function Header({ darkMode, onToggleDarkMode }: HeaderProps) {
  const location     = useLocation();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const { t }        = useTranslation();
  const tokenBalance = user?.tokens?.balance ?? 0;
  const isLow        = tokenBalance <= 5;

  const navItems = [
    { path: '/chat',      label: t('nav.chat'),      Icon: MessageSquare },
    { path: '/documents', label: t('nav.documents'), Icon: FileText      },
    { path: '/analytics', label: t('nav.analytics'), Icon: BarChart3     },
  ];

  return (
    <header className="hdr">
      {/* Left — brand */}
      <div className="hdr-left">
        <Link to="/chat" className="hdr-brand">
          <Scale size={17} className="hdr-brand-icon" />
          <span className="hdr-brand-name">Jurisma AI</span>
        </Link>
        {user?.isGuest && <span className="hdr-guest-pill">{t('nav.guestMode')}</span>}
      </div>

      {/* Center — nav tabs */}
      <nav className="hdr-nav">
        {navItems.map(({ path, label, Icon }) => (
          <Link
            key={path}
            to={path}
            className={`hdr-tab${location.pathname === path ? ' hdr-tab-active' : ''}`}
          >
            <Icon size={13} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Right — token + lang + theme + user */}
      <div className="hdr-right">
        {user && (
          <button
            className={`hdr-tokens${isLow ? ' hdr-tokens-low' : ''}`}
            onClick={() => navigate('/pricing')}
            title={`${tokenBalance} Tokens`}
          >
            <Zap size={12} />
            {tokenBalance} Tokens
          </button>
        )}

        <LanguageSelector />

        <button
          className="hdr-icon-btn"
          onClick={onToggleDarkMode}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <UserMenu user={user} darkMode={darkMode} />
      </div>
    </header>
  );
}
