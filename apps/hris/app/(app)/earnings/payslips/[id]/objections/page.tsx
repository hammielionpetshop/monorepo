import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SlipObjectionForm, slipObjectionFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L41 Ajukan Keberatan Slip (spec L4g §3.5). ?macam=WRONG|NOT_RECEIVED, ?dari=<id> = Ajukan ulang. Hanya slip sendiri.
export default async function SlipObjectionPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ macam?: string; dari?: string }>;
}) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const [{ id }, q] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id) || (q.dari != null && !/^\d+$/.test(q.dari))) notFound();
  const data = await slipObjectionFormScreen(actor, Number(id), q.macam ?? 'WRONG', q.dari ? Number(q.dari) : null);
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Keberatan slip" description={`${data.kindLabel}. Jelaskan apa yang salah; ${data.decider} memutuskan.`} />
      <SlipObjectionForm data={data} />
    </>
  );
}
