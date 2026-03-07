import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function TokenCounter() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const balance = user.tokens?.balance ?? 0;
  const isLow = balance <= 5;
  const isGuest = user.isGuest;

  return (
    <button
      onClick={() => navigate('/pricing')}
      title={`${balance} tokens remaining — click to upgrade`}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isLow
          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      <Zap size={12} className={isLow ? 'text-red-500' : 'text-yellow-500'} />
      <span>{balance}</span>
      {isGuest && <span className="opacity-60">/ guest</span>}
    </button>
  );
}
