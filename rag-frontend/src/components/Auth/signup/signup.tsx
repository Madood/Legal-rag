import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import './signup.css';

export function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const defaultTier = (location.state as any)?.tier || 'pro';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [id]: type === 'checkbox' ? checked : value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    if (!formData.agreeToTerms) {
      setError('Bitte akzeptieren Sie die Nutzungsbedingungen');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(formData.name, formData.email, formData.password, defaultTier);
      navigate('/chat');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registrierung fehlgeschlagen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-hero-section">
        <div className="hero-content">
          <Scale className="hero-icon" />
          <h2 className="hero-title">Starten Sie noch heute</h2>
          <p className="hero-subtitle">
            Schließen Sie sich Tausenden von Rechtsexperten an, die bereits LegalRAG nutzen
          </p>
        </div>
      </div>

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
            <p className="welcome-subtitle">Beginnen Sie Ihre kostenlose Testphase</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="signup-form">
            <div className="form-group">
              <label htmlFor="name" className="form-label">Vollständiger Name</label>
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
              <label htmlFor="email" className="form-label">E-Mail-Adresse</label>
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
              <label htmlFor="password" className="form-label">Passwort</label>
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="password-toggle">
                  {showPassword ? <EyeOff className="icon-sm" /> : <Eye className="icon-sm" />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Passwort bestätigen</label>
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
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="password-toggle">
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
                <a href="#" className="terms-link">Nutzungsbedingungen</a>{' '}
                und{' '}
                <a href="#" className="terms-link">Datenschutzrichtlinien</a>
              </label>
            </div>

            <button type="submit" disabled={isSubmitting} className="signup-button">
              {isSubmitting ? 'Konto wird erstellt...' : 'Konto erstellen'}
            </button>
          </form>

          <p className="login-link">
            Haben Sie bereits ein Konto?{' '}
            <Link to="/login" className="login-text">Anmelden</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
