import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PostponeForm, postponeFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L32 Minta Tunda cicilan kasbon: pemilik kasbon, atau HR/Admin HR atas nama (spec L5 §3.9).
export default async function PostponePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const data = await postponeFormScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Minta Tunda Cicilan" description={data.self ? 'Geser semua cicilan kasbon satu gajian.' : `Atas nama ${data.name}.`} />
      <PostponeForm id={data.id} number={data.number} next={data.next} blocked={data.blocked} backHref={data.backHref} />
    </>
  );
}
