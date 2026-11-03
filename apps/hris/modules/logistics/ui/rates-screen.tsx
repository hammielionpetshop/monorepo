'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Numbers = { driverWithAssistant: number; driverAlone: number; assistant: number };
type HistoryRow = Numbers & {
  id: number; from: string; state: string; stateLabel: string; reason: string | null; endReason: string | null; canCancel: boolean; canFix: boolean;
};
type Pair = {
  key: string; vehicleId: number; routeId: number; vehicle: string; route: string; routeKind: string; routeKindLabel: string; active: boolean;
  current: (Numbers & { from: string }) | null; scheduled: (Numbers & { from: string })[]; history: HistoryRow[];
};
type FixImpact = {
  rate: { vehicle: string; route: string; fromLabel: string } & Numbers; fixable: boolean; same: boolean; blocked: string | null;
  rows: { id: number; name: string; date: string; role: string; before: number; after: number | null }[]; perPerson: { name: string; diff: number }[];
};

const rp = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;
const STATE_TONE: Record<string, 'info' | 'ok' | 'warn' | 'danger'> = { IN_FORCE: 'ok', SCHEDULED: 'info', REPLACED: 'warn', CANCELLED: 'danger', FIXED: 'danger' };
const CHANGE_TEXT: Record<string, string> = {
  NEW_PAIR: 'Pasangan belum pernah bertarif: boleh berlaku hari ini.',
  UP_OR_SAME: 'Angka sama atau naik: paling cepat berlaku besok.',
  DOWN: 'Ada angka yang turun: paling cepat berlaku 7 hari lagi.',
};

function NumbersInputs({ value, onChange, prefix }: { value: Record<keyof Numbers, string>; onChange: (v: Record<keyof Numbers, string>) => void; prefix: string }) {
  const fields: [keyof Numbers, string][] = [['driverWithAssistant', 'Driver (ada kenek)'], ['assistant', 'Kenek'], ['driverAlone', 'Driver (tanpa kenek)']];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {fields.map(([key, label]) => (
        <Field key={key} id={`${prefix}-${key}`} label={label}>
          <Input id={`${prefix}-${key}`} inputMode="numeric" value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value.replace(/\D/g, '') })} />
        </Field>
      ))}
    </div>
  );
}

const toNumbers = (v: Record<keyof Numbers, string>): Numbers => ({
  driverWithAssistant: Number(v.driverWithAssistant || 0), driverAlone: Number(v.driverAlone || 0), assistant: Number(v.assistant || 0),
});
const toText = (n: Numbers | null): Record<keyof Numbers, string> => ({
  driverWithAssistant: n ? String(n.driverWithAssistant) : '', driverAlone: n ? String(n.driverAlone) : '', assistant: n ? String(n.assistant) : '',
});

/** Tarif Ritase (DRV-L02 s.d. L04): satu baris per pasangan mobil × rute, riwayat, Tarif baru, Batalkan, Betulkan salah ketik. */
export function RatesScreen({ pairs, counts, canManage }: {
  today: string; pairs: Pair[]; counts: { active: number; unrated: number; scheduled: number }; canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<'ACTIVE' | 'UNRATED' | 'INACTIVE'>('ACTIVE');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tarif baru
  const [creating, setCreating] = useState(false);
  const [pairKey, setPairKey] = useState('');
  const [nums, setNums] = useState(toText(null));
  const [preview, setPreview] = useState<{ earliest: string; change: string; current: (Numbers & { from: string }) | null } | null>(null);
  const [from, setFrom] = useState('');
  // Batalkan / betulkan
  const [cancelRow, setCancelRow] = useState<{ pair: Pair; row: HistoryRow } | null>(null);
  const [fixRow, setFixRow] = useState<{ pair: Pair; row: HistoryRow } | null>(null);
  const [impact, setImpact] = useState<FixImpact | null>(null);
  const [reason, setReason] = useState('');

  const shown = useMemo(() => pairs.filter((p) => (filter === 'INACTIVE' ? !p.active : p.active && (filter === 'ACTIVE' || !p.current))), [pairs, filter]);
  const selected = pairs.find((p) => p.key === pairKey) ?? null;

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/wages', body);
    setBusy(false);
    if (!result.ok) setError(result.error ?? 'Gagal menyimpan.');
    return result;
  }

  function startCreate(pair: Pair | null) {
    setError(null);
    setPreview(null);
    setPairKey(pair?.key ?? '');
    setNums(toText(pair?.current ?? null));
    setFrom('');
    setCreating(true);
  }

  async function checkPreview() {
    if (!selected) return setError('Pilih mobil dan rute.');
    const result = await send({ action: 'rate_preview', vehicleId: selected.vehicleId, routeId: selected.routeId, ...toNumbers(nums) });
    if (result.ok && result.data) {
      const data = result.data as { earliest: string; change: string; current: (Numbers & { from: string }) | null };
      setPreview(data);
      setFrom(data.earliest);
    }
  }

  async function startFix(pair: Pair, row: HistoryRow) {
    setError(null);
    setReason('');
    setImpact(null);
    setNums(toText(row));
    setFixRow({ pair, row });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Pasangan aktif</p><p className="text-2xl font-semibold tabular-nums">{counts.active}</p></Card>
        <Card><p className="text-sm text-ink-muted">Belum ada tarif</p><p className={`text-2xl font-semibold tabular-nums ${counts.unrated ? 'text-danger-fg' : ''}`}>{counts.unrated}</p></Card>
        <Card><p className="text-sm text-ink-muted">Punya tarif terjadwal</p><p className="text-2xl font-semibold tabular-nums">{counts.scheduled}</p></Card>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {([['ACTIVE', 'Aktif'], ['UNRATED', 'Belum ada tarif'], ['INACTIVE', 'Nonaktif']] as const).map(([key, label]) => (
            <Button key={key} size="sm" variant={filter === key ? 'primary' : 'secondary'} onClick={() => setFilter(key)}>{label}</Button>
          ))}
        </div>
        {canManage && <Button size="sm" onClick={() => startCreate(null)}>Tarif baru</Button>}
      </div>
      <p className="text-sm text-ink-muted">Urutan angka: driver bila trip berkenek, kenek, driver bila trip tanpa kenek. Rute belanja memakai bentuk yang sama (upah belanja). Tarif tidak dihapus dan tidak berlaku mundur.</p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ink-muted">
            <th className="py-1 pr-3 font-medium">Rute</th><th className="py-1 pr-3 font-medium">Mobil</th>
            <th className="py-1 pr-3 text-right font-medium">Driver (ada kenek)</th><th className="py-1 pr-3 text-right font-medium">Kenek</th>
            <th className="py-1 pr-3 text-right font-medium">Driver (tanpa kenek)</th><th className="py-1 pr-3 font-medium">Keterangan</th><th />
          </tr></thead>
          <tbody className="divide-y divide-line">
            {shown.map((p) => (
              <FragmentRow key={p.key} pair={p} open={open === p.key} onToggle={() => setOpen(open === p.key ? null : p.key)} canManage={canManage}
                onCreate={() => startCreate(p)} onCancel={(row) => { setError(null); setReason(''); setCancelRow({ pair: p, row }); }} onFix={(row) => startFix(p, row)} />
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="py-3 text-sm text-ink-muted">Tidak ada pasangan di saringan ini.</p>}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Tarif baru"
        footer={<>
          <Button variant="secondary" disabled={busy} onClick={() => setCreating(false)}>Batal</Button>
          {!preview ? <Button loading={busy} onClick={checkPreview}>Lanjut</Button> : (
            <HoldButton loading={busy} onClick={async () => {
              if (!selected) return;
              const result = await send({ action: 'create_rate', vehicleId: selected.vehicleId, routeId: selected.routeId, effectiveFrom: from, ...toNumbers(nums) });
              if (result.ok) {
                toast(String(result.data?.message ?? 'Tarif tersimpan.'), 'ok');
                setCreating(false);
                router.refresh();
              }
            }}>Simpan tarif</HoldButton>
          )}
        </>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="rate-pair" label="Mobil dan rute">
            <Select id="rate-pair" value={pairKey} onChange={(e) => { setPairKey(e.target.value); setPreview(null); setNums(toText(pairs.find((p) => p.key === e.target.value)?.current ?? null)); }}>
              <option value="">Pilih</option>
              {pairs.filter((p) => p.active).map((p) => <option key={p.key} value={p.key}>{p.route} · {p.vehicle}{p.current ? '' : ' (belum ada tarif)'}</option>)}
            </Select>
          </Field>
          {selected && <p className="text-ink-muted">Sekarang: {selected.current ? `${rp(selected.current.driverWithAssistant)} / ${rp(selected.current.assistant)} / ${rp(selected.current.driverAlone)} sejak ${selected.current.from}` : 'belum pernah bertarif'}</p>}
          <NumbersInputs prefix="rate" value={nums} onChange={(v) => { setNums(v); setPreview(null); }} />
          {toNumbers(nums).assistant === 0 && nums.assistant !== '' && <p className="text-ink-muted">Kenek tidak diupah di pasangan ini.</p>}
          {preview && selected && (
            <>
              <Alert tone="info">{CHANGE_TEXT[preview.change]}</Alert>
              <Field id="rate-from" label="Mulai berlaku" hint={`Paling cepat ${preview.earliest}`}>
                <Input id="rate-from" type="date" min={preview.earliest} value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <p>Mulai <b>{from}</b>, {selected.vehicle} ke {selected.route}: driver ada kenek {rp(toNumbers(nums).driverWithAssistant)}, kenek {rp(toNumbers(nums).assistant)}, driver tanpa kenek {rp(toNumbers(nums).driverAlone)}. Driver dan kenek diberi tahu.</p>
            </>
          )}
        </div>
      </Dialog>

      <Dialog open={!!cancelRow} onClose={() => setCancelRow(null)} title="Batalkan tarif terjadwal"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setCancelRow(null)}>Kembali</Button>
          <Button variant="danger" loading={busy} onClick={async () => {
            if (!cancelRow) return;
            const result = await send({ action: 'cancel_rate', rateId: cancelRow.row.id, reason });
            if (result.ok) { toast('Tarif terjadwal dibatalkan.', 'ok'); setCancelRow(null); router.refresh(); }
          }}>Batalkan tarif</Button></>}
      >
        {cancelRow && (
          <div className="space-y-3">
            <p>{cancelRow.pair.vehicle} ke {cancelRow.pair.route}, mulai {cancelRow.row.from}. Tetap tersimpan bertanda Dibatalkan.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <Field id="cr-reason" label="Alasan"><Textarea id="cr-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={!!fixRow} onClose={() => setFixRow(null)} title="Betulkan salah ketik tarif"
        footer={<>
          <Button variant="secondary" disabled={busy} onClick={() => setFixRow(null)}>Kembali</Button>
          {!impact ? (
            <Button loading={busy} onClick={async () => {
              if (!fixRow) return;
              const result = await send({ action: 'fix_preview', rateId: fixRow.row.id, ...toNumbers(nums) });
              if (result.ok) setImpact(result.data as unknown as FixImpact);
            }}>Lihat akibatnya</Button>
          ) : !impact.blocked && !impact.same && (
            <HoldButton loading={busy} onClick={async () => {
              if (!fixRow) return;
              const result = await send({ action: 'fix_rate', rateId: fixRow.row.id, reason, ...toNumbers(nums) });
              if (result.ok) { toast(String(result.data?.message ?? 'Tarif dibetulkan.'), 'ok'); setFixRow(null); router.refresh(); }
            }}>Simpan betulan</HoldButton>
          )}
        </>}
      >
        {fixRow && (
          <div className="space-y-3">
            <p>{fixRow.pair.vehicle} ke {fixRow.pair.route}, berlaku sejak {fixRow.row.from}. Hanya untuk salah ketik: pasangan dan tanggal tetap. Perubahan tarif sungguhan memakai Tarif baru.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <NumbersInputs prefix="fix" value={nums} onChange={(v) => { setNums(v); setImpact(null); }} />
            {impact && (
              <>
                {impact.blocked && <Alert tone="danger">{impact.blocked}</Alert>}
                {impact.same && <Alert tone="warn">Angka betulan sama dengan angka sekarang.</Alert>}
                <p className="font-medium">{impact.rows.length} upah akan dinilai ulang.</p>
                {impact.perPerson.length > 0 && (
                  <ul className="list-disc pl-5">{impact.perPerson.map((p) => <li key={p.name}>{p.name}: {p.diff >= 0 ? '+' : '−'}{rp(Math.abs(p.diff))}</li>)}</ul>
                )}
                <Field id="fx-reason" label="Alasan"><Textarea id="fx-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function FragmentRow({ pair: p, open, onToggle, canManage, onCreate, onCancel, onFix }: {
  pair: Pair; open: boolean; onToggle: () => void; canManage: boolean; onCreate: () => void; onCancel: (row: HistoryRow) => void; onFix: (row: HistoryRow) => void;
}) {
  return (
    <>
      <tr>
        <td className="py-1.5 pr-3">{p.route}<span className="block text-xs text-ink-muted">{p.routeKindLabel}</span></td>
        <td className="py-1.5 pr-3">{p.vehicle}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{p.current ? rp(p.current.driverWithAssistant) : '—'}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{p.current ? rp(p.current.assistant) : '—'}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{p.current ? rp(p.current.driverAlone) : '—'}</td>
        <td className="py-1.5 pr-3">
          {!p.current && <Badge tone="danger">Belum ada tarif</Badge>}
          {p.current && <span className="text-xs text-ink-muted">sejak {p.current.from}</span>}
          {p.scheduled.map((s) => <span key={s.from} className="block text-xs">Berubah mulai {s.from}</span>)}
        </td>
        <td className="py-1.5 text-right whitespace-nowrap">
          <Button size="sm" variant="ghost" onClick={onToggle}>{open ? 'Tutup' : 'Riwayat'}</Button>
          {canManage && p.active && <Button size="sm" variant="ghost" onClick={onCreate}>{p.current ? 'Tarif baru' : 'Isi tarif'}</Button>}
        </td>
      </tr>
      {open && (
        <tr><td colSpan={7} className="bg-canvas px-3 py-2">
          {!p.history.length ? <p className="text-ink-muted">Belum pernah bertarif.</p> : (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-ink-muted"><th className="pr-3">Berlaku dari</th><th className="pr-3 text-right">Ada kenek</th><th className="pr-3 text-right">Kenek</th><th className="pr-3 text-right">Tanpa kenek</th><th className="pr-3">Status</th><th className="pr-3">Catatan</th><th /></tr></thead>
              <tbody>
                {p.history.map((h) => (
                  <tr key={h.id}>
                    <td className="pr-3">{h.from}</td><td className="pr-3 text-right tabular-nums">{rp(h.driverWithAssistant)}</td>
                    <td className="pr-3 text-right tabular-nums">{rp(h.assistant)}</td><td className="pr-3 text-right tabular-nums">{rp(h.driverAlone)}</td>
                    <td className="pr-3"><Badge tone={STATE_TONE[h.state] ?? 'info'}>{h.stateLabel}</Badge></td>
                    <td className="pr-3">{h.reason ? `Betulan: ${h.reason}` : ''}{h.endReason ? ` ${h.endReason}` : ''}</td>
                    <td className="text-right whitespace-nowrap">
                      {canManage && h.canCancel && <Button size="sm" variant="ghost" onClick={() => onCancel(h)}>Batalkan</Button>}
                      {canManage && h.canFix && <Button size="sm" variant="ghost" onClick={() => onFix(h)}>Betulkan salah ketik</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </td></tr>
      )}
    </>
  );
}
