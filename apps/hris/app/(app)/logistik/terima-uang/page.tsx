import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DepositChecks, MoneyCheckScreen, moneyCheckScreen, pendingDeposits, type CheckSource, type MoneyCheckTab } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const TABS: MoneyCheckTab[] = ['WAITING', 'DONE', 'DIFF'];
const SOURCES: ('ALL' | CheckSource)[] = ['ALL', 'TRUCK', 'SELF'];

// Terima Uang (spec LT1 §16.1): Finance memeriksa uang trip per nota; pemegang Uang dari Toko boleh melihat.
export default async function MoneyCheckPage({ searchParams }: { searchParams: Promise<{ tab?: string; sumber?: string }> }) {
  const { actor } = await getRequestActor();
  const q = await searchParams;
  const tab = TABS.includes(q.tab as MoneyCheckTab) ? (q.tab as MoneyCheckTab) : 'WAITING';
  const source = SOURCES.includes(q.sumber as CheckSource) ? (q.sumber as 'ALL' | CheckSource) : 'ALL';
  const [data, deposits] = await Promise.all([moneyCheckScreen(actor, tab, source), pendingDeposits(actor)]);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Terima Uang"
        description="Periksa uang trip truk dan antar sendiri per nota (Cocok / Tidak cocok). Pelunasan tetap dicatat di BO; HRIS menandai yang sudah masuk POS."
        actions={<NewBadge feature="/logistik/terima-uang" />}
      />
      {deposits && tab === 'WAITING' && <div className="mb-4"><DepositChecks {...deposits} /></div>}
      <MoneyCheckScreen {...data} />
    </>
  );
}
