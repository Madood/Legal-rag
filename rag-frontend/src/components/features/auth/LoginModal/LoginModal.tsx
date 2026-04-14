import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Zap } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';

interface LoginModalProps {
  reason: 'TOKEN_EXHAUSTED' | 'SESSION_LIMIT' | 'AUTH_REQUIRED';
  onClose: () => void;
}

export function LoginModal({ reason, onClose }: LoginModalProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tab, setTab] = useState<'login' | 'info'>('info');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headings: Record<typeof reason, { title: string; subtitle: string }> = {
    TOKEN_EXHAUSTED: {
      title: 'Token Balance Exhausted',
      subtitle: 'Upgrade to Pro or Business to continue querying the legal corpus.',
    },
    SESSION_LIMIT: {
      title: 'Guest Session Limit Reached',
      subtitle: 'You have used all 5 free queries this session. Create an account to get more.',
    },
    AUTH_REQUIRED: {
      title: 'Sign in Required',
      subtitle: 'Please sign in or continue as guest to use the chat.',
    },
  };

  const { title, subtitle } = headings[reason];

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Zap size={20} className="text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{subtitle}</p>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab('info')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Upgrade
          </button>
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Sign In
          </button>
        </div>

        {tab === 'info' ? (
          <div className="space-y-3">
            <PlanCard name="Pro" price="€9/mo" tokens={300} color="blue" />
            <PlanCard name="Business" price="€29/mo" tokens={700} color="purple" />
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              See Pricing
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-center text-sm text-gray-500">
              No account?{' '}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="text-blue-600 hover:underline"
              >
                Register
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function PlanCard({ name, price, tokens, color }: { name: string; price: string; tokens: number; color: 'blue' | 'purple' }) {
  const accent = color === 'blue' ? 'text-blue-600' : 'text-purple-600';
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div>
        <p className={`font-semibold ${accent}`}>{name}</p>
        <p className="text-xs text-gray-500">{tokens} tokens / month</p>
      </div>
      <p className="font-bold text-gray-900 dark:text-white">{price}</p>
    </div>
  );
}
