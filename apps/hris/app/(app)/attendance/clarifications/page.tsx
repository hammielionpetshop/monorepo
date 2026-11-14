import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TeamClarificationScreen, teamClarificationScreen, type TeamTab } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const TABS: TeamTab[] = ['open', 'soon', 'waiting', 'streak'];
const KINDS = ['ALPHA', 'FORGOT_OUT', 'FORGOT_RETURN', 'LATE', 'EARLY_LEAVE'];

// KEH-L37 Perlu Dijelaskan Tim.
export default async function TeamClarificationPage({ searchParams }: { searchParams: Promise<{ tab?: string; branch?: string; kind?: string }> }) {
  const actor = await requirePageAnyAction(['clarification.team.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await teamClarificationScreen(actor, {
    tab: TABS.find((tab) => tab === params.tab) ?? 'open',
    branchId: /^\d+$/.test(params.branch ?? '') ? Number(params.branch) : null,
    kind: KINDS.find((kind) => kind === params.kind) ?? null,
  });
  return (
    <>
      <PageHeader title="Perlu Dijelaskan Tim" description="Siapa yang belum menjelaskan sebelum batas habis, dan siapa yang tidak masuk berturut-turut." />
      <TeamClarificationScreen {...data} />
    </>
  );
}
