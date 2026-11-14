import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { LoginHistoryScreen, getLoginHistory, type LoginHistoryFilter } from '@/modules/accounts';
import { NoAccess } from '@/modules/access';

export const dynamic = 'force-dynamic';

type Search = { accountId?: string; outcome?: string; from?: string; to?: string; page?: string };

const positiveInt = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : undefined);

// KAR-L40 Riwayat Masuk Semua Orang (Pemilik/GM).
export default async function LoginHistoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requirePageAction('login_history.view_all');
  if (!actor) return <NoAccess />;
  const search = await searchParams;
  const filter: LoginHistoryFilter = {
    accountId: positiveInt(search.accountId),
    outcome: search.outcome === 'SUCCESS' || search.outcome === 'REJECTED' ? search.outcome : undefined,
    from: search.from, to: search.to,
    page: positiveInt(search.page) ?? 1,
  };
  const data = await getLoginHistory(actor, filter);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Riwayat Masuk" description="Masuk dan gagal masuk semua orang ke HRIS dan kasir. Bawaan 7 hari terakhir." />
      <LoginHistoryScreen data={data} filter={filter} />
    </>
  );
}
