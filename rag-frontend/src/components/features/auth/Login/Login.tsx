import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const { login, continueAsGuest } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 503) {
        setError('Datenbankverbindung nicht verfügbar. Als Gast fortfahren?');
      } else if (!status) {
        setError('Server nicht erreichbar. Bitte prüfen Sie Ihre Verbindung.');
      } else {
        setError(err?.response?.data?.error || 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestAccess = async () => {
    try {
      await continueAsGuest();
      navigate('/chat');
    } catch {
      // continueAsGuest now has its own offline fallback — this should not trigger
      setError('Gast-Zugang nicht verfügbar. Bitte versuchen Sie es später erneut.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-section">
        <div className="login-form-wrapper" style={{ paddingTop: '40px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'translateX(-4px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
            aria-label="Zurück zur Startseite"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>

          <Link to="/" className="logo-link">
            <div className="logo-icon">
              <span className="logo-text">J</span>
            </div>
            <span className="logo-title">Jurisma AI</span>
          </Link>

          <div className="welcome-section">
            <h1 className="welcome-title">Willkommen zurück</h1>
            <p className="welcome-subtitle">Melden Sie sich an, um fortzufahren</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">E-Mail-Adresse</label>
              <input
                id="email"
                type="email"
                placeholder="ihre.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Passwort</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ihr Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                >
                  {showPassword ? <EyeOff className="icon-sm" /> : <Eye className="icon-sm" />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" className="checkbox" />
                Angemeldet bleiben
              </label>
              <Link to="/forgot-password" className="forgot-password">Passwort vergessen?</Link>
            </div>

            <button type="submit" disabled={isSubmitting} className="login-button">
              {isSubmitting ? 'Anmelden...' : 'Anmelden'}
            </button>

            <div className="separator">
              <div className="separator-line"></div>
              <div className="separator-text"><span>Oder</span></div>
            </div>

            <button type="button" onClick={handleGuestAccess} className="guest-button">
              Als Gast fortfahren
            </button>
          </form>

          <p className="signup-link">
            Noch kein Konto?{' '}
            <Link to="/signup" className="signup-text">Registrieren Sie sich</Link>
          </p>
        </div>
      </div>

      <div className="login-hero-section" style={{ position: 'relative', overflow: 'hidden', height: '100vh' }}>
        <div style={{
          position: 'absolute',
          inset: '0 0 0 0',
          backgroundImage: `linear-gradient(rgba(52,152,219,0.72), rgba(52,152,219,0.72)), url('/BERLINER.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div className="hero-content" style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 48px',
        }}>
          <Scale className="hero-icon" />
          <h2 className="hero-title">KI-gestützte Rechtsrecherche</h2>
          <p className="hero-subtitle">Präzise Antworten mit zitierten Quellen in Sekunden</p>
        </div>
      </div>
    </div>
  );
}
