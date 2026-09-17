const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  resolu: 'Résolu',
  escalade: 'Escaladé',
};

const STATUS_STYLES: Record<string, string> = {
  nouveau: 'bg-status-newSoft text-status-new',
  en_cours: 'bg-status-progressSoft text-status-progress',
  resolu: 'bg-status-resolvedSoft text-status-resolved',
  escalade: 'bg-status-escalatedSoft text-status-escalated',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? 'bg-canvas text-muted'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const SENTIMENT_LABELS: Record<string, string> = {
  positif: 'Positif',
  neutre: 'Neutre',
  negatif: 'Négatif',
  colere: 'Colère',
};

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const isAlert = sentiment === 'colere' || sentiment === 'negatif';
  return (
    <span
      className={`badge ${isAlert ? 'bg-status-escalatedSoft text-status-escalated' : 'bg-canvas text-muted'}`}
    >
      {SENTIMENT_LABELS[sentiment] ?? sentiment}
    </span>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  web: 'Web',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export function ChannelBadge({ channel }: { channel: string }) {
  return <span className="badge bg-canvas text-muted">{CHANNEL_LABELS[channel] ?? channel}</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const style =
    confidence >= 0.6
      ? 'bg-status-resolvedSoft text-status-resolved'
      : confidence >= 0.35
      ? 'bg-status-progressSoft text-status-progress'
      : 'bg-status-escalatedSoft text-status-escalated';
  return <span className={`badge font-mono ${style}`}>{pct}% confiance</span>;
}
