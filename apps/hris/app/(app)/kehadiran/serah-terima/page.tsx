import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TeamHandoversScreen, teamHandoversScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L22 Serah Terima Tim: per tanggal, cari dan saring.
export default async function TeamHandoversPage({ searchParams }: {
  searchParams: Promise<{ branch?: string; from?: string; to?: string; unread?: string; photo?: string; q?: string }>;
}) {
  const actor = await requirePageAnyAction(['attendance.handover.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await teamHandoversScreen(actor, {
    branchId: /^\d+$/.test(params.branch ?? '') ? Number(params.branch) : null, from: params.from ?? null, to: params.to ?? null,
    unread: params.unread === '1', photo: params.photo === '1', q: (params.q ?? '').slice(0, 100),
  });
  return (
    <>
      <PageHeader title="Serah Terima Tim" description="Serah terima Laporan Pulang di cabang yang boleh Anda lihat." />
      <TeamHandoversScreen {...data} />
    </>
  );
}
