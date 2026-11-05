import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PendingNotesScreen, pendingNotesScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Tertunda (LOG-57, spec LT1 §14.1 butir 3): surat jalan yang pernah Kirim Besok dan belum terkirim.
export default async function PendingNotesPage() {
  const actor = await requirePageAction('logistics.delivery_note.view');
  if (!actor) return <NoAccess />;
  const data = await pendingNotesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Surat Jalan Tertunda"
        description="Kiriman yang pernah Kirim Besok dan belum terkirim."
        actions={<><NewBadge feature="/logistik/surat-jalan/tertunda" /><Link href="/logistik/surat-jalan" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Semua surat jalan</Link></>}
      />
      <PendingNotesScreen {...data} />
    </>
  );
}
