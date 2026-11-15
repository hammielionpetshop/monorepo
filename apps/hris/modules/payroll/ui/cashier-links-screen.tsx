'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Row = {
  posUserId: number; name: string; username: string | null; active: boolean; hasShortages: boolean;
  linkedTo: { id: number; name: string } | null; suggestion: { id: number; name: string; via: string } | null;
};

/** Tautan Akun Kasir (spec L4c §9 butir 6): akun POS → karyawan. Sistem hanya mengusulkan, HR yang memasang. */
export function CashierLinksScreen({ rows, people, canManage }: { rows: Row[]; people: { id: number; name: string }[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [linking, setLinking] = useState<Row | null>(null);
  const [unlinking, setUnlinking] = useState<Row | null>(null);
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() { setLinking(null); setUnlinking(null); setChoice(''); setReason(''); setError(null); }

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    const result = await postJson('/api/payroll', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    toast(done, 'ok');
    close();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">Satu orang boleh punya beberapa akun kasir (mis. akun per cabang). Minus akun yang belum ditautkan menunggu dan tidak hilang; begitu ditautkan, ikut usulan berikutnya.</Alert>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.posUserId)}
        empty="Belum ada akun kasir."
        columns={[
          { key: 'name', header: 'Akun kasir', primary: true, render: (r) => <span>{r.name}{r.username ? <span className="text-ink-muted"> ({r.username})</span> : null}{!r.active && <span className="text-ink-muted"> · nonaktif</span>}</span> },
          { key: 'used', header: 'Minus/lebih', render: (r) => (r.hasShortages ? <Badge tone="warn">Ada</Badge> : '—') },
          { key: 'linked', header: 'Karyawan', render: (r) => (r.linkedTo ? <Badge tone="ok">{r.linkedTo.name}</Badge> : r.suggestion ? <span className="text-ink-muted">Usulan: {r.suggestion.name} ({r.suggestion.via})</span> : 'Belum ditautkan') },
          {
            key: 'act', header: '', render: (r) => (!canManage ? null : r.linkedTo
              ? <Button size="sm" variant="ghost" onClick={() => setUnlinking(r)}>Lepas</Button>
              : <Button size="sm" variant="secondary" onClick={() => { setLinking(r); setChoice(r.suggestion ? String(r.suggestion.id) : ''); }}>Tautkan</Button>),
          },
        ]}
      />
      {linking && (
        <Dialog open onClose={close} title={`Tautkan akun ${linking.name}`}
          footer={<><Button variant="secondary" onClick={close}>Kembali</Button><Button loading={busy} disabled={!choice} onClick={() => send({ kind: 'cashier_link', posUserId: linking.posUserId, employeeId: Number(choice) }, 'Akun kasir ditautkan.')}>Tautkan</Button></>}>
          <div className="space-y-3">
            <Field id="cl-person" label="Karyawan">
              <Select id="cl-person" value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Pilih karyawan</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
      {unlinking && (
        <Dialog open onClose={close} title={`Lepas tautan ${unlinking.name}`}
          footer={<><Button variant="secondary" onClick={close}>Kembali</Button><Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => send({ kind: 'cashier_unlink', posUserId: unlinking.posUserId, reason }, 'Tautan dilepas.')}>Lepas</Button></>}>
          <div className="space-y-3">
            <p>Minus yang sudah masuk usulan tetap atas nama {unlinking.linkedTo?.name}. Baris baru menunggu tautan baru.</p>
            <Field id="cl-reason" label="Alasan"><Textarea id="cl-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
