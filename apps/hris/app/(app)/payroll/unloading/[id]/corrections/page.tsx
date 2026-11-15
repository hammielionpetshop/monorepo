import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingForm, correctionFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L18 Koreksi Laporan Bongkaran: Kepala Gudang sebelum dibayar; Pemilik/GM kapan pun.
export default async function UnloadingCorrectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tanggal?: string }> }) {
  const actor = await requirePageAnyAction(['unloading.create', 'unloading.correct_paid']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await correctionFormScreen(actor, Number(id), (await searchParams).tanggal ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title={`Koreksi ${data.correction.number}`} description="Ubah isi laporan; versi lama tetap tersimpan. Sistem menghitung ulang dengan tarif tanggal kerja." />
      <UnloadingForm key={data.workDate} {...data} />
    </>
  );
}
