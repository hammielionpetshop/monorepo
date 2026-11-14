import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ObjectionForm, objectionFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L18 Keberatan Potongan, dari pemberitahuan potongan. Hanya potongan atas nama sendiri.
export default async function ObjectionPage({ searchParams }: { searchParams: Promise<{ jenis?: string; id?: string }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  if (!q.id || !/^\d+$/.test(q.id)) notFound();
  const data = await objectionFormScreen(actor, q.jenis, Number(q.id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Keberatan Potongan" description="Tidak setuju dengan potongan ini? Jelaskan alasannya. Pemilik atau GM memutuskan." />
      <ObjectionForm {...data} />
    </>
  );
}
