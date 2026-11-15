import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { isLogisticsPath, webOriginsFromEnv } from '@/lib/web-split';
import { currentWeb } from '@/lib/web-split-server';
import { hasAction } from '@/modules/access';
import { advanceAttention } from '@/modules/advances';
import { followupAttention, kasirChangeAttention, logisticsAttention, moneyCheckAttention, myTripMenuVisible, openReportCount, pendingNoteCounts, pendingPointCount, returnedGoodsWaiting, selfCashWaitingCount, selfDeliveryAttention, shortHandoverAttention, unrecordedCounts, depositAttention } from '@/modules/logistics';
import { absenceAttention, clarificationAttention, dayOffAttention, overtimeAttention, pendingReviewCount } from '@/modules/attendance';
import { listPromotionQueue } from '@/modules/employees';
import { NotificationRow, latestUnread } from '@/modules/notifications';
import { missingSalaryCount, myPayAttention, objectionAttention, overpayAttention, rupiah, tripWageAttention, unloadingAttention, weeklyPayCard } from '@/modules/payroll';
import { waitingSummary } from '@/modules/requests';
import { shellSettingsToday } from '@/modules/settings';

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
  // Web Logistik di alamat sendiri (spec F2-7b §4): kartu Logistik hanya di Beranda Logistik, sisanya hanya di HRIS.
  const origins = webOriginsFromEnv();
  const web = await currentWeb();
  const split = !!origins.logistics;
  const [waiting, promotion, news, reviews, dayOff, absence, clarify, overtime, missingSalary, myPay, objection, advance, logistics, tripWages, weeklyPay, unloading, overpayLate, followup, pendingStorePoints, openStoreReports, goodsWaiting, pendingNotes, unrecorded, kasirChanged, selfAttention, selfCash, moneyCheck, shortHandover, deposits] = await Promise.all([
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
    weeklyPayCard(actor),
    unloadingAttention(actor),
    overpayAttention(actor),
    followupAttention(actor),
    pendingPointCount(actor),
    openReportCount(actor),
    returnedGoodsWaiting(actor),
    hasAction(actor, 'logistics.delivery_note.decide') ? pendingNoteCounts(actor) : null,
    unrecordedCounts(actor),
    kasirChangeAttention(actor),
    selfDeliveryAttention(actor),
    selfCashWaitingCount(actor),
    moneyCheckAttention(actor),
    shortHandoverAttention(actor),
    depositAttention(actor),
  ]);

  const mine: AttentionCard[] = [];
  if (waiting.count) {
    mine.push({
      key: 'requests', title: `${waiting.count} pengajuan menunggu keputusan`,
      detail: `Paling lama ${days(waiting.oldestDays)}`, href: '/approvals',
    });
  }
  const dueTraining = promotion?.rows.filter((row) => row.promotionDueOn && row.promotionDueOn <= promotion.today).length ?? 0;
  if (dueTraining) {
    mine.push({ key: 'training', title: `${dueTraining} karyawan training menunggu dinilai`, href: '/employees/promotions' });
  }
  if (reviews) {
    mine.push({
      key: 'attendance-review', title: `Absen menunggu tinjauan: ${reviews}`, detail: 'Absen di luar radius belum diputuskan',
      href: '/attendance/review', badge: 'fitur/beranda-tinjau-absen',
    });
  }
  for (const card of dayOff) mine.push({ ...card, badge: 'fitur/beranda-libur' });
  for (const card of absence) mine.push({ ...card, badge: 'fitur/beranda-surat-dokter' });
  for (const card of clarify) mine.push({ ...card, tone: card.key === 'clarify-mine' ? 'danger' : undefined, badge: 'fitur/beranda-perlu-dijelaskan' });
  for (const card of overtime) mine.push({ ...card, badge: 'fitur/beranda-lembur' });
  // Upah minggu ini (spec L7 §4): orang yang punya slip mingguan minggu berjalan.
  if (weeklyPay) mine.push({ key: "weekly-pay", ...weeklyPay, badge: "fitur/beranda-upah-minggu-ini" });
  if (myPay) mine.push({ key: 'my-pay', ...myPay, tone: 'danger', badge: 'fitur/beranda-urusan-gaji' });
  if (objection.mine) mine.push({ key: 'objection-fix', ...objection.mine, badge: 'fitur/beranda-keberatan-slip' });
  // Kasbon (DRV-64, 130): menunggu diperiksa / diputuskan / diberikan.
  if (advance?.waitingReview) mine.push({ key: 'advance-review', title: `${advance.waitingReview} kasbon menunggu diperiksa`, href: '/payroll/advances?tab=periksa', badge: '/payroll/advances' });
  if (advance?.waitingDecision) mine.push({ key: 'advance-decide', title: `${advance.waitingDecision} kasbon menunggu diputuskan`, href: '/payroll/advances?tab=putuskan', badge: '/payroll/advances' });
  if (advance?.toHandOver) {
    mine.push({
      key: 'advance-hand-over', title: `${advance.toHandOver} kasbon disetujui belum diberikan`,
      detail: `Rp${new Intl.NumberFormat('id-ID').format(advance.toHandOverAmount)}`, href: '/payroll/advances?tab=diberikan', badge: '/payroll/advances',
    });
  }
  if (missingSalary) {
    mine.push({
      key: 'salary-missing', title: `${missingSalary} orang belum ada gaji`, detail: 'Slip mereka belum bisa dihitung',
      href: '/payroll?flag=missing', badge: 'fitur/beranda-belum-ada-gaji',
    });
  }
  const system: AttentionCard[] = waiting.overdueAll ? [{
    key: 'overdue', title: `${waiting.overdueAll} pengajuan menunggu lebih dari ${waiting.overdueDays} hari`,
    detail: 'Belum diputuskan penyetujunya', href: '/approvals?tab=all', tone: 'danger',
  }] : [];
  // Kasbon lewat batas waktu memproses (DRV-64, 130): tanda, bukan teguran; tidak ada yang ditolak otomatis.
  if (advance?.late) system.push({ key: 'advance-late', title: `${advance.late} kasbon lewat ${advance.processDays} hari belum diputuskan`, href: '/payroll/advances', tone: 'danger', badge: '/payroll/advances' });
  // Cicilan kasbon menunggu slip mingguan (spec L5 §9 butir 3): bisa dilunasi tunai atau dihapus sampai slip mingguan ada.
  if (advance?.waitingWeekly) system.push({ key: 'advance-weekly', title: `${advance.waitingWeekly} kasbon menunggu slip mingguan`, detail: 'Pindah ke dasar gaji mingguan; cicilannya belum bisa dipotong', href: '/payroll/advances?tab=berjalan', tone: 'danger', badge: 'fitur/kasbon-sesudah-diberikan' });
  // Trip belum Sampai Garasi lewat batas (LOG-31) dan pagar uji mati (LOG-104), spec L6 §4.
  for (const trip of logistics?.hanging ?? []) {
    mine.push({ key: `trip-hanging-${trip.id}`, title: `Trip ${trip.number} belum Sampai Garasi`, detail: `${trip.vehicle}, berangkat ${trip.tripDate}`, href: `/logistics/trips/${trip.id}`, tone: 'danger', badge: 'fitur/beranda-trip' });
  }
  // Tindak lanjut Logistik (spec LT1 §13.3 butir 6, 7): surat jalan Gagal, permintaan bensin, mobil perlu perhatian.
  if (followup?.decide) mine.push({ key: 'notes-decide', title: `${followup.decide} surat jalan perlu keputusan`, detail: 'Kiriman gagal: Kirim ulang atau Batal', href: '/logistics/delivery-notes?tab=NEEDS_DECISION', tone: 'danger', badge: 'fitur/beranda-logistik-tindak-lanjut' });
  // Nota berubah / dibatalkan di kasir sesudah masuk trip (spec LT1 §14.3 butir 5).
  if (kasirChanged) mine.push({ key: 'kasir-changed', title: `${kasirChanged.count} nota berubah di kasir`, detail: 'Sudah di trip: Lepas atau Tetap antar', href: kasirChanged.tripId ? `/logistics/trips/${kasirChanged.tripId}` : '/logistics/delivery-notes?tab=ON_TRIP', tone: 'danger', badge: 'fitur/nota-berubah-kasir' });
  // Antar sendiri (spec LT1 §15.3 butir 5): belum kembali lewat 23.59, Gagal belum diputuskan, tunai belum diterima laci.
  if (selfAttention?.late) mine.push({ key: 'self-late', title: `${selfAttention.late} antar sendiri belum kembali`, detail: 'Lewat 23.59 hari mulainya: Tutup atau Alihkan PJ', href: '/logistics/self-delivery/office?tab=LATE', tone: 'danger', badge: 'fitur/beranda-antar-sendiri' });
  if (selfAttention?.failed) mine.push({ key: 'self-failed', title: `${selfAttention.failed} antar sendiri Gagal perlu keputusan`, detail: 'Kirim ulang atau Batal kirim', href: '/logistics/self-delivery/office?tab=FAILED', tone: 'danger', badge: 'fitur/beranda-antar-sendiri' });
  if (selfAttention?.cashLate) mine.push({ key: 'self-cash-late', title: `${selfAttention.cashLate} tunai antar sendiri belum diterima lewat hari`, href: '/logistics/self-delivery/office?tab=CASH', tone: 'danger', badge: 'fitur/beranda-antar-sendiri' });
  if (selfCash) mine.push({ key: 'self-cash', title: `${selfCash} tunai antar sendiri menunggu diterima`, detail: 'Hitung, masukkan laci, lalu Sudah diterima', href: '/logistics/self-delivery', badge: 'fitur/beranda-antar-sendiri' });
  if (goodsWaiting) mine.push({ key: 'returned-goods', title: `${goodsWaiting} barang kembali belum diterima`, detail: 'Tidak terkirim dan retur yang ikut pulang di truk', href: '/logistics/returned-goods', tone: 'danger', badge: '/logistics/returned-goods' });
  if (pendingNotes?.red) mine.push({ key: 'pending-notes', title: `${pendingNotes.red} surat jalan tertunda terlalu lama`, detail: `Dari ${pendingNotes.total} yang tertunda`, href: '/logistics/delivery-notes/pending', tone: 'danger', badge: 'fitur/logistics-delivery-notes-pending' });
  if (openStoreReports) mine.push({ key: 'store-reports', title: `${openStoreReports} laporan toko belum diputuskan`, detail: 'Potong nota / Retur BO / Tidak dipotong', href: '/logistics/store-reports', tone: 'danger', badge: 'fitur/potong-nota' });
  // Terima Uang (spec LT1 §16.1 butir 8): uang trip belum diperiksa, dan yang sudah diperiksa tapi belum masuk POS > 3 hari.
  if (moneyCheck.waiting) mine.push({ key: 'money-check', title: `${moneyCheck.waiting} uang toko belum diperiksa`, detail: moneyCheck.red ? `${moneyCheck.red} sudah lebih dari 3 hari` : 'Cocokkan uang trip per nota di Terima Uang', href: '/logistics/money-checks', tone: moneyCheck.red ? 'danger' : undefined, badge: '/logistics/money-checks' });
  if (shortHandover.open) mine.push({ key: 'short-handover', title: `${shortHandover.open} kurang serah belum ditindaklanjuti`, detail: `${rupiah(shortHandover.left)}${shortHandover.red ? ` · ${shortHandover.red} lebih dari 3 hari` : ''} · Potongan Lain, ganti tunai, atau tidak dipotong`, href: '/logistics/money-checks?tab=DIFF', tone: shortHandover.red ? 'danger' : undefined, badge: 'fitur/kurang-serah-tindak-lanjut' });
  if (moneyCheck.posRed) mine.push({ key: 'money-check-pos', title: `${moneyCheck.posRed} nota belum masuk POS`, detail: 'Sudah diperiksa lebih dari 3 hari, pelunasan di BO belum tercatat', href: '/logistics/money-checks?tab=DONE', tone: 'danger', badge: '/logistics/money-checks' });
  if (deposits.toCheck) mine.push({ key: 'deposit-check', title: `${deposits.toCheck} titipan toko menunggu diperiksa`, detail: 'Uang lebih bayar / titip saja dari driver', href: '/logistics/money-checks', badge: 'fitur/titipan-toko' });
  if (deposits.toRecord) mine.push({ key: 'deposit-record', title: `${deposits.toRecord} pemakaian titipan belum dicatat di kasir`, detail: 'Catat Pelunasan Piutang di kasir lalu tandai Sudah dicatat', href: '/logistics/cashier-entries', badge: 'fitur/titipan-toko' });
  if (unrecorded.waiting) mine.push({ key: 'note-cuts-unrecorded', title: `${unrecorded.waiting} potong nota / retur belum dicatat di kasir`, detail: unrecorded.red ? `${unrecorded.red} sudah lebih dari 3 hari` : 'Catat di kasir lalu tandai Sudah dicatat', href: '/logistics/cashier-entries', tone: unrecorded.red ? 'danger' : undefined, badge: '/logistics/cashier-entries' });
  if (pendingStorePoints) mine.push({ key: 'store-points', title: `${pendingStorePoints} titik toko menunggu persetujuan`, detail: 'Dipasang driver dari kunjungan', href: '/logistics/stores?tab=titik', badge: 'fitur/titik-toko' });
  if (followup?.fuel) mine.push({ key: 'fuel-wait', title: `${followup.fuel} mobil perlu isi bensin`, detail: 'Dari Laporan Pulang driver', href: '/logistics/fuel', badge: 'fitur/beranda-logistik-tindak-lanjut' });
  if (followup?.condition) mine.push({ key: 'vehicle-attention', title: `${followup.condition} mobil perlu perhatian`, detail: 'Dari Laporan Pulang driver', href: '/logistics/fuel', tone: 'danger', badge: 'fitur/beranda-logistik-tindak-lanjut' });
  if (tripWages?.unrated) mine.push({ key: 'trip-wage-unrated', title: `${tripWages.unrated} upah ritase belum bertarif`, detail: 'Isi tarif pasangannya; upahnya dinilai ulang otomatis', href: '/settings/trip-rates', tone: 'danger', badge: 'fitur/beranda-upah-ritase' });
  if (tripWages?.look) mine.push({ key: 'trip-wage-look', title: `${tripWages.look} upah ritase perlu dilihat`, detail: 'Ikut trip di hari yang bukan hari libur', href: '/payroll/trip-wages?tab=LOOK', badge: 'fitur/beranda-upah-ritase' });
  // Bongkaran (spec L8 §4): belum dibayar (Finance, Pemilik, GM), peserta perlu dilihat (HR), berat berubah (Pemilik, GM).
  if (unloading?.unpaid.count) mine.push({ key: 'unloading-unpaid', title: `${unloading.unpaid.count} Laporan Bongkaran belum dibayar`, detail: `${rupiah(unloading.unpaid.pay)}${unloading.unpaid.oldest ? `, paling lama sejak ${unloading.unpaid.oldest}` : ''}`, href: '/payroll/unloading', tone: 'danger', badge: 'fitur/beranda-bongkaran' });
  if (unloading?.look) mine.push({ key: 'unloading-look', title: `${unloading.look} peserta bongkaran perlu dilihat`, detail: 'Ikut bongkaran di hari yang tercatat izin, sakit, cuti, atau alpha', href: '/payroll/unloading/needs-review', badge: 'fitur/beranda-bongkaran' });
  if (unloading?.weights) mine.push({ key: 'unloading-weights', title: `${unloading.weights} perubahan berat per satuan perlu dilihat`, detail: 'Beda lebih dari ambang', href: '/payroll/unloading/weights?tab=CHANGED', badge: 'fitur/beranda-bongkaran' });
  if (overpayLate) mine.push({ key: 'unloading-overpay', title: `${overpayLate} lebih bayar bongkaran lewat batas`, detail: 'Putuskan: tagih tunai atau hapus', href: '/payroll/unloading?tab=OVERPAY', tone: 'danger', badge: 'fitur/bongkaran-bayar' });
  if (logistics?.fence) system.push({ key: 'fence-off', title: 'Pemeriksaan titik garasi sedang mati', detail: `Menyala lagi sendiri ${logistics.fence.until}`, href: '/logistics/vehicles-routes', tone: 'danger', badge: 'fitur/beranda-trip' });
  // Keberatan slip disetujui lebih dari 2 hari tanpa pembetulan (GAJ-111).
  if (objection.system) system.push({ key: 'objection-late', ...objection.system, tone: 'danger', badge: 'fitur/beranda-keberatan-slip' });

  const forWeb = (cards: AttentionCard[]) => (split ? cards.filter((card) => isLogisticsPath(card.href) === (web === 'logistik')) : cards);
  const mineHere = forWeb(mine);
  const systemHere = forWeb(system);
  // Kotak pintas driver/kenek ke web Logistik (PRD Fase 2 §3).
  const tripShortcut = split && web === 'hris' && actor ? await myTripMenuVisible(actor, (await shellSettingsToday()).today) : false;

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
      <PageHeader title={web === 'logistik' ? 'Beranda Logistik' : 'Beranda'} description="Ringkasan hal yang perlu perhatian Anda." />

      {tripShortcut && (
        <a href={`${origins.logistics}/my-trips`} className="block rounded-card border border-l-4 border-line border-l-brand-600 bg-surface p-4 hover:bg-canvas">
          <p className="flex items-center gap-2 font-medium">Trip Saya hari ini <NewBadge feature="fitur/web-logistik" /></p>
          <p className="text-sm text-ink-muted">Buka web Logistik untuk trip, foto, dan uang toko</p>
        </a>
      )}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">Perlu perhatian saya <NewBadge feature="fitur/beranda-perlu-perhatian" /></h2>
        {mineHere.length ? cardList(mineHere) : (
          <Card><EmptyState title="Tidak ada yang menunggu Anda" /></Card>
        )}
      </section>

      {actor?.fullAccess && (
        <section className="space-y-2">
          <h2 className="font-semibold">Perlu perhatian sistem</h2>
          {systemHere.length ? cardList(systemHere) : <p className="text-sm text-ink-muted">Tidak ada.</p>}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Kabar terbaru</h2>
          <Link href="/notifications" className="text-sm text-brand-700">Lihat semua</Link>
        </div>
        {news.length ? (
          <Card className="p-0 sm:p-0"><div className="divide-y divide-line px-4">{news.map((item) => <NotificationRow key={item.id} item={item} />)}</div></Card>
        ) : <p className="text-sm text-ink-muted">Tidak ada kabar baru.</p>}
      </section>
    </div>
  );
}
