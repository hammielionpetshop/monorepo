import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ComparisonScreen, comparisonScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Lembar Banding (spec L9 §4): hitungan HRIS vs slip sistem lama untuk satu periode. Hanya Pemilik/GM.
export default async function ComparisonPage({ searchParams }: { searchParams: Promise<{ uji?: string }> }) {
  const actor = await requirePageAnyAction(['migration.comparison']);
  if (!actor) return <NoAccess />;
  const data = await comparisonScreen(actor, (await searchParams).uji ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Uji Banding"
        description="Slip HRIS dihitung dari data salinan sistem lama, lalu dibandingkan dengan slip lama per orang. Tidak ada slip yang ditutup atau dibayar."
      />
      <ComparisonScreen data={data} />
    </>
  );
}
