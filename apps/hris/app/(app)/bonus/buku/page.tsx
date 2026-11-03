import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { BonusBookScreen, bonusBookScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L21 Buku Bonus (spec L4d §4). Finance hanya jumlah per jenis per periode.
export default async function BonusBookPage({ searchParams }: { searchParams: Promise<{ periode?: string; jenis?: string; status?: string; orang?: string }> }) {
  const actor = await requirePageAnyAction(['bonus.view', 'bonus.view_totals']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await bonusBookScreen(actor, {
    period: q.periode ?? null, kind: q.jenis || null, status: q.status || null, employeeId: q.orang && /^\d+$/.test(q.orang) ? Number(q.orang) : null,
  });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Buku Bonus" description="Semua baris bonus dari semua jenis di satu daftar." actions={<NewBadge feature="/bonus/buku" />} />
      <BonusBookScreen {...data} />
    </>
  );
}
