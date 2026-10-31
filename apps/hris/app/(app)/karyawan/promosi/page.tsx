import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PromotionScreen, listPromotionQueue } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KAR-L27 Promosi Training.
export default async function PromotionPage() {
  const actor = await requirePageAnyAction(['training_promotion.decide']);
  if (!actor) return <NoAccess />;
  const queue = await listPromotionQueue(actor);
  return (
    <>
      <PageHeader
        title="Promosi Training"
        description="Orang Training yang genap 3 bulan sejak bergabung, atau yang tanggal nilai-lagi-nya sudah tiba."
      />
      <PromotionScreen
        today={queue.today}
        nextPeriodStart={queue.nextPeriodStart}
        rows={queue.rows.map((r) => ({
          id: r.id, name: r.name, code: r.code, branchName: r.branchName, positionName: r.positionName,
          joinedOn: r.joinedOn, promotionDueOn: r.promotionDueOn,
        }))}
      />
    </>
  );
}
