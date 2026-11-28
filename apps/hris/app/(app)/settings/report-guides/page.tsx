import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReportGuidesEditScreen, reportGuidesEditScreen } from '@/modules/guides';

export const dynamic = 'force-dynamic';

// KAR-L35 Ubah Pedoman Lapor (spec F3-5 §2.2): hanya Pemilik/GM.
export default async function ReportGuidesSettingsPage() {
  const actor = await requirePageAction('report_guide.manage');
  if (!actor) return <NoAccess />;
  const data = await reportGuidesEditScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Pedoman Lapor" description="Jenis kasus → lapor ke siapa. Baris tidak dihapus, hanya dinonaktifkan; tiap perubahan tercatat." actions={<NewBadge feature="/settings/report-guides" />} />
      <ReportGuidesEditScreen {...data} />
    </>
  );
}
