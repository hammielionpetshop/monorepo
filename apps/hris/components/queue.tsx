'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { postJson } from '@/lib/post-json';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { NewBadge } from './ui/new-badge';

/**
 * Jendela antrean berantai (BER-L03, spec F3-1 §3.5). Satu jendela pada satu waktu, tanpa × dan tanpa Esc;
 * tombol OK aktif sesudah jeda pengaturan "Jeda tombol pengingat". Isi dari GET /api/queue.
 */
type QueueItem = { kind: string; title: string; detail: string | null; href: string; tone: 'danger' | null };

type QueueControl = { hold: () => () => void; clockInSent: () => void };

const noop: QueueControl = { hold: () => () => {}, clockInSent: () => {} };
const QueueContext = createContext<QueueControl>(noop);

const CHECK_EVERY_MS = 15 * 60_000;

export function QueueProvider({ holdSeconds, children }: { holdSeconds: number; children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [holds, setHolds] = useState(0);
  const [clockInReleased, setClockInReleased] = useState(false);
  const [countdown, setCountdown] = useState(holdSeconds);
  const [busy, setBusy] = useState(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    try {
      const res = await fetch('/api/queue', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: QueueItem[] };
      setItems(data.items ?? []);
    } catch {
      // Jaringan putus: coba lagi pada pemeriksaan berikutnya.
    }
  }, []);

  // Saat dibuka/dimuat ulang, lalu sesudah pindah halaman bila pemeriksaan terakhir lebih dari 15 menit lalu.
  useEffect(() => {
    if (Date.now() - lastCheck.current >= CHECK_EVERY_MS || lastCheck.current === 0) void check();
  }, [pathname, check]);

  const onClockIn = pathname === '/clock-in' || pathname.startsWith('/clock-in/');
  useEffect(() => {
    if (!onClockIn) setClockInReleased(false);
  }, [onClockIn]);

  // Layar Absen tidak pernah terhalang (TAM-22 butir 2) dan langkah bertahap tidak dipotong (BER-L03).
  const held = holds > 0 || (onClockIn && !clockInReleased);
  const current = held ? null : items[0] ?? null;

  useEffect(() => {
    if (!current) return;
    setCountdown(holdSeconds);
    const timer = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [current?.kind, holdSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  async function acknowledge(item: QueueItem, open: boolean) {
    setBusy(true);
    await postJson('/api/queue/ack', { kind: item.kind });
    setBusy(false);
    setItems((list) => list.filter((row) => row.kind !== item.kind));
    if (!open) return;
    if (/^https?:\/\//.test(item.href)) window.location.href = item.href;
    else router.push(item.href);
  }

  const control = useRef<QueueControl>({
    hold: () => {
      setHolds((n) => n + 1);
      return () => setHolds((n) => Math.max(0, n - 1));
    },
    clockInSent: () => setClockInReleased(true),
  });

  return (
    <QueueContext.Provider value={control.current}>
      {children}
      {current && (
        <Dialog
          open
          dismissible={false}
          onClose={() => {}}
          title={current.title}
          footer={(
            <>
              <Button variant="secondary" disabled={busy} onClick={() => void acknowledge(current, true)}>Buka</Button>
              <Button disabled={busy || countdown > 0} onClick={() => void acknowledge(current, false)}>
                {countdown > 0 ? `OK, sudah baca (${countdown})` : 'OK, sudah baca'}
              </Button>
            </>
          )}
        >
          {current.detail && <p className={current.tone === 'danger' ? 'text-danger-fg' : undefined}>{current.detail}</p>}
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">Pengingat ini muncul sekali sehari sampai urusannya beres. <NewBadge feature="fitur/pengingat-berantai" /></p>
        </Dialog>
      )}
    </QueueContext.Provider>
  );
}

/** Tahan antrean selama `active` (langkah bertahap berjalan); dilepas saat selesai atau layar ditinggalkan. */
export function useQueueHold(active = true) {
  const { hold } = useContext(QueueContext);
  useEffect(() => (active ? hold() : undefined), [active, hold]);
}

/** Dipasang di layar bertahap (server component boleh memakainya): antrean menunggu sampai layar ditinggalkan. */
export function QueueHold() {
  useQueueHold(true);
  return null;
}

/** Layar Absen memanggil ini sesudah absen terkirim: antrean langsung muncul (TAM-22 butir 2). */
export function useQueueClockInSent(): () => void {
  return useContext(QueueContext).clockInSent;
}
