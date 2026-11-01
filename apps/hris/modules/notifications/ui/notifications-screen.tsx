'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { postJson } from '@/lib/post-json';
import type { NotificationItem } from '../server/notify';

const timeFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
});

export function formatWhen(iso: string) {
  return timeFormat.format(new Date(iso));
}

/** Satu baris kabar: menekan membuka urusannya dan menandainya terbaca. */
export function NotificationRow({ item }: { item: NotificationItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    const result = await postJson('/api/notifications', { kind: 'read', id: item.id });
    setBusy(false);
    const link = (result.data?.link as string | null | undefined) ?? item.link;
    if (link) router.push(link);
    else router.refresh();
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="flex w-full items-start gap-3 py-3 text-left hover:bg-canvas disabled:opacity-60"
    >
      <span
        aria-label={item.read ? undefined : 'Belum dibaca'}
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-brand-600')}
      />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', !item.read && 'font-semibold')}>{item.title}</span>
        {item.body && <span className="block text-sm text-ink-muted">{item.body}</span>}
        <span className="block text-xs text-ink-muted">{formatWhen(item.createdAt)}</span>
      </span>
    </button>
  );
}

/** BER-L02 Pemberitahuan: tidak ada tombol hapus; lebih dari 90 hari dibuang mesin. */
export function NotificationsScreen({ items, hasMore, page, unread }: {
  items: NotificationItem[]; hasMore: boolean; page: number; unread: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markAll() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/notifications', { kind: 'read_all' });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menandai.');
    toast('Semua pemberitahuan ditandai terbaca.', 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{unread ? `${unread} belum dibaca` : 'Semua sudah dibaca'}</p>
        {unread > 0 && <Button size="sm" variant="secondary" loading={busy} onClick={markAll}>Tandai semua terbaca</Button>}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {items.length === 0 ? (
        <EmptyState title="Belum ada pemberitahuan">Kabar tentang pengajuan dan akun Anda akan muncul di sini.</EmptyState>
      ) : (
        <Card className="p-0 sm:p-0">
          <div className="divide-y divide-line px-4">
            {items.map((item) => <NotificationRow key={item.id} item={item} />)}
          </div>
        </Card>
      )}
      <div className="flex justify-between">
        {page > 1 ? <Link className="text-sm text-brand-700" href={`/pemberitahuan?page=${page - 1}`}>← Lebih baru</Link> : <span />}
        {hasMore && <Link className="text-sm text-brand-700" href={`/pemberitahuan?page=${page + 1}`}>Lebih lama →</Link>}
      </div>
    </div>
  );
}
