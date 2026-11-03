import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TripAttendanceScreen, tripAttendanceScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Absen Trip Hari Ini (KEH-L19). Admin HR dan Finance melihat tanpa foto.
export default async function TripAttendancePage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const actor = await requirePageAction('attendance.trip.view');
  if (!actor) return <NoAccess />;
  const data = await tripAttendanceScreen(actor, (await searchParams).tanggal ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Absen Trip" description="Siapa jalan, siapa tidak, dan trip yang belum Sampai Garasi." actions={<NewBadge feature="/kehadiran/absen-trip" />} />
      <TripAttendanceScreen {...data} />
    </>
  );
}
