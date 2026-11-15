import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { emergencyFormOptions, SendEmergencyScreen } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Kirim pengumuman darurat (spec F3-2 §3.5, BER-L24).
export default async function SendEmergencyPage() {
  const actor = await requirePageAction('announcement.emergency.send');
  if (!actor) return <NoAccess />;
  const result = await emergencyFormOptions(actor);
  if (!result.ok) return <NoAccess />;
  return (
    <>
      <PageHeader title="Kirim pengumuman darurat" description="Untuk kejadian mendesak, bukan perubahan aturan. Muncul di layar penerima paling lambat 1 menit." />
      <SendEmergencyScreen {...result.value} />
    </>
  );
}
