import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, Eye, EyeOff } from 'lucide-react';
import './login.css';

interface FormData {
  email: string;
  password: string;
}

export function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'authenticated');
    navigate('/chat');
  };

  const handleGuestAccess = () => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'guest');
    navigate('/chat');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  return (
    <div className="login-container">
      {/* Left Side - Form */}
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
            <p className="welcome-subtitle">
              Melden Sie sich an, um fortzufahren
            </p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                placeholder="ihre.email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Passwort
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ihr Passwort"
                  value={formData.password}
                  onChange={handleInputChange}
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
              <a href="#" className="forgot-password">
                Passwort vergessen?
              </a>
            </div>

            <button
              type="submit"
              className="login-button"
            >
              Anmelden
            </button>

            <div className="separator">
              <div className="separator-line"></div>
              <div className="separator-text">
                <span>Oder</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGuestAccess}
              className="guest-button"
            >
              Als Gast fortfahren
            </button>
          </form>

          <p className="signup-link">
            Noch kein Konto?{' '}
            <Link to="/signup" className="signup-text">
              Registrieren Sie sich
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="login-hero-section">
        <div className="hero-content">
          <Scale className="hero-icon" />
          <h2 className="hero-title">KI-gestützte Rechtsrecherche</h2>
          <p className="hero-subtitle">
            Präzise Antworten mit zitierten Quellen in Sekunden
          </p>
        </div>
      </div>
    </div>
  );
}