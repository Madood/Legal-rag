import { Link } from 'react-router-dom'; // Fixed: 'react-router' → 'react-router-dom'
import { Scale, Search, Shield, Zap, Check, Moon, Sun, BookOpen, Users, TrendingUp, FileText } from 'lucide-react';
import { Button } from '../../ui/button';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { useState, useEffect } from 'react';
import { JurismLayers } from '../../home/JurismLayers';
import './Home.css';

export function Home() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const features = [
    {
      icon: Search,
      title: 'Intelligente Suche',
      description: 'KI-gestützte Suche in umfangreichen Rechtsdokumenten mit präzisen Ergebnissen.',
    },
    {
      icon: Shield,
      title: 'Sichere Datenverarbeitung',
      description: 'Ihre rechtlichen Dokumente werden mit höchsten Sicherheitsstandards behandelt.',
    },
    {
      icon: Zap,
      title: 'Schnelle Antworten',
      description: 'Erhalten Sie in Sekunden fundierte Antworten mit zitierten Quellen.',
    },
    {
      icon: Scale,
      title: 'Rechtssichere Zitate',
      description: 'Jede Antwort wird durch geprüfte Rechtsquellen und Paragrafen belegt.',
    },
  ];

  const documentation = [
    {
      icon: BookOpen,
      title: 'Schnellstart-Anleitung',
      description: 'Lernen Sie die Grundlagen in unter 5 Minuten',
      link: '#',
    },
    {
      icon: FileText,
      title: 'API-Dokumentation',
      description: 'Vollständige API-Referenz für Entwickler',
      link: '#',
    },
    {
      icon: Users,
      title: 'Best Practices',
      description: 'Tipps für optimale Suchergebnisse',
      link: '#',
    },
    {
      icon: TrendingUp,
      title: 'Fallstudien',
      description: 'Erfolgsgeschichten unserer Kunden',
      link: '#',
    },
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: '49',
      period: 'Monat',
      description: 'Perfekt für einzelne Rechtsanwälte',
      features: [
        'Bis zu 100 Anfragen/Monat',
        '1.000 Dokumente',
        'Standard Support',
        'Basic Analytics',
      ],
    },
    {
      name: 'Professional',
      price: '149',
      period: 'Monat',
      description: 'Für kleine bis mittlere Kanzleien',
      features: [
        'Unbegrenzte Anfragen',
        '10.000 Dokumente',
        'Priority Support',
        'Advanced Analytics',
        'Team Collaboration',
        'API Zugang',
      ],
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Individuell',
      period: '',
      description: 'Für große Organisationen',
      features: [
        'Unbegrenzte Anfragen',
        'Unbegrenzte Dokumente',
        '24/7 Support',
        'Custom Analytics',
        'Dedicated Account Manager',
        'On-Premise Deployment',
        'Custom Integrations',
      ],
    },
  ];

  return (
    <div className="home min-h-screen">
      {/* Navigation */}
      <nav className="home-nav">
        <div className="home-nav-container">
          <div className="home-nav-logo">
            <div className="home-nav-logo-icon">
              <span className="home-nav-logo-text">J</span>
            </div>
            <div>
              <h1 className="home-nav-title">Jurisma AI</h1>
            </div>
          </div>

          <div className="home-nav-actions">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="home-dark-mode-toggle"
            >
              {darkMode ? <Sun className="home-icon" /> : <Moon className="home-icon" />}
            </Button>
            <Link to="/login">
              <Button className="home-login-button">
                Anmelden
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-container">
          <div className="home-hero-grid">
            <div className="home-hero-content">
              <div className="home-hero-badge">
                <Scale className="home-badge-icon" />
                <span className="home-badge-text">KI-gestützte Rechtsrecherche</span>
              </div>
              <h1 className="home-hero-title">
                Präzise Rechts­antworten in Sekunden
              </h1>
              <p className="home-hero-description">
                Jurisma AI nutzt fortschrittliche KI, um Ihre Rechtsdokumente zu analysieren
                und präzise Antworten mit zitierten Quellen zu liefern.
              </p>
              <div className="home-hero-buttons">
                <Link to="/signup">
                  <Button size="lg" className="home-hero-button-primary">
                    Kostenlos testen
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="home-hero-button-secondary">
                  Demo ansehen
                </Button>
              </div>
            </div>

            <div className="home-hero-image-container">
              <div className="home-hero-image-wrapper">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1589994965851-a8f479c573a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGp1c3RpY2UlMjBzY2FsZXMlMjBsYXd8ZW58MXx8fHwxNzY0OTMzNTI5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Justice scales - Legal professional"
                  className="home-hero-image"
                /> 
                <div className="home-hero-image-overlay"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="home-features">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              Warum Jurisma AI?
            </h2>
            <p className="home-section-subtitle">
              Modernste Technologie für präzise und vertrauenswürdige Rechtsrecherche
            </p>
          </div>

          <div className="home-features-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="home-feature-card"
                >
                  <div className="home-feature-icon">
                    <Icon className="home-feature-icon-svg" />
                  </div>
                  <h3 className="home-feature-title">
                    {feature.title}
                  </h3>
                  <p className="home-feature-description">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture Layers Section */}
      <JurismLayers />

      {/* Documentation Section */}
      <section className="home-documentation">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              Dokumentation
            </h2>
            <p className="home-section-subtitle">
              Alles, was Sie wissen müssen, um Jurisma AI effektiv zu nutzen
            </p>
          </div>

          <div className="home-docs-grid">
            {documentation.map((doc) => {
              const Icon = doc.icon;
              return (
                <div
                  key={doc.title}
                  className="home-doc-card"
                >
                  <div className="home-doc-icon">
                    <Icon className="home-doc-icon-svg" />
                  </div>
                  <h3 className="home-doc-title">
                    {doc.title}
                  </h3>
                  <p className="home-doc-description">
                    {doc.description}
                  </p>
                  <a href={doc.link} className="home-doc-link">
                    Mehr erfahren →
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="home-pricing">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">
              Transparente Preise
            </h2>
            <p className="home-section-subtitle">
              Wählen Sie den Plan, der am besten zu Ihren Anforderungen passt
            </p>
          </div>

          <div className="home-pricing-grid">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`home-pricing-card ${plan.featured ? 'home-pricing-card-featured' : ''}`}
              >
                <div className="home-pricing-header">
                  <h3 className={`home-pricing-title ${plan.featured ? 'home-pricing-title-featured' : ''}`}>
                    {plan.name}
                  </h3>
                  <p className={`home-pricing-description ${plan.featured ? 'home-pricing-description-featured' : ''}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="home-pricing-price">
                  {plan.price === 'Individuell' ? (
                    <div className="home-pricing-price-custom">{plan.price}</div>
                  ) : (
                    <div className="home-pricing-price-amount">
                      <span className="home-pricing-price-value">€{plan.price}</span>
                      <span className={`home-pricing-price-period ${plan.featured ? 'home-pricing-price-period-featured' : ''}`}>
                        /{plan.period}
                      </span>
                    </div>
                  )}
                </div>

                <ul className="home-pricing-features">
                  {plan.features.map((feature) => (
                    <li key={feature} className="home-pricing-feature">
                      <Check className={`home-pricing-check ${plan.featured ? 'home-pricing-check-featured' : ''}`} />
                      <span className={`home-pricing-feature-text ${plan.featured ? 'home-pricing-feature-text-featured' : ''}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link to="/signup">
                  <Button
                    className={`home-pricing-button ${plan.featured ? 'home-pricing-button-featured' : ''}`}
                  >
                    {plan.price === 'Individuell' ? 'Kontakt aufnehmen' : 'Jetzt starten'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-grid">
            <div className="home-footer-brand">
              <div className="home-footer-logo">
                <div className="home-footer-logo-icon">
                  <span className="home-footer-logo-text">J</span>
                </div>
                <span className="home-footer-logo-name">Jurisma AI</span>
              </div>
              <p className="home-footer-tagline">
                KI-gestützte Rechtsrecherche für moderne Kanzleien
              </p>
            </div>

            <div className="home-footer-column">
              <h4 className="home-footer-heading">Produkt</h4>
              <ul className="home-footer-links">
                <li><a href="#" className="home-footer-link">Features</a></li>
                <li><a href="#" className="home-footer-link">Preise</a></li>
                <li><a href="#" className="home-footer-link">Sicherheit</a></li>
                <li><a href="#" className="home-footer-link">Updates</a></li>
              </ul>
            </div>

            <div className="home-footer-column">
              <h4 className="home-footer-heading">Unternehmen</h4>
              <ul className="home-footer-links">
                <li><a href="#" className="home-footer-link">Über uns</a></li>
                <li><a href="#" className="home-footer-link">Karriere</a></li>
                <li><a href="#" className="home-footer-link">Blog</a></li>
                <li><a href="#" className="home-footer-link">Kontakt</a></li>
              </ul>
            </div>

            <div className="home-footer-column">
              <h4 className="home-footer-heading">Rechtliches</h4>
              <ul className="home-footer-links">
                <li><a href="#" className="home-footer-link">Datenschutz</a></li>
                <li><a href="#" className="home-footer-link">AGB</a></li>
                <li><a href="#" className="home-footer-link">Impressum</a></li>
                <li><a href="#" className="home-footer-link">Cookie-Richtlinie</a></li>
              </ul>
            </div>
          </div>

          <div className="home-footer-bottom">
            <p>© 2024 Jurisma AI. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

