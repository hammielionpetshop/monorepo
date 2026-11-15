import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TransferScreen, transferScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L36 Daftar Transfer (spec L4f §3.6): Finance, Pemilik, GM. Tiap buka dicatat.
export default async function TransferPage({ params }: { params: Promise<{ start: string }> }) {
  const actor = await requirePageAnyAction(['payslip.pay', 'transfer_list.view']);
  if (!actor) return <NoAccess />;
  const { start } = await params;
  const data = await transferScreen(actor, start);
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Daftar Transfer" description={`Periode ${data.period.label}`} actions={<NewBadge feature="fitur/daftar-transfer" />} />
      <TransferScreen {...data} />
    </>
  );
}
