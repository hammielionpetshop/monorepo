import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { OFFICE_TABS, OfficeScreen, officeScreen, type OfficeTab } from '@/modules/advances';


export const dynamic = 'force-dynamic';

// DRV-L26 Kasbon (daftar kantor): Finance memeriksa dan menyerahkan, Pemilik/GM memutuskan, HR melihat dan mengisikan.
export default async function AdvancesOfficePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; bulan?: string }> }) {
  const actor = await requirePageAnyAction(['advance.view', 'advance.review', 'advance.hand_over', 'advance.decide', 'advance.repay']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const tab = OFFICE_TABS.some((t) => t.key === q.tab) ? (q.tab as OfficeTab) : null;
  const data = await officeScreen(actor, { tab, q: q.q ?? null, month: q.bulan ?? null });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Kasbon" description="Diperiksa Finance, diputuskan Pemilik atau GM, lalu uangnya diserahkan." actions={<NewBadge feature="/gaji/kasbon" />} />
      <OfficeScreen {...data} />
    </>
  );
}
