'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { addDays } from '../rules/schedule';

type Branch = {
  id: number; name: string; latitude: number | null; longitude: number | null; radius: number; radiusLatestId: number | null;
  radiusHistory: { id: number; meters: number; effectiveFrom: string }[]; qr: string | null; qrCreatedAt: string | null;
};

export function LocationScreen({ branches, canManageQr, canUpdateRadius, canEditPoint, today }: {
  branches: Branch[]; canManageQr: boolean; canUpdateRadius: boolean; canEditPoint: boolean; today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [qrTarget, setQrTarget] = useState<Branch | null>(null);
  const [radiusTarget, setRadiusTarget] = useState<Branch | null>(null);
  const [meters, setMeters] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    if (!qrTarget) return;
    setBusy(true);
    const result = await postJson('/api/attendance', { kind: 'qr', branchId: qrTarget.id });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membuat QR.');
    toast('QR baru dibuat. Cetak dan tempel sekarang.', 'ok');
    setQrTarget(null);
    router.refresh();
  }

  async function saveRadius() {
    if (!radiusTarget) return;
    setBusy(true);
    const result = await postJson('/api/settings', {
      kind: 'set', key: 'attendance.radius_m', targetKind: 'BRANCH', targetId: radiusTarget.id, value: Number(meters),
      effectiveFrom, reason, expectedLatestId: radiusTarget.radiusLatestId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Radius baru berlaku mulai ${effectiveFrom}.`, 'ok');
    setRadiusTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {branches.map((branch) => (
        <Card key={branch.id}>
          <h2 className="font-semibold">{branch.name}</h2>
          <div className="mt-2 space-y-1 text-sm">
            {branch.latitude != null ? (
              <p>
                Titik: {branch.latitude}, {branch.longitude}{' '}
                <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`}>Buka di Google Maps</a>
              </p>
            ) : <Alert tone="warn">Cabang ini belum punya titik. Absen di cabang ini belum bisa dipakai.</Alert>}
            <p>Radius: <b>{branch.radius} meter</b></p>
            {branch.radiusHistory.length > 0 && (
              <ul className="text-xs text-ink-muted">
                {branch.radiusHistory.map((row) => <li key={row.id}>{row.meters} meter mulai {row.effectiveFrom}</li>)}
              </ul>
            )}
            <p>QR: {branch.qr ? <Badge tone="ok">Aktif sejak {branch.qrCreatedAt?.slice(0, 10)}</Badge> : <Badge tone="warn">Belum ada</Badge>}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canEditPoint && <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href="/pengaturan/organisasi">Ubah titik</Link>}
            {canUpdateRadius && (
              <Button size="sm" variant="secondary" onClick={() => {
                setRadiusTarget(branch); setMeters(String(branch.radius)); setEffectiveFrom(addDays(today, 1)); setReason(''); setError(null);
              }}>Ubah radius</Button>
            )}
            {canManageQr && branch.qr && <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={`/kehadiran/qr/cetak?branch=${branch.id}`}>Cetak QR</Link>}
            {canManageQr && (
              <Button size="sm" variant={branch.qr ? 'ghost' : 'primary'} onClick={() => { setQrTarget(branch); setError(null); }}>
                {branch.qr ? 'Buat ulang QR' : 'Buat QR'}
              </Button>
            )}
          </div>
        </Card>
      ))}

      <Dialog
        open={qrTarget != null}
        onClose={() => setQrTarget(null)}
        title={`${qrTarget?.qr ? 'Buat ulang' : 'Buat'} QR ${qrTarget?.name ?? ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setQrTarget(null)}>Kembali</Button>
            {qrTarget?.qr
              ? <HoldButton key={qrTarget.id} variant="danger" loading={busy} onClick={regenerate}>Buat ulang</HoldButton>
              : <Button loading={busy} onClick={regenerate}>Buat QR</Button>}
          </>
        )}
      >
        <div className="space-y-3 text-sm">
          {qrTarget?.qr ? <p>QR lama tidak bisa dipakai lagi; cetak dan tempel yang baru sekarang.</p> : <p>Sesudah dibuat, cetak dan tempel di cabang.</p>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>

      <Dialog
        open={radiusTarget != null}
        onClose={() => setRadiusTarget(null)}
        title={`Ubah radius ${radiusTarget?.name ?? ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRadiusTarget(null)}>Kembali</Button>
            <Button loading={busy} onClick={saveRadius}>Simpan</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field id="rad-m" label="Radius (meter)" hint="10 sampai 1000. Pemilik dan GM lain diberi tahu."><Input id="rad-m" inputMode="numeric" value={meters} onChange={(e) => setMeters(e.target.value)} /></Field>
          <Field id="rad-from" label="Berlaku mulai" hint="Paling cepat besok."><Input id="rad-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></Field>
          <Field id="rad-reason" label="Alasan"><Textarea id="rad-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
