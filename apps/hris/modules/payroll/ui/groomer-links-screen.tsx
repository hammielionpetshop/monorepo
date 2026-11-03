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
import { rupiah } from '../rules/salary';

type Row = {
  posGroomerId: number; name: string; active: boolean; roles: string;
  linkedTo: { id: number; name: string } | null; notEmployee: string | null;
  waiting: { grooming: number; delivery: number; estimate: number } | null;
  suggestion: { id: number; name: string } | null;
};

/** Pasangkan Groomer & Pengantar (PRD 04 §3.3, spec L4d §9 butir 5 dan 7): nama di kasir → karyawan. Sistem hanya mengusulkan. */
export function GroomerLinksScreen({ rows, people, canManage }: { rows: Row[]; people: { id: number; name: string }[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [linking, setLinking] = useState<Row | null>(null);
  const [unlinking, setUnlinking] = useState<Row | null>(null);
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() { setLinking(null); setUnlinking(null); setChoice(''); setText(''); setError(null); }

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    const result = await postJson('/api/payroll', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    toast(done, 'ok');
    close();
    router.refresh();
  }

  const notEmployee = choice === 'NOT_EMPLOYEE';
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Nama groomer dan pengantar diketik di kasir, bukan akun karyawan. Pasangkan sekali ke karyawan HRIS supaya bonus grooming dan ongkirnya tercatat.
        Bonus untuk nama yang belum dipasangkan menunggu dan tidak hilang. Pilih &quot;Bukan karyawan HRIS&quot; untuk pekerja lepas yang dibayar di luar HRIS.
        {!canManage && ' Hanya Pemilik atau GM yang memasangkan.'}
      </Alert>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.posGroomerId)}
        empty="Belum ada nama groomer di kasir."
        columns={[
          { key: 'name', header: 'Nama di kasir', primary: true, render: (r) => <span>{r.name} <span className="text-ink-muted">({r.roles}){!r.active && ' · nonaktif'}</span></span> },
          { key: 'waiting', header: 'Menunggu', render: (r) => (r.waiting ? <Badge tone="warn">{r.waiting.grooming} grooming · {r.waiting.delivery} ongkir · ±{rupiah(r.waiting.estimate)}</Badge> : '—') },
          {
            key: 'linked', header: 'Karyawan', render: (r) => (r.linkedTo ? <Badge tone="ok">{r.linkedTo.name}</Badge>
              : r.notEmployee ? <span className="text-ink-muted">Bukan karyawan HRIS ({r.notEmployee})</span>
                : r.suggestion ? <span className="text-ink-muted">Usulan: {r.suggestion.name} (nama sama)</span> : 'Belum dipasangkan'),
          },
          {
            key: 'act', header: '', render: (r) => (!canManage ? null : r.linkedTo || r.notEmployee
              ? <Button size="sm" variant="ghost" onClick={() => setUnlinking(r)}>Lepas</Button>
              : <Button size="sm" variant="secondary" onClick={() => { setLinking(r); setChoice(r.suggestion ? String(r.suggestion.id) : ''); }}>Pasangkan</Button>),
          },
        ]}
      />
      {linking && (
        <Dialog open onClose={close} title={`Pasangkan "${linking.name}"`}
          footer={<><Button variant="secondary" onClick={close}>Kembali</Button><Button loading={busy} disabled={!choice || (notEmployee && !text.trim())}
            onClick={() => send({ kind: 'groomer_link', posGroomerId: linking.posGroomerId, employeeId: notEmployee ? null : Number(choice), notEmployee, note: notEmployee ? text : null }, 'Nama kasir dipasangkan.')}>Simpan</Button></>}>
          <div className="space-y-3">
            <Field id="gl-person" label="Karyawan">
              <Select id="gl-person" value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Pilih karyawan</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="NOT_EMPLOYEE">Bukan karyawan HRIS (bonus dibayar di luar HRIS)</option>
              </Select>
            </Field>
            {notEmployee && <Field id="gl-note" label="Keterangan (mis. pekerja lepas)"><Textarea id="gl-note" value={text} onChange={(e) => setText(e.target.value)} /></Field>}
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
      {unlinking && (
        <Dialog open onClose={close} title={`Lepas pasangan "${unlinking.name}"`}
          footer={<><Button variant="secondary" onClick={close}>Kembali</Button><Button variant="danger" loading={busy} disabled={!text.trim()} onClick={() => send({ kind: 'groomer_unlink', posGroomerId: unlinking.posGroomerId, reason: text }, 'Pasangan dilepas.')}>Lepas</Button></>}>
          <div className="space-y-3">
            <p>Bonus yang sudah disahkan tetap atas nama {unlinking.linkedTo?.name ?? 'penerimanya'}. Bonus yang belum disahkan berpindah ke pasangan baru begitu nama ini dipasangkan lagi.</p>
            <Field id="gl-reason" label="Alasan"><Textarea id="gl-reason" value={text} onChange={(e) => setText(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
