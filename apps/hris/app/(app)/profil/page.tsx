import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { can } from '@/modules/access';
import { OwnDevicesCard, getOwnDevices } from '@/modules/accounts';
import { ProfileScreen, getOwnProfile } from '@/modules/employees';
import { REQUEST_TYPES, openRequestFor } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// KAR-L10 Profil & Akun saya, dengan Perangkat dan riwayat masuk (KAR-L14).
export default async function ProfilePage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const profile = await getOwnProfile(actor);
  if (!profile || !actor) {
    return <EmptyState title="Data karyawan belum tersedia">Akun ini belum tertaut ke data karyawan aktif. Hubungi HR.</EmptyState>;
  }
  const [devices, pendingId] = await Promise.all([
    getOwnDevices(actor, session.sessionId),
    openRequestFor(actor.personId, 'identity_change'),
  ]);
  const identity = {
    canRequest: can(actor, REQUEST_TYPES.identity_change.requestAction, { personId: actor.personId }),
    pendingId,
  };
  return (
    <div className="space-y-4">
      <ProfileScreen profile={profile} identity={identity} />
      {devices && <OwnDevicesCard devices={devices} />}
    </div>
  );
}
