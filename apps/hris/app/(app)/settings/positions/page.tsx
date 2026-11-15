import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { resubmitSource } from '@/modules/requests';
import { PositionSettingsScreen, getPositionSettingsScreen, type PositionResubmit } from '@/modules/settings';

export const dynamic = 'force-dynamic';

// KAR-L31 Pengaturan Jabatan. `?dari=<id>` = Ajukan ulang usulan yang ditolak.
export default async function PositionSettingsPage({ searchParams }: { searchParams: Promise<{ dari?: string }> }) {
  const { dari } = await searchParams;
  const actor = await requirePageAnyAction(['position_settings.propose', 'position_settings.approve']);
  if (!actor) return <NoAccess />;
  const data = await getPositionSettingsScreen(actor);
  if (!data) return <NoAccess />;
  const source = dari && /^\d+$/.test(dari) ? await resubmitSource(actor, Number(dari), REQUEST_HANDLERS) : null;
  const resubmit = source?.typeKey === 'position_setting_change' && source.values
    ? { fromId: source.fromId, values: source.values } as PositionResubmit : null;
  return (
    <>
      <PageHeader
        title="Pengaturan Jabatan"
        description="Tanda per jabatan, bertanggal berlaku. Jabatan tanpa nilai sendiri ikut baris bawaan."
      />
      <PositionSettingsScreen data={data} resubmit={resubmit} />
    </>
  );
}
