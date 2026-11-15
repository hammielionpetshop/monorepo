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
import { EMERGENCY_STATUS_LABELS } from '../rules/emergency';
import type { EmergencyRow, ReaderRow } from '../server/emergency';
import { whenWib } from './shared';

/** Siapa sudah dan belum baca (BER-L25) + Akhiri sekarang (BER-L24 jalan keluar). */
export function ReadersScreen({ announcement, readers, canEnd }: { announcement: EmergencyRow; readers: ReaderRow[]; canEnd: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = unreadOnly ? readers.filter((row) => !row.readAt) : readers;
  const columns: Column<ReaderRow>[] = [
    { key: 'name', header: 'Nama', primary: true, render: (row) => row.name },
    { key: 'branch', header: 'Cabang', render: (row) => row.branch ?? '—' },
    { key: 'position', header: 'Jabatan', render: (row) => row.position ?? '—' },
    {
      key: 'read', header: 'Sudah baca',
      render: (row) => (row.readAt ? <Badge tone="ok">{whenWib(row.readAt)}</Badge> : <Badge tone="warn">Belum</Badge>),
    },
  ];

  async function end() {
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/announcements/${announcement.id}/end`, { reason });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Gagal mengakhiri.');
    setEnding(false);
    toast('Pengumuman diakhiri. Yang belum membaca tidak lagi mendapat jendelanya.', 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger">Darurat</Badge>
          <Badge tone={announcement.status === 'SHOWING' ? 'warn' : 'info'}>{EMERGENCY_STATUS_LABELS[announcement.status]}</Badge>
        </div>
        <h2 className="text-lg font-semibold">{announcement.title}</h2>
        <p className="whitespace-pre-line text-sm">{announcement.message}</p>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-ink-muted">Sasaran: </dt><dd className="inline">{announcement.targetText}</dd></div>
          <div><dt className="inline text-ink-muted">Dikirim: </dt><dd className="inline">{whenWib(announcement.createdAt)}{announcement.senderName ? ` oleh ${announcement.senderName}` : ''}</dd></div>
          <div><dt className="inline text-ink-muted">Tayang sampai: </dt><dd className="inline">{whenWib(announcement.showsUntil)}</dd></div>
          <div><dt className="inline text-ink-muted">Sudah baca: </dt><dd className="inline font-medium">{announcement.readCount} dari {announcement.recipientCount}</dd></div>
          {announcement.endedAt && (
            <div className="sm:col-span-2"><dt className="inline text-ink-muted">Diakhiri: </dt><dd className="inline">{whenWib(announcement.endedAt)} — {announcement.endReason}</dd></div>
          )}
        </dl>
        {canEnd && <Button variant="danger" onClick={() => { setReason(''); setError(null); setEnding(true); }}>Akhiri sekarang</Button>}
      </Card>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Hanya yang belum baca
      </label>
      <DataList rows={rows} columns={columns} rowKey={(row) => row.employeeId} empty={unreadOnly ? 'Semua sasaran sudah membaca.' : 'Belum ada sasaran.'} />
      <p className="text-xs text-ink-muted">Sasaran dihitung dari penempatan hari ini: orang yang pindah ke cabang/jabatan sasaran ikut menerima selama masih tayang.</p>

      {ending && (
        <Dialog
          open
          onClose={() => setEnding(false)}
          title="Akhiri pengumuman sekarang?"
          footer={(
            <>
              <Button variant="secondary" onClick={() => setEnding(false)} disabled={busy}>Batal</Button>
              <HoldButton variant="danger" loading={busy} onClick={() => void end()}>Akhiri sekarang</HoldButton>
            </>
          )}
        >
          <div className="space-y-3">
            <p>Yang belum membaca tidak lagi mendapat jendelanya. Bila isinya salah, kirim pengumuman darurat baru sesudah ini.</p>
            <Field id="end-reason" label="Alasan">
              <Textarea id="end-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
