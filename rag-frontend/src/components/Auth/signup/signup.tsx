import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, Eye, EyeOff } from 'lucide-react';
import './signup.css';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

export function Signup() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwörter stimmen nicht überein');
      return;
    }

    if (!formData.agreeToTerms) {
      alert('Bitte akzeptieren Sie die Nutzungsbedingungen');
      return;
    }

    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'authenticated');
    navigate('/chat');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="signup-container">
      {/* Left Side - Image */}
      <div className="signup-hero-section">
        <div className="hero-content">
          <Scale className="hero-icon" />
          <h2 className="hero-title">Starten Sie noch heute</h2>
          <p className="hero-subtitle">
            Schließen Sie sich Tausenden von Rechtsexperten an, die bereits LegalRAG nutzen
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="signup-form-section">
        <div className="signup-form-wrapper">
          <Link to="/" className="logo-link">
            <div className="logo-icon">
              <span className="logo-text">LR</span>
            </div>
            <span className="logo-title">LegalRAG</span>
          </Link>

          <div className="welcome-section">
            <h1 className="welcome-title">Konto erstellen</h1>
            <p className="welcome-subtitle">
              Beginnen Sie Ihre kostenlose Testphase
            </p>
          </div>

          <form onSubmit={handleSignup} className="signup-form">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Vollständiger Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Max Mustermann"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

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
                  placeholder="Mindestens 8 Zeichen"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={8}
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

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Passwort bestätigen
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Passwort wiederholen"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className="form-input password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="password-toggle"
                >
                  {showConfirmPassword ? <EyeOff className="icon-sm" /> : <Eye className="icon-sm" />}
                </button>
              </div>
            </div>

            <div className="terms-checkbox">
              <input
                type="checkbox"
                id="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleInputChange}
                className="checkbox-input"
              />
              <label htmlFor="agreeToTerms" className="terms-label">
                Ich akzeptiere die{' '}
                <a href="#" className="terms-link">
                  Nutzungsbedingungen
                </a>{' '}
                und{' '}
                <a href="#" className="terms-link">
                  Datenschutzrichtlinien
                </a>
              </label>
            </div>

            <button
              type="submit"
              className="signup-button"
            >
              Konto erstellen
            </button>
          </form>

          <p className="login-link">
            Haben Sie bereits ein Konto?{' '}
            <Link to="/login" className="login-text">
              Anmelden
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}