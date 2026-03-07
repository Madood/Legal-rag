import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, FileText, BarChart3, Settings, Moon, Sun, User, LogOut, UserCircle, LogIn } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { useTranslation } from '../../../i18n';
import { LanguageSelector } from './LanguageSelector';
import { TokenCounter } from '../../TokenCounter';
import { useAuth } from '../../../context/AuthContext';
import './Header.css';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ darkMode, onToggleDarkMode }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const isGuest = user?.isGuest ?? false;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/chat', label: t('nav.chat'), icon: MessageSquare },
    { path: '/documents', label: t('nav.documents'), icon: FileText },
    { path: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
  ];

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-logo">
        <div className="logo-icon">
          <span className="logo-text">LR</span>
        </div>
        <div>
          <h1 className="logo-title">LegalRAG</h1>
          <p className="logo-subtitle">{t('nav.logoSubtitle')}</p>
        </div>
        {isGuest && (
          <div className="guest-badge">
            <span className="guest-text">{t('nav.guestMode')}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="header-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}
            >
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="header-actions">
        <TokenCounter />
        <LanguageSelector />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="theme-toggle"
        >
          {darkMode ? <Sun className="theme-icon" /> : <Moon className="theme-icon" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="user-menu-trigger">
              <div className="user-avatar">
                <User className="user-avatar-icon" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="user-menu-content">
            <DropdownMenuLabel className="user-menu-label">
              <div className="user-info">
                {isGuest ? (
                  <>
                    <p className="user-name">{t('nav.guestUser')}</p>
                    <p className="user-email">{t('nav.limitedAccess')}</p>
                  </>
                ) : (
                  <>
                    <p className="user-name">{user?.username || 'User'}</p>
                    <p className="user-email">{user?.email || ''}</p>
                  </>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isGuest ? (
              <DropdownMenuItem onClick={() => navigate('/login')} className="menu-item">
                <LogIn className="menu-icon" />
                <span>{t('nav.loginForFullFeatures')}</span>
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => navigate('/profile')} className="menu-item">
                  <UserCircle className="menu-icon" />
                  <span>{t('nav.myProfile')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="menu-item">
                  <Settings className="menu-icon" />
                  <span>{t('nav.settings')}</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="logout-item"
            >
              <LogOut className="menu-icon" />
              <span>{isGuest ? t('nav.endGuestMode') : t('nav.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}