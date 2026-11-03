import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { AdvanceForm, advanceFormScreen } from '@/modules/advances';
import { resubmitSource } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// DRV-L24 Ajukan Kasbon (3 langkah). ?ulang=<id pengajuan ditolak> = Ajukan ulang (PRI-37 butir 5).
export default async function AdvanceFormPage({ searchParams }: { searchParams: Promise<{ ulang?: string }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await advanceFormScreen(actor, 'self');
  if (!data) return <NoAccess />;
  const source = q.ulang && /^\d+$/.test(q.ulang) ? await resubmitSource(actor, Number(q.ulang), REQUEST_HANDLERS) : null;
  const values = source?.typeKey === 'advance' ? source.values : null;
  return (
    <>
      <PageHeader title="Ajukan Kasbon" description="Berapa, alasan, lalu kirim." />
      <AdvanceForm
        {...data}
        initial={values ? { amount: Number(values.amount), installments: Number(values.installments), reason: String(values.reason ?? '') } : null}
        resubmittedFromId={values && source ? source.fromId : null}
      />
    </>
  );
}
