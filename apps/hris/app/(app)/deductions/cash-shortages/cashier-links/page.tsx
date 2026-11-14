import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { CashierLinksScreen, cashierLinksScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Tautan Akun Kasir (spec L4c §9 butir 6).
export default async function CashierLinksPage() {
  const actor = await requirePageAnyAction(['cash_shortage.view', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const data = await cashierLinksScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Tautan Akun Kasir" description="Akun kasir POS milik karyawan siapa, supaya minus kasnya tertuju ke orang yang benar." actions={<NewBadge feature="fitur/tautan-akun-kasir" />} />
      <CashierLinksScreen {...data} />
    </>
  );
}
