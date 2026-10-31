import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { OwnDevicesCard, getOwnDevices } from '@/modules/accounts';
import { ProfileScreen, getOwnProfile } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KAR-L10 Profil & Akun saya, dengan Perangkat dan riwayat masuk (KAR-L14).
export default async function ProfilePage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const profile = await getOwnProfile(actor);
  if (!profile) {
    return <EmptyState title="Data karyawan belum tersedia">Akun ini belum tertaut ke data karyawan aktif. Hubungi HR.</EmptyState>;
  }
  const devices = await getOwnDevices(actor, session.sessionId);
  return (
    <div className="space-y-4">
      <ProfileScreen profile={profile} />
      {devices && <OwnDevicesCard devices={devices} />}
    </div>
  );
}
