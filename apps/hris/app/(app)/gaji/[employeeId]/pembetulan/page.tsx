import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SalaryCorrectionForm, salaryCorrectionScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Pembetulan gaji periode lalu (spec L4g §3.6, GAJ-112): Pemilik/GM saja. ?keberatan=<id> = keberatan slip yang ditunjuk.
export default async function SalaryCorrectionPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>; searchParams: Promise<{ keberatan?: string }>;
}) {
  const actor = await requirePageAction('salary.change');
  if (!actor) return <NoAccess />;
  const [{ employeeId }, q] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(employeeId)) notFound();
  const data = await salaryCorrectionScreen(actor, Number(employeeId), q.keberatan && /^\d+$/.test(q.keberatan) ? Number(q.keberatan) : null);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Pembetulan gaji periode lalu: ${data.person.name}`} description="Untuk kesalahan gaji tetap di slip yang sudah ditutup." />
      <SalaryCorrectionForm data={data} />
    </>
  );
}
