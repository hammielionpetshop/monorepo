import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AdvanceDetailScreen, detailScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L28 Rincian Kasbon. Sumber uang dan usulan Finance tidak dikirim ke HR (spec L5 §5).
export default async function AdvanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAnyAction(['advance.view', 'advance.review', 'advance.hand_over', 'advance.decide']);
  if (!actor) return <NoAccess />;
  const detail = await detailScreen(actor, Number(id));
  if (!detail) notFound();
  return (
    <>
      <PageHeader title={`Kasbon ${detail.number}`} />
      <AdvanceDetailScreen detail={detail} />
    </>
  );
}
