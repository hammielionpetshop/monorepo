import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Card, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { deductionRulesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L07 Aturan Potongan (spec L4b §3.5): semua orang; contoh dihitung rumus yang sama.
export default async function DeductionRulesPage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const data = await deductionRulesScreen(actor);
  if (!data) redirect('/login');
  return (
    <>
      <PageHeader title="Aturan Potongan" description={`Dari mana potongan dan tambahan di gaji Anda. Contoh memakai gaji ${data.sample} sebulan.`} actions={<NewBadge feature="/panduan/aturan-potongan" />} />
      <div className="grid gap-4 md:grid-cols-2">
        {data.cards.map((card) => (
          <Card key={card.key}>
            <h2 id={card.key} className="mb-1 scroll-mt-20 font-semibold">{card.title}</h2>
            <p className="text-sm">{card.text}</p>
            <p className="mt-2 rounded-lg bg-canvas p-2 text-sm"><span className="text-ink-muted">Contoh: </span>{card.example}</p>
            {card.next && <p className="mt-2 text-sm text-warn-fg">{card.next}</p>}
          </Card>
        ))}
      </div>
    </>
  );
}
