import { Info } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';

const COSTS: Array<{ label: string; cost: number }> = [
  { label: 'Standard query', cost: 1 },
  { label: 'Cross-statute query', cost: 2 },
  { label: 'High-doctrine query', cost: 2 },
  { label: 'AI doctrine fallback', cost: 3 },
  { label: 'Clarification', cost: 0 },
];

export function TokenUsageInfo() {
  const { user } = useAuth();
  if (!user) return null;

  const { balance, used, resetAt } = user.tokens;
  const resetDate = resetAt ? new Date(resetAt).toLocaleDateString() : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
        <Info size={15} />
        Token Usage
      </div>

      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>Balance</span>
        <span className="font-mono font-semibold text-gray-900 dark:text-white">{balance}</span>
      </div>
      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>Used</span>
        <span className="font-mono">{used}</span>
      </div>
      {resetDate && (
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Resets</span>
          <span>{resetDate}</span>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Cost per query type</p>
        {COSTS.map(({ label, cost }) => (
          <div key={label} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{label}</span>
            <span className="font-mono">{cost === 0 ? 'free' : `${cost} token${cost !== 1 ? 's' : ''}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
