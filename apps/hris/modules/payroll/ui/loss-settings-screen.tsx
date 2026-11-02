'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { addPeriods, longDate, rupiah } from '../rules/salary';
import { LossSplitTable } from './loss-split-table';

type Branch = {
  id: number; name: string; current: number | null; latestId: number | null; firstFill: boolean;
  scheduled: { id: number; value: number; effectiveFrom: string }[];
  example: { shares: { name: string; weight: number; days: number; amount: number }[]; office: { total: number; percentPart: number; dayRemainder: number; rounding: number } } | null;
};

/** GAJ-L14 Tanggungan Kehilangan: persen kantor per cabang (bertanggal 26) dan tanda/bobot per jabatan. */
export function LossSettingsScreen({ today, period, nextStart, firstFillStart, sample, branches, positions, canEdit }: {
  today: string; period: { start: string; end: string; days: number }; nextStart: string; firstFillStart: string; sample: number;
  branches: Branch[]; positions: { id: number; name: string; sharing: boolean; weight: number; owner: boolean }[]; canEdit: boolean;
}) {
  const [tab, setTab] = useState<'branch' | 'position'>('branch');
  const [editing, setEditing] = useState<Branch | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === 'branch' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('branch')}>Persen kantor per cabang</Button>
        <Button variant={tab === 'position' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('position')}>Tanda &amp; bobot per jabatan</Button>
      </div>
      {tab === 'branch' && (
        <div className="space-y-3">
          {!canEdit && <Alert tone="info">Hanya Pemilik atau GM yang mengubah persen kantor.</Alert>}
          {branches.map((b) => (
            <Card key={b.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <b>{b.name}</b>
                {b.current == null ? <Badge tone="danger">Belum diisi</Badge> : <span>Persen kantor <b>{b.current}%</b></span>}
                {b.scheduled.map((s) => <Badge key={s.id} tone="info">Mulai {longDate(s.effectiveFrom)}: {s.value}%</Badge>)}
                {canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>{b.firstFill ? 'Isi' : 'Ubah'}</Button>}
              </div>
              {b.example && (
                <details className="text-sm">
                  <summary className="cursor-pointer">Dengan angka ini, kehilangan {rupiah(sample)} di cabang ini periode berjalan dibagi…</summary>
                  <LossSplitTable split={b.example} amount={sample} />
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
      {tab === 'position' && (
        <div className="space-y-3">
          <Alert tone="info">Tanda dan bobot diubah di <Link className="underline" href="/pengaturan/jabatan">Pengaturan Jabatan</Link> (kolom &quot;Ikut menanggung kehilangan barang&quot; dan &quot;Bobot tanggungan kehilangan&quot;), berlaku mulai tanggal 26. Pemilik dan GM tidak pernah ikut.</Alert>
          <DataList
            rows={positions}
            rowKey={(p) => String(p.id)}
            empty="Belum ada jabatan."
            columns={[
              { key: 'name', header: 'Jabatan', primary: true, render: (p) => p.name },
              { key: 'sharing', header: 'Ikut menanggung', render: (p) => (p.owner ? 'Tidak (Pemilik/GM)' : p.sharing ? <Badge tone="ok">Ya</Badge> : 'Tidak') },
              { key: 'weight', header: 'Bobot', render: (p) => (p.sharing ? p.weight : '—') },
            ]}
          />
        </div>
      )}
      <OfficePercentDialog branch={editing} onClose={() => setEditing(null)} today={today} period={period} nextStart={nextStart} firstFillStart={firstFillStart} />
    </div>
  );
}

function OfficePercentDialog({ branch, onClose, today, period, nextStart, firstFillStart }: {
  branch: Branch | null; onClose: () => void; today: string; period: { start: string }; nextStart: string; firstFillStart: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!branch) return null;
  // Isi pertama boleh mulai awal periode berjalan (tak ada nilai lama yang tertimpa); perubahan mulai tanggal 26 depan.
  const choices = branch.firstFill ? [firstFillStart, nextStart, addPeriods(nextStart, 1)] : [nextStart, addPeriods(nextStart, 1), addPeriods(nextStart, 2)];
  const chosen = from || choices[0];

  function close() { setValue(''); setFrom(''); setReason(''); setError(null); onClose(); }

  async function save() {
    if (!branch) return;
    const percent = Number(value);
    if (value === '' || !Number.isInteger(percent) || percent < 0 || percent > 100) return setError('Persen kantor bilangan bulat 0 sampai 100.');
    setBusy(true);
    const result = await postJson('/api/payroll', {
      kind: 'office_percent_save', branchId: branch.id, value: percent, effectiveFrom: chosen, reason,
      expectedLatestId: branch.latestId, firstFill: branch.firstFill && chosen === firstFillStart,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Persen kantor ${branch.name} ${percent}% mulai ${longDate(chosen)}.`, 'ok');
    close();
    router.refresh();
  }

  return (
    <Dialog open onClose={close} title={`Persen kantor ${branch.name}`}
      footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton loading={busy} disabled={!reason.trim() || value === ''} onClick={save}>Simpan</HoldButton></>}>
      <div className="space-y-3">
        <Field id="op-value" label="Persen kantor (0–100)"><Input id="op-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field id="op-from" label="Berlaku mulai" hint={branch.firstFill ? 'Isi pertama boleh mulai awal periode berjalan.' : 'Angka gaji hanya berubah tanggal 26.'}>
          <Select id="op-from" value={chosen} onChange={(e) => setFrom(e.target.value)}>
            {choices.map((c) => <option key={c} value={c}>{longDate(c)}{c === period.start ? ' (periode berjalan)' : ''}</option>)}
          </Select>
        </Field>
        <Field id="op-reason" label="Alasan"><Textarea id="op-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-xs text-ink-muted">Hari ini {longDate(today)}. Pemilik lain diberi tahu.</p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
