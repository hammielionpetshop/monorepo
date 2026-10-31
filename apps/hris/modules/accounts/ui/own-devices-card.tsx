'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { APP_LABELS, OUTCOME_LABELS } from '../rules/accounts';
import type { OwnDevices } from '../server/accounts';
import { DateTime, HoldButton, useMutation } from './shared';

/** KAR-L14 Perangkat dan riwayat masuk saya (kartu di Profil saya). */
export function OwnDevicesCard({ devices }: { devices: OwnDevices }) {
  const [confirming, setConfirming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { busy, error, send } = useMutation('/api/accounts/me');
  const others = devices.sessions.filter((s) => !s.current).length;
  const revoke = async () => {
    if (await send({ kind: 'revoke_other_devices' }, 'Perangkat lain dikeluarkan.')) setConfirming(false);
  };
  return (
    <Card>
      <h2 className="mb-2 font-semibold">Perangkat dan riwayat masuk</h2>
      <p className="text-sm text-ink-muted">{devices.sessions.length} perangkat sedang masuk.</p>
      <ul className="mt-2 divide-y divide-line text-sm">
        {devices.sessions.map((s) => (
          <li key={s.sessionId} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="line-clamp-1 break-all">{s.deviceLabel ?? 'Perangkat tidak dikenal'}</span>
              {s.current && <Badge tone="ok">Perangkat ini</Badge>}
            </div>
            <p className="text-xs text-ink-muted">
              {s.apps.map((a) => APP_LABELS[a] ?? a).join(', ') || 'Belum membuka aplikasi'} · masuk <DateTime value={s.createdAt} />
              {s.lastActiveAt && <> · terakhir aktif <DateTime value={s.lastActiveAt} /></>}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {devices.canRevokeOthers && others > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>Keluarkan perangkat lain</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? 'Sembunyikan riwayat masuk' : 'Lihat riwayat masuk 30 hari'}
        </Button>
      </div>
      {showHistory && (
        devices.events.length ? (
          <ul className="mt-2 divide-y divide-line text-sm">
            {devices.events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span><DateTime value={e.at} /> · {APP_LABELS[e.appCode] ?? e.appCode}</span>
                <Badge tone={e.outcome === 'SUCCESS' ? 'ok' : 'danger'}>{OUTCOME_LABELS[e.outcome] ?? e.outcome}</Badge>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-ink-muted">Belum ada catatan masuk 30 hari terakhir.</p>
      )}
      {confirming && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title="Keluarkan perangkat lain"
          footer={<><Button variant="secondary" onClick={() => setConfirming(false)}>Batal</Button><HoldButton variant="danger" loading={busy} onClick={revoke}>Keluarkan</HoldButton></>}
        >
          <p>{others} perangkat lain keluar dari HRIS dan kasir. Perangkat ini tetap masuk.</p>
          {error && <Alert tone="danger">{error}</Alert>}
        </Dialog>
      )}
    </Card>
  );
}
