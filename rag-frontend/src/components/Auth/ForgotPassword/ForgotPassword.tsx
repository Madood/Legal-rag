import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, ArrowLeft, Mail, Lock, CheckCircle } from 'lucide-react';
import { apiClient } from '../../../services/client';
import './ForgotPassword.css';

type Step = 'email' | 'code' | 'done';

export function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep]             = useState<Step>('email');
  const [email, setEmail]           = useState('');
  const [code, setCode]             = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Step 1: Send code ──────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setStep('code');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Fehler beim Senden. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2: Verify code + set new password ─────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { email, code, newPassword });
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Code ungültig oder abgelaufen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fp-container">
      <div className="fp-form-section">
        <div className="fp-form-wrapper">

          {/* Logo */}
          <Link to="/" className="fp-logo-link">
            <div className="fp-logo-icon">
              <span className="fp-logo-text">LR</span>
            </div>
            <span className="fp-logo-title">LegalRAG</span>
          </Link>

          {/* ── STEP 1: Enter email ── */}
          {step === 'email' && (
            <>
              <div className="fp-header">
                <div className="fp-icon-wrap">
                  <Mail className="fp-icon" />
                </div>
                <h1 className="fp-title">Passwort vergessen?</h1>
                <p className="fp-subtitle">
                  Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen 6-stelligen Code.
                </p>
              </div>

              {error && <div className="fp-error">{error}</div>}

              <form onSubmit={handleSendCode} className="fp-form">
                <div className="fp-group">
                  <label className="fp-label">E-Mail-Adresse</label>
                  <input
                    type="email"
                    placeholder="ihre.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="fp-input"
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className="fp-btn-primary">
                  {isSubmitting ? 'Wird gesendet…' : 'Code senden'}
                </button>
              </form>

              <Link to="/login" className="fp-back-link">
                <ArrowLeft className="fp-back-icon" />
                Zurück zur Anmeldung
              </Link>
            </>
          )}

          {/* ── STEP 2: Enter code + new password ── */}
          {step === 'code' && (
            <>
              <div className="fp-header">
                <div className="fp-icon-wrap">
                  <Lock className="fp-icon" />
                </div>
                <h1 className="fp-title">Code eingeben</h1>
                <p className="fp-subtitle">
                  Wir haben einen Code an <strong>{email}</strong> gesendet.
                  Geben Sie ihn unten ein und wählen Sie ein neues Passwort.
                </p>
              </div>

              {error && <div className="fp-error">{error}</div>}

              <form onSubmit={handleResetPassword} className="fp-form">
                <div className="fp-group">
                  <label className="fp-label">6-stelliger Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="fp-input fp-code-input"
                  />
                </div>

                <div className="fp-group">
                  <label className="fp-label">Neues Passwort</label>
                  <input
                    type="password"
                    placeholder="Mindestens 6 Zeichen"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="fp-input"
                  />
                </div>

                <div className="fp-group">
                  <label className="fp-label">Passwort bestätigen</label>
                  <input
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="fp-input"
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className="fp-btn-primary">
                  {isSubmitting ? 'Wird gespeichert…' : 'Passwort zurücksetzen'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setCode(''); }}
                className="fp-back-link"
              >
                <ArrowLeft className="fp-back-icon" />
                Andere E-Mail verwenden
              </button>
            </>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 'done' && (
            <div className="fp-done">
              <div className="fp-done-icon-wrap">
                <CheckCircle className="fp-done-icon" />
              </div>
              <h1 className="fp-title">Passwort geändert</h1>
              <p className="fp-subtitle">
                Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="fp-btn-primary"
              >
                Zur Anmeldung
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Hero panel */}
      <div className="fp-hero-section">
        <div className="fp-hero-content">
          <Scale className="fp-hero-icon" />
          <h2 className="fp-hero-title">KI-gestützte Rechtsrecherche</h2>
          <p className="fp-hero-subtitle">Präzise Antworten mit zitierten Quellen in Sekunden</p>
        </div>
      </div>
    </div>
  );
}
