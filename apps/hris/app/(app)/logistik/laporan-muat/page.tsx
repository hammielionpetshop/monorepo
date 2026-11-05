import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LoadReportsScreen, addDays, loadReportList, wibDate, type LoadReportTab } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const TABS: LoadReportTab[] = ['DRAFT', 'DONE', 'CANCELLED'];
const dateOf = (value: string | undefined, fallback: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback);

// Laporan Muat (spec LT1 §15.1): bukti foto barang yang dimuat di cabang, untuk menjawab komplain toko.
export default async function LoadReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; dari?: string; sampai?: string; cari?: string }> }) {
  const actor = await requirePageAnyAction(['logistics.load_report.create', 'logistics.load_report.view']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const today = wibDate(new Date());
  const tab = TABS.includes(q.tab as LoadReportTab) ? (q.tab as LoadReportTab) : 'DRAFT';
  const filter = { tab, from: dateOf(q.dari, addDays(today, -7)), to: dateOf(q.sampai, today), q: (q.cari ?? '').slice(0, 60) };
  const data = await loadReportList(actor, filter);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Laporan Muat" description="Foto nota dan foto barang yang dimuat, bukti bila toko komplain." actions={<NewBadge feature="/logistik/laporan-muat" />} />
      <LoadReportsScreen rows={data.rows} branches={data.branches} filter={filter} />
    </>
  );
}
