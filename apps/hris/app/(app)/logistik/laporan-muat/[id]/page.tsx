import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LoadReportDetailScreen, loadReportDetail } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Rincian Laporan Muat (spec LT1 §15.1 butir 3–5, 8).
export default async function LoadReportPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['logistics.load_report.create', 'logistics.load_report.view']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  const report = /^\d+$/.test(id) ? await loadReportDetail(actor, Number(id)) : null;
  if (!report) return <NoAccess />;
  return (
    <>
      <PageHeader title={`Laporan Muat ${report.store}`} description={`${report.branch} · dibuat ${report.createdAt}`} />
      <LoadReportDetailScreen report={report} />
    </>
  );
}
