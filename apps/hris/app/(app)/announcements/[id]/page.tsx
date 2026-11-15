import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { emergencyReaders, ReadersScreen } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Siapa sudah dan belum baca (spec F3-2 §3.5, BER-L25).
export default async function AnnouncementReadersPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['announcement.view', 'announcement.emergency.send']);
  if (!actor) return <NoAccess />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const result = await emergencyReaders(actor, id);
  if (!result.ok) return result.status === 404 ? notFound() : <NoAccess />;
  return (
    <>
      <PageHeader title="Siapa sudah dan belum baca" />
      <ReadersScreen {...result.value} />
    </>
  );
}
