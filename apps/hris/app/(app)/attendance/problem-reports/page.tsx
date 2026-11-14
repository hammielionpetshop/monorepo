import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ProblemListScreen, problemListScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L24 Laporan Masalah (rahasia): hanya Pemilik dan GM; yang menyangkut GM hanya Pemilik (KEH-128).
export default async function ProblemReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; id?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.problem.read']);
  if (!actor) return <NoAccess />;
  const { status, id } = await searchParams;
  const data = await problemListScreen(actor, { status: status ?? null, id: /^\d+$/.test(id ?? '') ? Number(id) : null });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Laporan Masalah" description="Rahasia. Laporan tidak berakibat apa pun bagi pelapor." />
      <ProblemListScreen {...data} />
    </>
  );
}
