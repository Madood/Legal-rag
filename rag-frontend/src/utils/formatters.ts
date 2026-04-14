export function formatDate(dateString: string, locale = 'de-DE'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatConfidence(confidence: number): string {
  if (isNaN(confidence) || confidence == null) return '—';
  return `${(confidence * 100).toFixed(0)}%`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}
