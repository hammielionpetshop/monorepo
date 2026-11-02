'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';
import { LossSplitTable, type SplitView } from './loss-split-table';

const STATUS = { PENDING: 'Menunggu pengesahan', ACTIVE: 'Berlaku', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' } as const;

/** Kartu pembagian satu kehilangan barang (GAJ-L12 klik baris) + Batalkan (Pemilik/GM, alasan). */
export function LossDetailScreen({ loss, split, canCancel }: {
  loss: {
    id: number; branchName: string; foundOn: string; amount: number; description: string; status: keyof typeof STATUS; requestId: number | null;
    recordedBy: string; approvedBy: string | null; approvedAt: string | null; cancelReason: string | null; period: { start: string; end: string };
  };
  split: SplitView | null;
  canCancel: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'loss_cancel', id: loss.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast('Kehilangan dibatalkan. Yang menanggung diberi tahu.', 'ok');
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <b>{loss.branchName}</b> · ditemukan {longDate(loss.foundOn)} · <b className="tabular-nums">{rupiah(loss.amount)}</b>
          <Badge tone={loss.status === 'ACTIVE' ? 'ok' : loss.status === 'PENDING' ? 'warn' : 'danger'}>{STATUS[loss.status]}</Badge>
        </div>
        <p className="text-sm">{loss.description}</p>
        <p className="text-sm text-ink-muted">Periode {longDate(loss.period.start)} – {longDate(loss.period.end)} · dicatat {loss.recordedBy}{loss.approvedBy ? ` · disahkan ${loss.approvedBy}` : ''}</p>
        {loss.cancelReason && <Alert tone="danger">Dibatalkan: {loss.cancelReason}</Alert>}
        {loss.status === 'PENDING' && loss.requestId && <Link className="underline text-sm" href={`/persetujuan/${loss.requestId}`}>Buka usulannya di Persetujuan</Link>}
        <a className="block underline text-sm" href={`/api/payroll/losses/${loss.id}/attachment`} target="_blank" rel="noreferrer">Lihat foto hasil opname</a>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-medium">Pembagian</h2>
        {split ? <LossSplitTable split={split} amount={loss.amount} /> : <Alert tone="warn">Cabang ini belum punya persen kantor untuk periode itu.</Alert>}
        <p className="text-xs text-ink-muted">Dihitung dari penempatan dan pengaturan terbaru; tersimpan tetap saat slip ditutup.</p>
      </Card>
      <div className="flex gap-2">
        <Link className="underline text-sm" href={`/potongan/kehilangan-barang?periode=${loss.period.start}`}>Kembali ke daftar</Link>
        {canCancel && <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Batalkan</Button>}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Batalkan kehilangan barang"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Kembali</Button><HoldButton variant="danger" loading={busy} disabled={!reason.trim()} onClick={cancel}>Batalkan</HoldButton></>}>
        <div className="space-y-3">
          <p>Kehilangan {rupiah(loss.amount)} di {loss.branchName} tidak jadi dipotong. Catatannya tetap ada.</p>
          <Field id="ld-reason" label="Alasan membatalkan"><Textarea id="ld-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
