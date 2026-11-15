import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AnnouncementsScreen, listEmergencies } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Kantor › Pengumuman (spec F3-2 §3.5, BER-L22). Tab perubahan aturan menyusul di F3-3.
export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageAnyAction(['announcement.view', 'announcement.emergency.send']);
  if (!actor) return <NoAccess />;
  const result = await listEmergencies(actor);
  if (!result.ok) return <NoAccess />;
  const { tab } = await searchParams;
  return (
    <>
      <PageHeader
        title="Pengumuman"
        description="Pengumuman darurat tampil paling depan di layar penerima dan wajib dibaca."
        actions={(
          <>
            <NewBadge feature="/announcements" />
            {result.value.canSend && (
              <Link href="/announcements/emergency/new" className={buttonClass({ variant: 'danger' })}>Kirim pengumuman darurat</Link>
            )}
          </>
        )}
      />
      <AnnouncementsScreen rows={result.value.rows} tab={tab === 'done' ? 'done' : 'showing'} />
    </>
  );
}
