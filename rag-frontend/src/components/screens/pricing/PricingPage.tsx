import { useNavigate } from 'react-router-dom';
import { Check, Scale } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import '../Home/Home.css';
import './PricingPage.css';

const PLANS = [
  {
    tier: 'guest' as const,
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'Testen Sie das System kostenlos',
    features: [
      '30 Token gesamt',
      '5 Anfragen pro Sitzung',
      'Standard-Anfragen',
      'Kein Konto erforderlich',
    ],
    cta: 'Als Gast fortfahren',
    featured: false,
  },
  {
    tier: 'pro' as const,
    name: 'Professional',
    price: '9',
    period: 'Monat',
    description: 'Für rechtliche Recherche',
    features: [
      '300 Token / Monat',
      'Unbegrenzte Sitzungen',
      'Alle Anfragetypen',
      'Priority Support',
      'API Zugang',
    ],
    cta: 'Pro starten',
    featured: true,
  },
  {
    tier: 'business' as const,
    name: 'Business',
    price: '29',
    period: 'Monat',
    description: 'Für Kanzleien & Teams',
    features: [
      '700 Token / Monat',
      'Unbegrenzte Sitzungen',
      'Alle Anfragetypen',
      'Team-Verwaltung (bald)',
      'Dedizierter Support',
    ],
    cta: 'Business starten',
    featured: false,
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const { user, continueAsGuest } = useAuth();

  async function handleSelect(tier: string) {
    if (tier === 'guest') {
      await continueAsGuest();
      navigate('/chat');
    } else {
      navigate('/signup', { state: { tier } });
    }
  }

  return (
    <div className="pricing-page">

      {/* Page header */}
      <div className="pricing-page-header">
        <div className="pricing-page-header-inner">
          <div className="pricing-page-badge">
            <Scale size={14} />
            <span>Transparente Preisgestaltung</span>
          </div>
          <h1 className="pricing-page-title">Einfache, transparente Preise</h1>
          <p className="pricing-page-subtitle">
            Token werden pro Anfrage verbraucht. Nicht verwendete Token werden
            monatlich zurückgesetzt.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="home-container">
        <div className="home-pricing-grid">
          {PLANS.map((plan) => {
            const isCurrentTier = user?.tier === plan.tier;

            return (
              <div
                key={plan.tier}
                className={`home-pricing-card ${plan.featured ? 'home-pricing-card-featured' : ''}`}
              >
                {plan.featured && (
                  <div className="pricing-badge-wrapper">
                    <span className="pricing-recommended-badge">Empfohlen</span>
                  </div>
                )}

                <div className="home-pricing-header">
                  <h3 className={`home-pricing-title ${plan.featured ? 'home-pricing-title-featured' : ''}`}>
                    {plan.name}
                  </h3>
                  <p className={`home-pricing-description ${plan.featured ? 'home-pricing-description-featured' : ''}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="home-pricing-price">
                  {plan.price === 'Free' ? (
                    <div className="home-pricing-price-custom">Kostenlos</div>
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

                <button
                  disabled={isCurrentTier}
                  onClick={() => handleSelect(plan.tier)}
                  className={`home-pricing-button ${plan.featured ? 'home-pricing-button-featured' : ''} ${isCurrentTier ? 'pricing-button-current' : ''}`}
                >
                  {isCurrentTier ? 'Aktueller Plan' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="pricing-token-note">
          Standard-Anfragen kosten 1 Token · Vergleiche & Doctrine-Anfragen 2 Token ·
          KI-Synthese 3 Token
        </p>
      </div>

    </div>
  );
}
