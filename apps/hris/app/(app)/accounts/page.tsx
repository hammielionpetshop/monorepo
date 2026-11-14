import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { AccountsScreen, listAccountsScreen } from '@/modules/accounts';
import { NoAccess } from '@/modules/access';

export const dynamic = 'force-dynamic';

// Akun & Tautan (spec L2d §6): hanya Pemilik/GM.
export default async function AccountsPage() {
  const actor = await requirePageAction('account.manage');
  if (!actor) return <NoAccess />;
  const data = await listAccountsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Akun & Tautan" description="Akun masuk bersama HRIS dan kasir, beserta pemiliknya dan akses kasirnya." />
      <AccountsScreen data={data} />
    </>
  );
}
