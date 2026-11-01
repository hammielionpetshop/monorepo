'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Row = {
  id: number; startDate: string; endDate: string; branch: string; reason: string; backdated: boolean; cancelled: boolean; cancelReason: string | null;
};

export function ClosuresScreen({ rows, branches, canManage, today }: {
  rows: Row[]; branches: { id: number; name: string }[]; canManage: boolean; today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, success: string, done: () => void) {
    setBusy(true);
    const result = await postJson('/api/attendance', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(success, 'ok');
    done();
    router.refresh();
  }

  const branchName = branchId ? branches.find((branch) => String(branch.id) === branchId)?.name : 'Semua cabang';
  const end = endDate || startDate;

  return (
    <div className="space-y-4">
      {canManage && (
        <Button onClick={() => { setAdding(true); setStep(1); setBranchId(''); setStartDate(''); setEndDate(''); setReason(''); setError(null); }}>
          Pasang hari tutup
        </Button>
      )}
      <DataList
        rows={rows}
        rowKey={(row) => row.id}
        empty="Belum ada hari tutup."
        columns={[
          { key: 'date', header: 'Tanggal', primary: true, render: (row) => (row.startDate === row.endDate ? row.startDate : `${row.startDate} s.d. ${row.endDate}`) },
          { key: 'branch', header: 'Cabang', render: (row) => row.branch },
          { key: 'reason', header: 'Alasan', render: (row) => row.reason },
          {
            key: 'status', header: 'Status', render: (row) => (
              row.cancelled ? <Badge tone="warn">Dibatalkan</Badge> : row.backdated ? <Badge tone="info">Dipasang mundur</Badge> : <Badge tone="ok">Aktif</Badge>
            ),
          },
          {
            key: 'action', header: '', render: (row) => (canManage && !row.cancelled
              ? <Button size="sm" variant="ghost" onClick={() => { setCancelling(row); setCancelReason(''); setError(null); }}>Batalkan</Button> : null),
          },
        ]}
      />

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={`Pasang hari tutup · langkah ${step} dari 3`}
        footer={(
          <>
            {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Button variant="secondary" onClick={() => setAdding(false)}>Batal</Button>}
            {step < 3 ? <Button onClick={() => { setError(null); setStep(step + 1); }}>Lanjut</Button> : (
              <Button loading={busy} onClick={() => send(
                { kind: 'closure', branchId: branchId ? Number(branchId) : null, startDate, endDate: end, reason },
                'Hari tutup terpasang. Orang di cabang itu diberi tahu.', () => setAdding(false),
              )}>Simpan</Button>
            )}
          </>
        )}
      >
        {step === 1 && (
          <div className="space-y-3">
            <Field id="cl-branch" label="Cabang">
              <Select id="cl-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Semua cabang</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </Field>
            <Field id="cl-start" label="Tanggal mulai"><Input id="cl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field id="cl-end" label="Tanggal akhir" hint="Kosongkan bila hanya satu hari."><Input id="cl-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
        )}
        {step === 2 && <Field id="cl-reason" label="Alasan"><Textarea id="cl-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        {step === 3 && (
          <div className="space-y-2 text-sm">
            <p><b>{branchName}</b> tutup <b>{startDate || '-'}</b>{end !== startDate ? ` s.d. ${end}` : ''}.</p>
            <p>Tidak ada yang ditandai alpha, jatah libur tidak berkurang, dan hari itu dibayar.</p>
            {startDate && startDate < today && <Alert tone="warn">Tanggalnya sudah lewat, jadi tercatat sebagai Dipasang mundur.</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        )}
      </Dialog>

      <Dialog
        open={cancelling != null}
        onClose={() => setCancelling(null)}
        title="Batalkan hari tutup"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)}>Kembali</Button>
            <Button loading={busy} onClick={() => cancelling && send(
              { kind: 'closure_cancel', id: cancelling.id, reason: cancelReason }, 'Hari tutup dibatalkan.', () => setCancelling(null),
            )}>Batalkan hari tutup</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field id="cl-cancel" label="Alasan"><Textarea id="cl-cancel" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
