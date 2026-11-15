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
 * Pengumuman darurat (spec F3-2 §3.4) selalu paling depan, diperiksa tiap menit, dan tidak ditahan langkah bertahap.
 */
type QueueItem = { kind: string; title: string; detail: string | null; href: string; tone: 'danger' | null };
type EmergencyItem = { id: number; title: string; message: string; senderName: string | null; createdAt: string };

type QueueControl = { hold: () => () => void; clockInSent: () => void };

const noop: QueueControl = { hold: () => () => {}, clockInSent: () => {} };
const QueueContext = createContext<QueueControl>(noop);

const CHECK_EVERY_MS = 15 * 60_000;
const EMERGENCY_EVERY_MS = 60_000;
const sentAt = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

export function QueueProvider({ holdSeconds, children }: { holdSeconds: number; children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [emergencyHold, setEmergencyHold] = useState(5);
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
      const data = (await res.json()) as { items?: QueueItem[]; emergencies?: EmergencyItem[]; emergencyHoldSeconds?: number | null };
      setItems(data.items ?? []);
      setEmergencies(data.emergencies ?? []);
      if (data.emergencyHoldSeconds) setEmergencyHold(data.emergencyHoldSeconds);
    } catch {
      // Jaringan putus: coba lagi pada pemeriksaan berikutnya.
    }
  }, []);

  // Darurat saja: satu query ringan. Yang diakhiri/berakhir hilang dari daftar, jadi jendelanya ikut tertutup.
  const checkEmergency = useCallback(async () => {
    try {
      const res = await fetch('/api/queue?only=emergency', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { emergencies?: EmergencyItem[]; emergencyHoldSeconds?: number | null };
      setEmergencies(data.emergencies ?? []);
      if (data.emergencyHoldSeconds) setEmergencyHold(data.emergencyHoldSeconds);
    } catch {
      // Jaringan putus: coba lagi menit berikutnya.
    }
  }, []);

  // Tiap 1 menit selama tab terlihat; saat tab kembali terlihat langsung diperiksa (spec F3-2 §3.4).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void checkEmergency();
    }, EMERGENCY_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void checkEmergency(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [checkEmergency]);

  // Saat dibuka/dimuat ulang, lalu sesudah pindah halaman bila pemeriksaan terakhir lebih dari 15 menit lalu.
  useEffect(() => {
    if (Date.now() - lastCheck.current >= CHECK_EVERY_MS || lastCheck.current === 0) void check();
  }, [pathname, check]);

  const onClockIn = pathname === '/clock-in' || pathname.startsWith('/clock-in/');
  useEffect(() => {
    if (!onClockIn) setClockInReleased(false);
  }, [onClockIn]);

  // Layar Absen tidak pernah terhalang (TAM-22 butir 2), juga oleh darurat (keputusan owner F3-2 §9 butir 3).
  // Langkah bertahap tidak dipotong pengingat tugas (BER-L03), tetapi darurat tetap muncul di atasnya.
  const clockInHeld = onClockIn && !clockInReleased;
  const emergency = clockInHeld ? null : emergencies[0] ?? null;
  const held = holds > 0 || clockInHeld;
  const current = held || emergency ? null : items[0] ?? null;
  const shownKey = emergency ? `emergency:${emergency.id}` : current?.kind ?? null;

  useEffect(() => {
    if (!shownKey) return;
    setCountdown(emergency ? emergencyHold : holdSeconds);
    const timer = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [shownKey, holdSeconds, emergencyHold]); // eslint-disable-line react-hooks/exhaustive-deps

  async function readEmergency(item: EmergencyItem) {
    setBusy(true);
    // Gagal karena sudah tidak tayang tetap ditutup; galat jaringan membiarkan jendela supaya dicoba lagi.
    const res = await postJson(`/api/announcements/${item.id}/read`, {});
    setBusy(false);
    if (!res.ok && res.error?.includes('jaringan')) return;
    setEmergencies((list) => list.filter((row) => row.id !== item.id));
  }

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
      {emergency && (
        <Dialog
          open
          dismissible={false}
          onClose={() => {}}
          title={emergency.title}
          footer={(
            <Button variant="danger" disabled={busy || countdown > 0} onClick={() => void readEmergency(emergency)}>
              {countdown > 0 ? `Sudah saya baca (${countdown})` : 'Sudah saya baca'}
            </Button>
          )}
        >
          <p className="mb-2 flex items-center gap-2">
            <span className="inline-flex rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold text-danger-fg">Darurat</span>
            <NewBadge feature="fitur/pengumuman-darurat" />
          </p>
          <p className="whitespace-pre-line text-base">{emergency.message}</p>
          <p className="mt-3 text-xs text-ink-muted">
            {emergency.senderName ? `Dari ${emergency.senderName} · ` : ''}{sentAt(emergency.createdAt)}
            {emergencies.length > 1 ? ` · ${emergencies.length - 1} pengumuman darurat lagi` : ''}
          </p>
        </Dialog>
      )}
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
