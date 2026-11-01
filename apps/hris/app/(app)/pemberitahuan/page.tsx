import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NotificationsScreen, listNotifications, unreadCount } from '@/modules/notifications';

export const dynamic = 'force-dynamic';

// BER-L02 Pemberitahuan: kabar yang cukup diketahui, disimpan 90 hari.
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { session } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const page = Number((await searchParams).page) || 1;
  const [list, unread] = await Promise.all([listNotifications(session.accountId, page), unreadCount(session.accountId)]);
  return (
    <>
      <PageHeader title="Pemberitahuan" description="Kabar tentang pengajuan dan akun Anda. Disimpan 90 hari." />
      <NotificationsScreen items={list.items} hasMore={list.hasMore} page={list.page} unread={unread} />
    </>
  );
}
