import { NewBadge } from '@/components/ui/new-badge';
import { Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MY_PAY_TABS, MyPayScreen, myPayScreen, type MyPayTab } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L39 Pendapatan Saya (spec L4g-1 §3.1). Hanya data orangnya sendiri.
export default async function MyPayPage({ searchParams }: { searchParams: Promise<{ periode?: string; tab?: string }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const tab = (MY_PAY_TABS.some((t) => t.key === q.tab) ? q.tab : 'ringkasan') as MyPayTab;
  const data = await myPayScreen(actor, q.periode ?? null);
  return (
    <>
      <PageHeader title="Pendapatan Saya" description={data ? `Periode ${data.period.label}` : undefined} actions={<NewBadge feature="/pendapatan" />} />
      {data ? <MyPayScreen data={data} tab={tab} /> : <Card><EmptyState title="Belum ada pendapatan di periode ini." /></Card>}
    </>
  );
}
