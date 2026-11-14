import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LinkFixForm, linkFixScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Tautkan pembetulan keberatan slip (spec L4g §3.6): hanya penyetuju jenis itu, catatan disaring server.
export default async function LinkFixPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip_objection.decide', 'payslip_objection.decide_owner']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await linkFixScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Tautkan pembetulan" description="Pilih catatan yang membetulkan keberatan ini. Pengaju diberi tahu." />
      <LinkFixForm data={data} />
    </>
  );
}
