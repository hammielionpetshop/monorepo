import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ManageForm, manageFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L39 Batalkan pelunasan atau hapus utang (spec L5 §3.10): Pemilik/GM, alasan wajib.
export default async function ReverseMovementPage({ params }: { params: Promise<{ id: string; m: string }> }) {
  const { id, m } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(m)) notFound();
  const actor = await requirePageAnyAction(['advance.manage']);
  if (!actor) return <NoAccess />;
  const data = await manageFormScreen(actor, Number(id));
  if (!data) notFound();
  const d = data.detail;
  const move = d.movements.find((x) => x.id === Number(m));
  if (!move) notFound();
  return (
    <>
      <PageHeader title="Batalkan Catatan Kasbon" description="Pelunasan atau hapus utang yang salah dicatat dibalik; jumlahnya kembali ke jadwal." />
      <ManageForm
        mode="reverse" id={d.id} number={d.number} name={d.name} remaining={d.remaining} carried={data.carried} today={data.today} handedOn={data.handedOn}
        sources={data.sources} waiting={data.waiting} reschedule={data.reschedule}
        movement={{ id: move.id, kind: move.kind, amount: move.amount, text: move.text }} allowed={d.reversible.includes(move.id)}
      />
    </>
  );
}
