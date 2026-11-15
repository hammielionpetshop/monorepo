import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess, can } from '@/modules/access';
import { WriteRuleScreen, canWriteRules } from '@/modules/announcements';
import { writeRuleOptions } from '../form-data';

export const dynamic = 'force-dynamic';

// Tulis perubahan aturan (spec F3-3 §3.7, BER-L23).
export default async function NewRulePage() {
  const actor = await requirePageAnyAction(['announcement.rule.draft', 'announcement.rule.publish']);
  if (!actor || !canWriteRules(actor)) return <NoAccess />;
  return (
    <>
      <PageHeader title="Tulis perubahan aturan" description="Untuk perubahan aturan perusahaan (tarif, denda, potongan, jam kerja, batas waktu), bukan perubahan sistem." />
      <WriteRuleScreen draft={null} {...await writeRuleOptions(actor)} canPublish={can(actor, 'announcement.rule.publish')} fullAccess={actor.fullAccess} correctsTitle={null} />
    </>
  );
}
