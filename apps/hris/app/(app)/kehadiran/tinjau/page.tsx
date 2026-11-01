import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReviewScreen, reviewScreen, type ReviewFilter } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const FILTERS: ReviewFilter[] = ['pending', 'decided', 'uncorrected'];

// KEH-L12 Tinjau Absen.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string; branch?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.review.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await reviewScreen(actor, {
    tab: params.tab === 'patterns' ? 'patterns' : 'outside',
    filter: FILTERS.find((item) => item === params.filter) ?? 'pending',
    branchId: /^\d+$/.test(params.branch ?? '') ? Number(params.branch) : null,
  });
  return (
    <>
      <PageHeader title="Tinjau Absen" description="Absen di luar radius tetap dihitung. Putuskan Wajar atau Perlu dikoreksi; alasan wajib." />
      <ReviewScreen {...data} />
    </>
  );
}
