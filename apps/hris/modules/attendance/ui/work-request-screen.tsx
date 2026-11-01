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

type Props = {
  today: string; branches: { id: number; name: string }[]; branchId: number | null; replacementDays: number; presetPick: number | null;
  options: { employeeId: number; name: string; days: { pickId: number; date: string; label: string }[] }[];
  rows: { id: number; workDate: string; name: string; by: string; reason: string; status: string; statusLabel: string; replacement: string; cancellable: boolean }[];
};

/** KEH-L29 Minta Masuk di Hari Libur: 3 langkah; orangnya menekan Siap masuk, tanpa Tolak (KEH-137). */
export function WorkRequestScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const preset = props.options.find((row) => row.days.some((day) => day.pickId === props.presetPick));
  const [open, setOpen] = useState(Boolean(preset));
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState(preset ? String(preset.employeeId) : '');
  const [pickId, setPickId] = useState(preset ? String(props.presetPick) : '');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const person = props.options.find((row) => String(row.employeeId) === employeeId);
  const day = person?.days.find((row) => String(row.pickId) === pickId);

  async function send(body: Record<string, unknown>, message: string, done: () => void) {
    setBusy(true);
    const result = await postJson('/api/attendance/days-off', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    toast(message, 'ok');
    done();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {props.branches.length > 1 && (
          <Field id="wr-branch" label="Cabang">
            <Select id="wr-branch" value={props.branchId ?? ''} onChange={(e) => router.push(`/kehadiran/minta-masuk?branch=${e.target.value}`)}>
              {props.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
        )}
        <Button disabled={!props.options.length} onClick={() => { setOpen(true); setStep(1); setEmployeeId(''); setPickId(''); setReason(''); setError(null); }}>
          Minta masuk
        </Button>
      </div>
      {!props.options.length && <Alert tone="info">Belum ada libur berlaku 45 hari ke depan di lingkup Anda.</Alert>}

      <DataList
        rows={props.rows}
        rowKey={(row) => row.id}
        empty="Belum ada permintaan masuk."
        columns={[
          { key: 'date', header: 'Tanggal', primary: true, render: (row) => row.workDate },
          { key: 'name', header: 'Orang', render: (row) => row.name },
          { key: 'by', header: 'Peminta', render: (row) => row.by },
          { key: 'reason', header: 'Alasan', render: (row) => row.reason },
          { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'CANCELLED' ? 'warn' : row.status === 'READY' ? 'ok' : 'info'}>{row.statusLabel}</Badge> },
          { key: 'rep', header: 'Pengganti', render: (row) => row.replacement },
          {
            key: 'act', header: '', render: (row) => (row.cancellable
              ? <Button size="sm" variant="ghost" onClick={() => { setCancelling(row.id); setReason(''); setError(null); }}>Batalkan</Button> : null),
          },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Minta masuk · langkah ${step} dari 3`}
        footer={(
          <>
            {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>}
            {step < 3 ? <Button disabled={step === 1 && !day} onClick={() => setStep(step + 1)}>Lanjut</Button> : (
              <Button loading={busy} onClick={() => send({ action: 'work_request', pickId: Number(pickId), reason }, 'Permintaan terkirim. Orangnya diberi tahu.', () => setOpen(false))}>Kirim</Button>
            )}
          </>
        )}
      >
        {step === 1 && (
          <div className="space-y-3">
            <Field id="wr-person" label="Orang">
              <Select id="wr-person" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setPickId(''); }}>
                <option value="">Pilih</option>
                {props.options.map((row) => <option key={row.employeeId} value={row.employeeId}>{row.name}</option>)}
              </Select>
            </Field>
            {person && (
              <Field id="wr-day" label="Tanggal liburnya">
                <Select id="wr-day" value={pickId} onChange={(e) => setPickId(e.target.value)}>
                  <option value="">Pilih</option>
                  {person.days.map((row) => <option key={row.pickId} value={row.pickId}>{row.label}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}
        {step === 2 && <Field id="wr-reason" label="Alasan"><Textarea id="wr-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        {step === 3 && person && day && (
          <div className="space-y-2">
            <p><b>{person.name}</b> diminta masuk <b>{day.label}</b>.</p>
            <p className="text-ink-muted">
              Ia diberi tahu dan menekan Siap masuk; tidak ada tombol Tolak. Tombol Masuk aktif pada tanggal itu. Bila jabatannya berhak,
              dibayar 1 gaji harian (dihitung modul Gaji). Sesudah masuk, ia memilih libur pengganti dalam {props.replacementDays} hari.
            </p>
          </div>
        )}
        {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      </Dialog>

      <Dialog
        open={cancelling != null}
        onClose={() => setCancelling(null)}
        title="Batalkan permintaan masuk"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)}>Kembali</Button>
            <Button loading={busy} onClick={() => cancelling && send({ action: 'work_cancel', id: cancelling, reason }, 'Permintaan dibatalkan. Hari itu tetap libur.', () => setCancelling(null))}>
              Batalkan permintaan
            </Button>
          </>
        )}
      >
        <Field id="wr-cancel" label="Alasan"><Textarea id="wr-cancel" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      </Dialog>
    </div>
  );
}
