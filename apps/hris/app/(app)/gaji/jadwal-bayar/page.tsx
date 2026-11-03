import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PayScheduleScreen, payScheduleScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L33 Jadwal Bayar (spec L4f §3.5): Pemilik/GM membayar; Finance melihat jumlah per periode tanpa nama.
export default async function PaySchedulePage() {
  const actor = await requirePageAnyAction(['payslip.pay', 'pay_schedule.view']);
  if (!actor) return <NoAccess />;
  const data = await payScheduleScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Jadwal Bayar"
        description={data.payer ? 'Slip yang sudah ditutup dan belum ditandai Dibayar. Centang lalu Bayar terpilih.' : 'Jumlah slip yang belum ditandai Dibayar per periode, tanpa nama.'}
        actions={<NewBadge feature="/gaji/jadwal-bayar" />}
      />
      <PayScheduleScreen {...data} />
    </>
  );
}
