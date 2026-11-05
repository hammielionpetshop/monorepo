import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LogisticsReportScreen, logisticsReportScreen, type ReportQuery } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Laporan Logistik (spec LT1 §17.2; LOG-145): Pemilik, GM, Kepala Gudang, Finance, Marketing (tanpa bensin dan kurang serah).
export default async function LogisticsReportPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const actor = await requirePageAnyAction(['logistics.report.view']);
  if (!actor) return <NoAccess />;
  const data = await logisticsReportScreen(actor, await searchParams);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Laporan Logistik"
        description="Kiriman truk dan antar sendiri per periode 26–25 atau tanggal bebas: per trip, toko, cabang, mobil, dan awak."
        actions={<NewBadge feature="/logistik/laporan" />}
      />
      <LogisticsReportScreen data={data} />
    </>
  );
}
