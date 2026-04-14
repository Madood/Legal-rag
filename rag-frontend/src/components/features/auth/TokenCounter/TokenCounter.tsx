import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import './TokenCounter.css';

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
      className={`token-counter ${isLow ? 'token-counter-low' : 'token-counter-gold'}`}
    >
      <span className="token-coin-icon">₮</span>
      <span className="token-balance">{balance}</span>
      {isGuest && <span className="token-guest-label">/ guest</span>}
    </button>
  );
}
