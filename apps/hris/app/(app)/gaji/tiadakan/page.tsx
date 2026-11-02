import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { WaiversScreen, waiversScreen, type WaiverStatus } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const STATUSES: WaiverStatus[] = ['CUT', 'WAIVED', 'EXPLAINED'];
const idOf = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : null);

// GAJ-L10 Tiadakan Potongan (spec L4b §3.4). Pemilik/GM meniadakan; HR melihat.
export default async function WaiversPage({ searchParams }: { searchParams: Promise<{ periode?: string; cabang?: string; orang?: string; status?: string }> }) {
  const actor = await requirePageAnyAction(['salary.view', 'pay_waiver.manage']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const status = STATUSES.find((s) => s === q.status) ?? null;
  const data = await waiversScreen(actor, { period: q.periode ?? null, branchId: idOf(q.cabang), employeeId: idOf(q.orang), status });
  return (
    <>
      <PageHeader title="Tiadakan Potongan" description="Potongan telat dan denda kehadiran per periode. Satu kejadian per keputusan, alasan wajib." actions={<NewBadge feature="/gaji/tiadakan" />} />
      <WaiversScreen {...data} />
    </>
  );
}
