'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList, type Column } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { ReaderRow } from '../server/emergency';
import type { RuleRow } from '../server/rules';
import { RuleContent } from './rule-card';
import { whenWib } from './shared';

/** Siapa sudah dan belum baca perubahan aturan (BER-L25) + Ralat dan Tarik. */
export function RuleReadersScreen({ rule, readers, canWithdraw, canCorrect }: { rule: RuleRow; readers: ReaderRow[]; canWithdraw: boolean; canCorrect: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = unreadOnly ? readers.filter((row) => !row.readAt) : readers;
  const columns: Column<ReaderRow>[] = [
    { key: 'name', header: 'Nama', primary: true, render: (row) => row.name },
    { key: 'branch', header: 'Cabang', render: (row) => row.branch ?? '—' },
    { key: 'position', header: 'Jabatan', render: (row) => row.position ?? '—' },
    { key: 'read', header: 'Sudah baca', render: (row) => (row.readAt ? <Badge tone="ok">{whenWib(row.readAt)}</Badge> : <Badge tone="warn">Belum</Badge>) },
  ];

  async function withdraw() {
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/announcements/${rule.id}/withdraw`, { reason });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Gagal menarik.');
    setWithdrawing(false);
    toast('Pengumuman ditarik.', 'ok');
    router.refresh();
  }

  async function correct() {
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/announcements/${rule.id}/correct`, {});
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Gagal membuat ralat.');
    router.push(`/announcements/rules/drafts/${res.data?.draftId}`);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <RuleContent rule={rule} linkBase="/announcements" />
        <p className="text-sm">Sasaran: {rule.targetText} · Sudah baca <strong>{rule.readCount} dari {rule.recipientCount}</strong></p>
        <div className="flex flex-wrap gap-2">
          {canCorrect && <Button variant="secondary" loading={busy && !withdrawing} onClick={() => void correct()}>Ralat</Button>}
          {canWithdraw && <Button variant="danger" onClick={() => { setReason(''); setError(null); setWithdrawing(true); }}>Tarik</Button>}
        </div>
        {error && !withdrawing && <Alert tone="danger">{error}</Alert>}
      </Card>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Hanya yang belum baca
      </label>
      <DataList rows={rows} columns={columns} rowKey={(row) => row.employeeId} empty={unreadOnly ? 'Semua sasaran sudah membaca.' : 'Belum ada sasaran.'} />
      <p className="text-xs text-ink-muted">Sasaran dihitung dari penempatan hari ini: orang yang pindah ke cabang/jabatan sasaran ikut menerima.</p>

      {withdrawing && (
        <Dialog
          open
          onClose={() => setWithdrawing(false)}
          title="Tarik perubahan aturan ini?"
          footer={(
            <>
              <Button variant="secondary" onClick={() => setWithdrawing(false)} disabled={busy}>Batal</Button>
              <HoldButton variant="danger" loading={busy} onClick={() => void withdraw()}>Tarik</HoldButton>
            </>
          )}
        >
          <div className="space-y-3">
            <p>Aturan ini batal sebelum berlaku dan pindah ke Riwayat bertanda Ditarik. Yang sudah membaca tidak diganggu.</p>
            <Field id="withdraw-reason" label="Alasan">
              <Textarea id="withdraw-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
