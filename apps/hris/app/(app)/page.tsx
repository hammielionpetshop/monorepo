import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { hasAction } from '@/modules/access';
import { pendingReviewCount } from '@/modules/attendance';
import { listPromotionQueue } from '@/modules/employees';
import { NotificationRow, latestUnread } from '@/modules/notifications';
import { waitingSummary } from '@/modules/requests';

export const dynamic = 'force-dynamic';

type AttentionCard = { key: string; title: string; detail?: string; href: string; tone?: 'danger'; badge?: string };

function days(n: number) {
  return n < 1 ? 'kurang dari 1 hari' : `${n} hari`;
}

/**
 * BER-L01 Beranda dasar (spec L2f-1 §5–6). Kartu "Perlu perhatian" dihitung saat dibuka dan hilang sendiri
 * saat urusannya beres; tiap modul menyediakan angkanya, halaman ini merangkai.
 */
export default async function HomePage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const [waiting, promotion, news, reviews] = await Promise.all([
    waitingSummary(actor),
    hasAction(actor, 'training_promotion.decide') ? listPromotionQueue(actor) : null,
    latestUnread(session.accountId, 3),
    pendingReviewCount(actor),
  ]);

  const mine: AttentionCard[] = [];
  if (waiting.count) {
    mine.push({
      key: 'requests', title: `${waiting.count} pengajuan menunggu keputusan`,
      detail: `Paling lama ${days(waiting.oldestDays)}`, href: '/persetujuan',
    });
  }
  const dueTraining = promotion?.rows.filter((row) => row.promotionDueOn && row.promotionDueOn <= promotion.today).length ?? 0;
  if (dueTraining) {
    mine.push({ key: 'training', title: `${dueTraining} karyawan training menunggu dinilai`, href: '/karyawan/promosi' });
  }
  if (reviews) {
    mine.push({
      key: 'attendance-review', title: `Absen menunggu tinjauan: ${reviews}`, detail: 'Absen di luar radius belum diputuskan',
      href: '/kehadiran/tinjau', badge: 'fitur/beranda-tinjau-absen',
    });
  }
  const system: AttentionCard[] = waiting.overdueAll ? [{
    key: 'overdue', title: `${waiting.overdueAll} pengajuan menunggu lebih dari ${waiting.overdueDays} hari`,
    detail: 'Belum diputuskan penyetujunya', href: '/persetujuan?tab=all', tone: 'danger',
  }] : [];

  const cardList = (cards: AttentionCard[]) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className={`block rounded-card border border-l-4 border-line bg-surface p-4 hover:bg-canvas ${card.tone === 'danger' ? 'border-l-danger-fg' : 'border-l-brand-600'}`}
        >
          <p className="flex items-center gap-2 font-medium">{card.title}{card.badge && <NewBadge feature={card.badge} />}</p>
          {card.detail && <p className="text-sm text-ink-muted">{card.detail}</p>}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Beranda" description="Ringkasan hal yang perlu perhatian Anda." />

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">Perlu perhatian saya <NewBadge feature="fitur/beranda-perlu-perhatian" /></h2>
        {mine.length ? cardList(mine) : (
          <Card><EmptyState title="Tidak ada yang menunggu Anda" /></Card>
        )}
      </section>

      {actor?.fullAccess && (
        <section className="space-y-2">
          <h2 className="font-semibold">Perlu perhatian sistem</h2>
          {system.length ? cardList(system) : <p className="text-sm text-ink-muted">Tidak ada.</p>}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Kabar terbaru</h2>
          <Link href="/pemberitahuan" className="text-sm text-brand-700">Lihat semua</Link>
        </div>
        {news.length ? (
          <Card className="p-0 sm:p-0"><div className="divide-y divide-line px-4">{news.map((item) => <NotificationRow key={item.id} item={item} />)}</div></Card>
        ) : <p className="text-sm text-ink-muted">Tidak ada kabar baru.</p>}
      </section>
    </div>
  );
}
