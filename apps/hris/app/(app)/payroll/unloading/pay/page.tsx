import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingPayForm, payScreen, waitingTopUps, type PayTarget } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter((x) => /^\d+$/.test(x)).map(Number);

// DRV-L17 Bayar Bongkaran (3 langkah): Finance, Pemilik, GM. ?r=<laporan>&t=<susulan>.
export default async function UnloadingPayPage({ searchParams }: { searchParams: Promise<{ r?: string | string[]; t?: string | string[] }> }) {
  const actor = await requirePageAnyAction(['unloading.pay']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const topUps = await waitingTopUps(actor);
  const targets: PayTarget[] = [
    ...list(q.r).map((reportId) => ({ reportId, topUpId: null })),
    ...list(q.t).flatMap((topUpId) => {
      const found = topUps.find((t) => t.topUpId === topUpId);
      return found ? [{ reportId: found.reportId, topUpId }] : [];
    }),
  ];
  const data = await payScreen(actor, targets);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Bayar Bongkaran" description="Dibayar sekali dan penuh sebesar hitungan sistem; tanpa kasbon, denda, atau potongan lain." actions={<NewBadge feature="fitur/bongkaran-bayar" />} />
      <UnloadingPayForm {...data} />
    </>
  );
}
