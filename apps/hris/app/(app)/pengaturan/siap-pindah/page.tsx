import Link from 'next/link';
import { Badge, Card, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { readinessScreen } from '@/lib/readiness';
import { NoAccess } from '@/modules/access';

export const dynamic = 'force-dynamic';

// Siap Pindah (spec L9 §3.4): daftar periksa sebelum hari pindah, dibaca dari data. Hanya Pemilik/GM.
export default async function ReadinessPage() {
  const actor = await requirePageAnyAction(['migration.readiness_view']);
  if (!actor) return <NoAccess />;
  const data = await readinessScreen(actor);
  if (!data) return <NoAccess />;
  const open = data.items.filter((i) => !i.ok).length;
  return (
    <>
      <PageHeader
        title="Siap Pindah"
        description={open ? `${open} hal belum siap. Hari pindah boleh dijalankan bila semua butir hijau.` : 'Semua butir siap untuk hari pindah.'}
      />
      <div className="space-y-3">
        {data.items.map((item) => (
          <Card key={item.key} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{item.title}</h2>
              <Badge tone={item.ok ? 'ok' : 'warn'}>{item.ok ? 'Siap' : 'Belum'}</Badge>
            </div>
            <p className="text-sm text-ink-muted">{item.detail}</p>
            {item.names.length > 0 && <p className="text-sm">{item.names.join(', ')}</p>}
            {!item.ok && <Link className="text-sm underline" href={item.href}>Betulkan</Link>}
          </Card>
        ))}
      </div>
    </>
  );
}
