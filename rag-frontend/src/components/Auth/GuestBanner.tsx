import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const GUEST_SESSION_LIMIT = 5;

export function GuestBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!user?.isGuest || dismissed) return null;

  const used = user.sessionTokensUsed ?? 0;
  const remaining = Math.max(0, user.tokens.balance ?? 0);
  const sessionRemaining = Math.max(0, GUEST_SESSION_LIMIT - used);
  const isLow = sessionRemaining <= 2;
  const isExhausted = sessionRemaining === 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 text-sm border-b ${
        isExhausted
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          : isLow
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
      }`}
    >
      <AlertTriangle size={15} className="flex-shrink-0" />
      <span className="flex-1">
        {isExhausted
          ? 'Guest session limit reached. Create a free account to continue.'
          : `Guest mode — ${sessionRemaining} free ${sessionRemaining === 1 ? 'query' : 'queries'} left this session (${remaining} tokens total).`}
      </span>
      <button
        onClick={() => navigate('/signup')}
        className="flex items-center gap-1 font-medium hover:underline"
      >
        <UserPlus size={13} />
        Register
      </button>
      <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
