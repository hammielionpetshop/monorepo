'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, monthlyTotal, rupiah } from '../rules/salary';

type Kind = 'TRAINING' | 'EMPLOYEE';
type Pkg = {
  kind: Kind; label: string;
  current: { from: string; total: number; lines: { name: string; amount: number }[] } | null;
  history: {
    id: number; from: string; total: number; cancelled: boolean; cancelReason: string | null; reason: string; by: string; at: string; state: string;
    lines: { componentTypeId: number; name: string; amount: number }[];
  }[];
};

const STATE: Record<string, { tone: 'ok' | 'info' | 'warn'; label: string } | undefined> = {
  ACTIVE: { tone: 'ok', label: 'Berlaku' }, SCHEDULED: { tone: 'info', label: 'Terjadwal' }, CANCELLED: { tone: 'warn', label: 'Diganti / dibatalkan' },
};

/** GAJ-L05 Gaji Standar: dua paket acuan. Mengubahnya tidak mengubah gaji siapa pun (GAJ-03, 64). */
export function StandardsScreen({ packages, types, choices, canManage, peopleCount }: {
  packages: Pkg[]; types: { id: number; name: string }[]; choices: { from: string; label: string }[]; canManage: boolean; peopleCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Kind | null>(null);
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState('');
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(pkg: Pkg) {
    const latest = pkg.history.find((h) => !h.cancelled);
    setAmounts(Object.fromEntries((latest?.lines ?? []).map((l) => [l.componentTypeId, String(l.amount)])));
    setEditing(pkg.kind); setStep(1); setFrom(''); setReason(''); setError(null);
  }

  const lines = Object.entries(amounts).filter(([, v]) => v !== '' && Number(v) > 0).map(([id, v]) => ({ componentTypeId: Number(id), amount: Number(v) }));
  const label = packages.find((p) => p.kind === editing)?.label ?? '';

  async function save() {
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'standard_save', standardKind: editing, effectiveFrom: from, lines, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`${label} mulai ${longDate(from)} tersimpan. Gaji orang yang sudah ada tidak berubah.`, 'ok');
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">Gaji Standar hanya isian awal untuk orang baru dan untuk Training yang naik menjadi Karyawan (dijadwalkan otomatis saat promosi disetujui). Mengubahnya tidak mengubah gaji siapa pun.</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        {packages.map((pkg) => (
          <Card key={pkg.kind} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{pkg.label}</h2>
              {canManage && <Button size="sm" onClick={() => open(pkg)}>Ubah</Button>}
            </div>
            {pkg.current ? (
              <dl className="space-y-1 text-sm">
                {pkg.current.lines.map((l) => <div key={l.name} className="flex justify-between"><dt className="text-ink-muted">{l.name}</dt><dd className="tabular-nums">{rupiah(l.amount)}</dd></div>)}
                <div className="flex justify-between border-t border-line pt-1 font-medium"><dt>Jumlah</dt><dd className="tabular-nums">{rupiah(pkg.current.total)}</dd></div>
                <p className="text-ink-muted">Berlaku sejak {longDate(pkg.current.from)}</p>
              </dl>
            ) : <Alert tone="warn" title="Belum diisi">Paket ini belum punya isi yang berlaku.</Alert>}
            {pkg.history.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-muted">Riwayat ({pkg.history.length})</summary>
                <ul className="mt-2 space-y-2">
                  {pkg.history.map((h) => (
                    <li key={h.id} className="rounded-card border border-line p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <b>Mulai {longDate(h.from)}</b> · <span className="tabular-nums">{rupiah(h.total)}</span>
                        {STATE[h.state] && <Badge tone={STATE[h.state]!.tone}>{STATE[h.state]!.label}</Badge>}
                      </div>
                      <p>{h.lines.map((l) => `${l.name} ${rupiah(l.amount)}`).join(' · ')}</p>
                      <p className="text-ink-muted">{h.reason} · {h.by} · {h.at}{h.cancelReason ? ` · ${h.cancelReason}` : ''}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </div>

      <Dialog
        open={editing != null}
        onClose={() => setEditing(null)}
        title={`${label} · langkah ${step} dari 3`}
        footer={(
          <>
            {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Button variant="secondary" onClick={() => setEditing(null)}>Batal</Button>}
            {step < 3 ? (
              <Button onClick={() => {
                setError(null);
                if (step === 1 && (!from || !lines.length)) return setError('Pilih mulai berlaku dan isi paling sedikit satu komponen.');
                setStep(step + 1);
              }}>Lanjut</Button>
            ) : <HoldButton loading={busy} onClick={save}>Simpan</HoldButton>}
          </>
        )}
      >
        {step === 1 && (
          <div className="space-y-3">
            <Field id="st-from" label="Mulai berlaku">
              <Select id="st-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">Pilih periode</option>
                {choices.map((c) => <option key={c.from} value={c.from}>{c.label}</option>)}
              </Select>
            </Field>
            {types.map((t) => (
              <Field key={t.id} id={`st-${t.id}`} label={t.name} hint="Kosongkan bila tidak termasuk paket.">
                <Input id={`st-${t.id}`} inputMode="numeric" value={amounts[t.id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [t.id]: e.target.value.replace(/\D/g, '') })} />
              </Field>
            ))}
            <p className="text-sm">Jumlah <b className="tabular-nums">{rupiah(monthlyTotal(lines))}</b></p>
          </div>
        )}
        {step === 2 && <Field id="st-reason" label="Alasan"><Textarea id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        {step === 3 && (
          <div className="space-y-2 text-sm">
            <p><b>{label}</b> mulai <b>{from ? longDate(from) : '-'}</b> menjadi <b className="tabular-nums">{rupiah(monthlyTotal(lines))}</b>.</p>
            <Alert tone="info">Gaji {peopleCount} orang yang sudah ada tidak ikut berubah.</Alert>
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </Dialog>
    </div>
  );
}
