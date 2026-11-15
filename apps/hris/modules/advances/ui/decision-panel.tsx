'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { amountProblem, rupiah, splitInstallments } from '../rules/advance';

type Panel = {
  requestId: number; version: number; status: string; number: string; name: string; own: boolean; role: 'APPROVER' | 'REVIEWER';
  requested: { amount: number; installments: number; reason: string };
  review: { amount: number | null; installments: number | null; note: string | null } | null;
  rules: { amountStep: number; amountMin: number; maxInstallments: number; reasonMin: number };
  open: boolean; canAct: boolean; reviewed: boolean;
  helper: { joinedOn: string; tenureMonths: number; running: { number: string; remaining: number }[]; special: { number: string; remaining: number }[]; recent: { status: string; summary: string; at: string }[] };
  owner: { personLeft: number; funds: { monthly: number; weekly: number } } | null;
  estimateNet: number | null;
};

const STATUS = { PENDING: 'Menunggu', REVIEWED: 'Diperiksa', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan', REVOKED: 'Dicabut', EXPIRED: 'Hangus' } as Record<string, string>;

/**
 * DRV-L27 Periksa dan Putuskan Kasbon. Finance: usulan + Sudah diperiksa (tanpa Tolak/Setujui). Pemilik/GM: angka akhir
 * (≤ diajukan) + Setujui / Tolak; boleh tanpa menunggu pemeriksaan (K2).
 */
export function AdvanceDecisionPanel({ data }: { data: Panel }) {
  const router = useRouter();
  const toast = useToast();
  const start = data.role === 'APPROVER' && data.review ? data.review : data.requested;
  const [amount, setAmount] = useState(String(start.amount ?? data.requested.amount));
  const [count, setCount] = useState(String(start.installments ?? data.requested.installments));
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Number(amount || 0);
  const changed = value !== data.requested.amount || Number(count) !== data.requested.installments;

  async function send(kind: 'review' | 'approve' | 'reject') {
    setError(null);
    if (kind !== 'reject') {
      const problem = amountProblem(value, data.rules);
      if (problem) return setError(problem);
      if (value > data.requested.amount) return setError(`Paling banyak sebesar yang diajukan (${rupiah(data.requested.amount)}).`);
      if (changed && note.trim().length < data.rules.reasonMin) return setError(`Angka diubah dari pengajuan: tulis catatan paling sedikit ${data.rules.reasonMin} huruf.`);
    }
    setBusy(true);
    const body = kind === 'reject'
      ? { kind, requestId: data.requestId, version: data.version, reason }
      : { kind, requestId: data.requestId, version: data.version, amount: value, installments: Number(count), note: note.trim() || undefined };
    const result = await postJson('/api/advances', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    setRejecting(false);
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs text-ink-muted">{data.number} · {STATUS[data.status] ?? data.status}</p>
        <h2 className="text-lg font-semibold">{data.role === 'REVIEWER' ? 'Periksa kasbon' : 'Putuskan kasbon'} — {data.name}</h2>
        <p className="text-sm">Diajukan <b className="tabular-nums">{rupiah(data.requested.amount)}</b>, {data.requested.installments} kali potong.</p>
        <p className="text-sm text-ink-muted">Alasan: {data.requested.reason}</p>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">Keterangan pembantu</p>
          <p>Bergabung {data.helper.joinedOn} (± {data.helper.tenureMonths} bulan)</p>
          <p>Kasbon berjalan: {data.helper.running.length ? data.helper.running.map((r) => `${r.number} sisa ${rupiah(r.remaining)}`).join(', ') : 'tidak ada'}</p>
          {data.helper.special.length > 0 && <p>Kasbon Khusus berjalan: {data.helper.special.map((r) => `${r.number} sisa ${rupiah(r.remaining)}`).join(', ')}</p>}
          <p className="text-ink-muted">Pengajuan 6 bulan terakhir: {data.helper.recent.length ? data.helper.recent.map((r) => `${STATUS[r.status] ?? r.status} (${r.at.slice(0, 10)})`).join(', ') : 'tidak ada'}</p>
        </div>
        {data.owner && (
          <div>
            <p className="font-medium">Untuk Pemilik dan GM</p>
            <p>Sisa batas orang ini: <b className="tabular-nums">{rupiah(data.owner.personLeft)}</b></p>
            <p>Sisa Dana Kasbon bulanan {rupiah(data.owner.funds.monthly)} · mingguan {rupiah(data.owner.funds.weekly)}</p>
            <p>Perkiraan bersih slip berikutnya: {data.estimateNet == null ? '—' : rupiah(data.estimateNet)}</p>
            {data.review && (
              <p className="mt-1">Usulan Finance: {rupiah(data.review.amount ?? 0)}, {data.review.installments} kali{data.review.note ? ` — ${data.review.note}` : ''}</p>
            )}
            {!data.reviewed && data.open && <p className="mt-1 text-warn-fg">Belum diperiksa Finance. Boleh tetap diputuskan; kasbonnya ditandai &quot;tanpa pemeriksaan Finance&quot;.</p>}
          </div>
        )}
      </div>

      {data.own && data.open && <Alert>Kasbon ini milik Anda (atau Anda yang mengisikan); diputuskan penyetuju lain.</Alert>}
      {data.canAct && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="dp-amount" label={data.role === 'REVIEWER' ? 'Usulan nominal' : 'Nominal akhir'} hint={`Paling banyak ${rupiah(data.requested.amount)}; kelipatan ${rupiah(data.rules.amountStep)}.`}>
              <Input id="dp-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field id="dp-count" label={data.role === 'REVIEWER' ? 'Usulan kali potong' : 'Kali potong akhir'}>
              <Select id="dp-count" value={count} onChange={(e) => setCount(e.target.value)}>
                {Array.from({ length: data.rules.maxInstallments }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
              </Select>
            </Field>
          </div>
          {value > 0 && <p className="text-sm">Cicilan: <b className="tabular-nums">{splitInstallments(value, Number(count)).map(rupiah).join(' + ')}</b></p>}
          <Field id="dp-note" label="Catatan" hint={changed ? `Wajib, paling sedikit ${data.rules.reasonMin} huruf${data.role === 'APPROVER' ? '; dibaca pengaju' : '; tidak tampil ke karyawan'}.` : 'Boleh kosong bila angka sama dengan pengajuan.'}>
            <Textarea id="dp-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && !rejecting && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            {data.role === 'REVIEWER'
              ? <HoldButton loading={busy} onClick={() => send('review')}>Sudah diperiksa</HoldButton>
              : (
                <>
                  <Button variant="danger" onClick={() => { setReason(''); setError(null); setRejecting(true); }}>Tolak</Button>
                  <HoldButton loading={busy} onClick={() => send('approve')}>Setujui {value ? rupiah(value) : ''}, {count} kali</HoldButton>
                </>
              )}
          </div>
          {data.role === 'REVIEWER' && <p className="text-sm text-ink-muted">Finance tidak menolak dan tidak menyetujui. Kalau menurut Anda sebaiknya ditolak, tulis di catatan.</p>}
        </div>
      )}
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Tolak kasbon">
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Alasan dibaca pengaju. Pengaju boleh Ajukan ulang; syaratnya diperiksa lagi.</p>
          <Field id="dp-reason" label="Alasan"><Textarea id="dp-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>Kembali</Button>
            <Button variant="danger" loading={busy} onClick={() => send('reject')}>Tolak</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
