import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReportGuidesScreen, canManageReportGuides, listReportGuides } from '@/modules/guides';

export const dynamic = 'force-dynamic';

// KAR-L34 Pedoman Lapor (spec F3-5 §2.2): semua akun HRIS.
export default async function ReportGuidesPage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  if (!actor) return <NoAccess />;
  return (
    <>
      <PageHeader title="Pedoman Lapor" description="Ada kejadian? Lihat di sini harus lapor ke siapa." actions={<NewBadge feature="/guides/report" />} />
      <ReportGuidesScreen rows={await listReportGuides()} canEdit={canManageReportGuides(actor)} />
    </>
  );
}
