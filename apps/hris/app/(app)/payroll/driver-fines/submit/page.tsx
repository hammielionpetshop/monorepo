import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DriverFineForm, fineFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Ajukan Denda (4 langkah, HP & PC; spec L7 §3.6). Kepala Gudang = usulan; Pemilik/GM langsung berlaku.
export default async function DriverFineFormPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const actor = await requirePageAnyAction(['fine.propose', 'fine.decide']);
  if (!actor) return <NoAccess />;
  const data = await fineFormScreen(actor, (await searchParams).tanggal ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title={data.direct ? 'Catat Denda' : 'Ajukan Denda'} description="Tanggal dan orang, jenis, uraian, lalu periksa." />
      <DriverFineForm key={data.date} {...data} />
    </>
  );
}
