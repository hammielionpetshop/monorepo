import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { isLogisticsPath, webOriginsFromEnv } from '@/lib/web-split';
import { currentWeb } from '@/lib/web-split-server';
import { attentionCards, type AttentionCard } from '@/modules/attention';
import { myTripMenuVisible } from '@/modules/logistics';
import { NotificationRow, latestUnread } from '@/modules/notifications';
import { shellSettingsToday } from '@/modules/settings';

export const dynamic = 'force-dynamic';

/**
 * BER-L01 Beranda dasar (spec L2f-1 §5–6). Kartu "Perlu perhatian" dihitung saat dibuka dan hilang sendiri
 * saat urusannya beres; perangkainya `attentionCards` (modul attention).
 */
export default async function HomePage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  // Web Logistik di alamat sendiri (spec F2-7b §4): kartu Logistik hanya di Beranda Logistik, sisanya hanya di HRIS.
  const origins = webOriginsFromEnv();
  const web = await currentWeb();
  const split = !!origins.logistics;
  // Satu perangkai kartu untuk Beranda dan antrean berantai (spec F3-1 §3.1).
  const [{ mine, system }, news] = await Promise.all([attentionCards(actor), latestUnread(session.accountId, 3)]);

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
