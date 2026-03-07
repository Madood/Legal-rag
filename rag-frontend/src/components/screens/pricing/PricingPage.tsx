import { useNavigate } from 'react-router-dom';
import { Check, Zap } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const PLANS = [
  {
    tier: 'guest' as const,
    name: 'Guest',
    price: 'Free',
    tokens: 30,
    sessionLimit: 5,
    description: 'Try out the system',
    features: [
      '30 total tokens',
      '5 queries per session',
      'Standard queries',
      'No account required',
    ],
    cta: 'Continue as Guest',
    color: 'gray',
  },
  {
    tier: 'pro' as const,
    name: 'Pro',
    price: '€9/month',
    tokens: 300,
    sessionLimit: null,
    description: 'For legal researchers',
    features: [
      '300 tokens / month',
      'Unlimited sessions',
      'All query types',
      'Priority support',
    ],
    cta: 'Get Pro',
    color: 'blue',
    recommended: true,
  },
  {
    tier: 'business' as const,
    name: 'Business',
    price: '€29/month',
    tokens: 700,
    sessionLimit: null,
    description: 'For law firms & teams',
    features: [
      '700 tokens / month',
      'Unlimited sessions',
      'All query types',
      'Team management (soon)',
    ],
    cta: 'Get Business',
    color: 'purple',
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center py-16 px-4">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-3">
          <Zap size={32} className="text-yellow-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Simple Pricing</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Tokens are consumed per query. Unused tokens reset monthly on paid plans.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {PLANS.map((plan) => {
          const isCurrentTier = user?.tier === plan.tier;
          const isRecommended = plan.recommended;

          const borderClass =
            plan.color === 'blue'
              ? 'border-blue-500'
              : plan.color === 'purple'
              ? 'border-purple-500'
              : 'border-gray-200 dark:border-gray-700';

          const ctaClass =
            plan.color === 'blue'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : plan.color === 'purple'
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100';

          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col rounded-2xl border-2 ${borderClass} bg-white dark:bg-gray-900 p-6 shadow-sm`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-1">
                    Recommended
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Check size={14} className="text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrentTier}
                onClick={() => handleSelect(plan.tier)}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-default ${ctaClass}`}
              >
                {isCurrentTier ? 'Current Plan' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
