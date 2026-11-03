import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { hasAction } from '@/modules/access';
import { advanceAttention } from '@/modules/advances';
import { logisticsAttention } from '@/modules/logistics';
import { absenceAttention, clarificationAttention, dayOffAttention, overtimeAttention, pendingReviewCount } from '@/modules/attendance';
import { listPromotionQueue } from '@/modules/employees';
import { NotificationRow, latestUnread } from '@/modules/notifications';
import { missingSalaryCount, myPayAttention, objectionAttention, tripWageAttention } from '@/modules/payroll';
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
  const [waiting, promotion, news, reviews, dayOff, absence, clarify, overtime, missingSalary, myPay, objection, advance, logistics, tripWages] = await Promise.all([
    waitingSummary(actor),
    hasAction(actor, 'training_promotion.decide') ? listPromotionQueue(actor) : null,
    latestUnread(session.accountId, 3),
    pendingReviewCount(actor),
    dayOffAttention(actor),
    absenceAttention(actor),
    clarificationAttention(actor),
    overtimeAttention(actor),
    missingSalaryCount(actor),
    myPayAttention(actor),
    objectionAttention(actor),
    advanceAttention(actor),
    logisticsAttention(actor),
    tripWageAttention(actor),
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
  for (const card of dayOff) mine.push({ ...card, badge: 'fitur/beranda-libur' });
  for (const card of absence) mine.push({ ...card, badge: 'fitur/beranda-surat-dokter' });
  for (const card of clarify) mine.push({ ...card, tone: card.key === 'clarify-mine' ? 'danger' : undefined, badge: 'fitur/beranda-perlu-dijelaskan' });
  for (const card of overtime) mine.push({ ...card, badge: 'fitur/beranda-lembur' });
  if (myPay) mine.push({ key: 'my-pay', ...myPay, tone: 'danger', badge: 'fitur/beranda-urusan-gaji' });
  if (objection.mine) mine.push({ key: 'objection-fix', ...objection.mine, badge: 'fitur/beranda-keberatan-slip' });
  // Kasbon (DRV-64, 130): menunggu diperiksa / diputuskan / diberikan.
  if (advance?.waitingReview) mine.push({ key: 'advance-review', title: `${advance.waitingReview} kasbon menunggu diperiksa`, href: '/gaji/kasbon?tab=periksa', badge: '/gaji/kasbon' });
  if (advance?.waitingDecision) mine.push({ key: 'advance-decide', title: `${advance.waitingDecision} kasbon menunggu diputuskan`, href: '/gaji/kasbon?tab=putuskan', badge: '/gaji/kasbon' });
  if (advance?.toHandOver) {
    mine.push({
      key: 'advance-hand-over', title: `${advance.toHandOver} kasbon disetujui belum diberikan`,
      detail: `Rp${new Intl.NumberFormat('id-ID').format(advance.toHandOverAmount)}`, href: '/gaji/kasbon?tab=diberikan', badge: '/gaji/kasbon',
    });
  }
  if (missingSalary) {
    mine.push({
      key: 'salary-missing', title: `${missingSalary} orang belum ada gaji`, detail: 'Slip mereka belum bisa dihitung',
      href: '/gaji?flag=missing', badge: 'fitur/beranda-belum-ada-gaji',
    });
  }
  const system: AttentionCard[] = waiting.overdueAll ? [{
    key: 'overdue', title: `${waiting.overdueAll} pengajuan menunggu lebih dari ${waiting.overdueDays} hari`,
    detail: 'Belum diputuskan penyetujunya', href: '/persetujuan?tab=all', tone: 'danger',
  }] : [];
  // Kasbon lewat batas waktu memproses (DRV-64, 130): tanda, bukan teguran; tidak ada yang ditolak otomatis.
  if (advance?.late) system.push({ key: 'advance-late', title: `${advance.late} kasbon lewat ${advance.processDays} hari belum diputuskan`, href: '/gaji/kasbon', tone: 'danger', badge: '/gaji/kasbon' });
  // Cicilan kasbon menunggu slip mingguan (spec L5 §9 butir 3): bisa dilunasi tunai atau dihapus sampai slip mingguan ada.
  if (advance?.waitingWeekly) system.push({ key: 'advance-weekly', title: `${advance.waitingWeekly} kasbon menunggu slip mingguan`, detail: 'Pindah ke dasar gaji mingguan; cicilannya belum bisa dipotong', href: '/gaji/kasbon?tab=berjalan', tone: 'danger', badge: 'fitur/kasbon-sesudah-diberikan' });
  // Trip belum Sampai Garasi lewat batas (LOG-31) dan pagar uji mati (LOG-104), spec L6 §4.
  for (const trip of logistics?.hanging ?? []) {
    mine.push({ key: `trip-hanging-${trip.id}`, title: `Trip ${trip.number} belum Sampai Garasi`, detail: `${trip.vehicle}, berangkat ${trip.tripDate}`, href: `/logistik/trip/${trip.id}`, tone: 'danger', badge: 'fitur/beranda-trip' });
  }
  if (tripWages?.unrated) mine.push({ key: 'trip-wage-unrated', title: `${tripWages.unrated} upah ritase belum bertarif`, detail: 'Isi tarif pasangannya; upahnya dinilai ulang otomatis', href: '/pengaturan/tarif-ritase', tone: 'danger', badge: 'fitur/beranda-upah-ritase' });
  if (tripWages?.look) mine.push({ key: 'trip-wage-look', title: `${tripWages.look} upah ritase perlu dilihat`, detail: 'Ikut trip di hari yang bukan hari libur', href: '/gaji/upah-ritase?tab=LOOK', badge: 'fitur/beranda-upah-ritase' });
  if (logistics?.fence) system.push({ key: 'fence-off', title: 'Pemeriksaan titik garasi sedang mati', detail: `Menyala lagi sendiri ${logistics.fence.until}`, href: '/logistik/mobil-rute', tone: 'danger', badge: 'fitur/beranda-trip' });
  // Keberatan slip disetujui lebih dari 2 hari tanpa pembetulan (GAJ-111).
  if (objection.system) system.push({ key: 'objection-late', ...objection.system, tone: 'danger', badge: 'fitur/beranda-keberatan-slip' });

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
