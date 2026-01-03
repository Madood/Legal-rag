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
import { useEffect, useState } from 'react';
import './Header.css';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ darkMode, onToggleDarkMode }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const userType = localStorage.getItem('userType');
    setIsGuest(userType === 'guest');
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userType');
    navigate('/');
  };

  const navItems = [
    { path: '/chat', label: 'Chat', icon: MessageSquare },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
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
          <p className="logo-subtitle">Rechtsdokument Analyse</p>
        </div>
        {isGuest && (
          <div className="guest-badge">
            <span className="guest-text">Gast-Modus</span>
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
                    <p className="user-name">Gast-Benutzer</p>
                    <p className="user-email">Eingeschränkter Zugriff</p>
                  </>
                ) : (
                  <>
                    <p className="user-name">Dr. Schmidt</p>
                    <p className="user-email">m.schmidt@legal.de</p>
                  </>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isGuest ? (
              <DropdownMenuItem onClick={() => navigate('/login')} className="menu-item">
                <LogIn className="menu-icon" />
                <span>Anmelden für volle Features</span>
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => navigate('/profile')} className="menu-item">
                  <UserCircle className="menu-icon" />
                  <span>Mein Profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="menu-item">
                  <Settings className="menu-icon" />
                  <span>Einstellungen</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="logout-item"
            >
              <LogOut className="menu-icon" />
              <span>{isGuest ? 'Gast-Modus beenden' : 'Abmelden'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}