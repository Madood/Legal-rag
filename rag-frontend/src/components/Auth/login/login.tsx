import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import './login.css';

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
      setError(err?.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestAccess = async () => {
    try {
      await continueAsGuest();
      navigate('/chat');
    } catch {
      setError('Could not start guest session. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-section">
        <div className="login-form-wrapper">
          <Link to="/" className="logo-link">
            <div className="logo-icon">
              <span className="logo-text">LR</span>
            </div>
            <span className="logo-title">LegalRAG</span>
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
              <a href="#" className="forgot-password">Passwort vergessen?</a>
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

      <div className="login-hero-section">
        <div className="hero-content">
          <Scale className="hero-icon" />
          <h2 className="hero-title">KI-gestützte Rechtsrecherche</h2>
          <p className="hero-subtitle">Präzise Antworten mit zitierten Quellen in Sekunden</p>
        </div>
      </div>
    </div>
  );
}
