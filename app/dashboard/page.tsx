import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: conversations } = await supabaseServer
    .from('conversations')
    .select('status, channel, created_at, first_response_at');

  const { data: escalations } = await supabaseServer
    .from('escalations')
    .select('reason, status');

  const total = conversations?.length ?? 0;
  const escaladees = conversations?.filter((c) => c.status === 'escalade').length ?? 0;
  const tauxEscalade = total > 0 ? Math.round((escaladees / total) * 100) : 0;

  const tempsReponse = (conversations ?? [])
    .filter((c) => c.first_response_at)
    .map((c) => (new Date(c.first_response_at!).getTime() - new Date(c.created_at).getTime()) / 60000);
  const tempsReponseMoyen =
    tempsReponse.length > 0 ? Math.round(tempsReponse.reduce((a, b) => a + b, 0) / tempsReponse.length) : 0;

  const parCanal = groupBy(conversations ?? [], (c) => c.channel);
  const motifsEscalade = groupBy(escalations ?? [], (e) => e.reason);

  return (
    <div className="p-6">
      <h1 className="text-lg font-medium mb-5">Pilotage</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Metric label="Volume total" value={total.toString()} />
        <Metric label="Temps 1ère réponse" value={`${tempsReponseMoyen} min`} />
        <Metric label="Taux d'escalade" value={`${tauxEscalade}%`} />
        <Metric label="Escalades ouvertes" value={escaladees.toString()} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="rounded border border-line bg-surface p-4">
          <h2 className="text-sm font-medium mb-3">Volume par canal</h2>
          <BarList data={parCanal} />
        </div>
        <div className="rounded border border-line bg-surface p-4">
          <h2 className="text-sm font-medium mb-3">Motifs d'escalade les plus fréquents</h2>
          <BarList data={motifsEscalade} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-surface p-4">
      <p className="text-xs text-faint mb-1">{label}</p>
      <p className="text-2xl font-mono font-medium">{value}</p>
    </div>
  );
}

function BarList({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data);

  if (entries.length === 0) return <p className="text-sm text-faint">Pas encore de données.</p>;

  return (
    <div className="space-y-2">
      {entries.map(([label, count]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-muted capitalize">{label}</span>
          <div className="flex-1 h-2 rounded bg-canvas overflow-hidden">
            <div className="h-full bg-zen" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right font-mono text-xs">{count}</span>
        </div>
      ))}
    </div>
  );
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
