'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Option = { id: number; name: string };
type Row = {
  id: number; name: string; date: string; vehicle: string; route: string; roleLabel: string; kind: 'RITASE' | 'SHOPPING'; kindLabel: string;
  withAssistant: boolean; manual: boolean; manualReason: string | null; tripId: number | null; tripNumber: string | null; cancelled: boolean; cancelReason: string | null;
};

/** Ritase per minggu Jumat–Kamis (DRV-19): ringkasan per orang, rincian, Ritase tangan dan Batalkan (Pemilik/GM). */
export function WagesScreen({ start, end, prev, next, today, rows, people, canManage, manualDays, earliest, options }: {
  start: string; end: string; prev: string; next: string; today: string; rows: Row[]; people: { name: string; ritase: number; shopping: number }[];
  canManage: boolean; manualDays: number; earliest: string; options: { people: Option[]; vehicles: Option[]; routes: Option[] };
}) {
  const router = useRouter();
  const toast = useToast();
  const [manual, setManual] = useState(false);
  const [cancel, setCancel] = useState<Row | null>(null);
  const [form, setForm] = useState({ employeeId: '', tripDate: today, vehicleId: '', routeId: '', role: 'DRIVER', withAssistant: false, reason: '', confirmTwice: false });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(done, 'ok');
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/logistik/ritase?minggu=${prev}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>‹</Link>
          <span className="text-sm font-medium">Jumat {start} – Kamis {end}</span>
          {next <= today && <Link href={`/logistik/ritase?minggu=${next}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>›</Link>}
        </div>
        {canManage && <Button size="sm" onClick={() => { setError(null); setManual(true); }}>Ritase tangan</Button>}
      </div>
      <p className="text-sm text-ink-muted">Nominal upah dihitung di Gaji Driver (menyusul). Di sini jumlah ritase kirim dan belanja supplier per orang.</p>
      {!rows.length ? <EmptyState title="Belum ada ritase di minggu ini" /> : (
        <>
          <Card className="overflow-x-auto">
            <h2 className="mb-2 font-semibold">Per orang</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-muted"><th className="py-1 pr-3 font-medium">Nama</th><th className="py-1 pr-3 text-right font-medium">Ritase</th><th className="py-1 text-right font-medium">Belanja</th></tr></thead>
              <tbody className="divide-y divide-line">
                {people.map((p) => <tr key={p.name}><td className="py-1.5 pr-3">{p.name}</td><td className="py-1.5 pr-3 text-right tabular-nums">{p.ritase}</td><td className="py-1.5 text-right tabular-nums">{p.shopping}</td></tr>)}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto">
            <h2 className="mb-2 font-semibold">Rincian</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-muted">
                <th className="py-1 pr-3 font-medium">Tanggal</th><th className="py-1 pr-3 font-medium">Nama</th><th className="py-1 pr-3 font-medium">Jenis</th>
                <th className="py-1 pr-3 font-medium">Rute</th><th className="py-1 pr-3 font-medium">Mobil</th><th className="py-1 pr-3 font-medium">Peran</th><th className="py-1 font-medium">Trip</th><th />
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className={r.cancelled ? 'text-ink-muted' : ''}>
                    <td className="py-1.5 pr-3">{r.date}</td><td className="py-1.5 pr-3">{r.name}</td>
                    <td className="py-1.5 pr-3">{r.kindLabel}{r.kind === 'RITASE' ? (r.withAssistant ? ' · berkenek' : ' · tanpa kenek') : ''}</td>
                    <td className="py-1.5 pr-3">{r.route}</td><td className="py-1.5 pr-3">{r.vehicle}</td><td className="py-1.5 pr-3">{r.roleLabel}</td>
                    <td className="py-1.5 pr-3">
                      {r.tripId ? <Link href={`/logistik/trip/${r.tripId}`} className="underline">{r.tripNumber}</Link> : <Badge tone="warn">Ritase tangan</Badge>}
                      {r.manualReason && <span className="block text-xs text-ink-muted">{r.manualReason}</span>}
                      {r.cancelled && <span className="block text-xs">Dibatalkan: {r.cancelReason}</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      {canManage && !r.cancelled && <Button size="sm" variant="ghost" onClick={() => { setError(null); setReason(''); setCancel(r); }}>Batalkan</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Dialog
        open={manual} onClose={() => setManual(false)} title="Ritase tangan"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setManual(false)}>Batal</Button>
          <Button loading={busy} onClick={async () => {
            if (await send({ action: 'manual_wage', ...form, employeeId: Number(form.employeeId), vehicleId: Number(form.vehicleId), routeId: Number(form.routeId) }, 'Ritase tangan tercatat.')) setManual(false);
          }}>Simpan</Button></>}
      >
        <div className="space-y-3">
          <p className="text-ink-muted">Hanya untuk darurat (misalnya salah awak atau HP rusak). Paling jauh {manualDays} hari ke belakang. Jenis mengikuti rute: rute kirim = ritase, rute belanja = upah belanja.</p>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="mw-person" label="Karyawan">
            <Select id="mw-person" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Pilih</option>{options.people.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field id="mw-date" label="Tanggal trip"><Input id="mw-date" type="date" min={earliest} max={today} value={form.tripDate} onChange={(e) => setForm({ ...form, tripDate: e.target.value })} /></Field>
          <Field id="mw-vehicle" label="Mobil">
            <Select id="mw-vehicle" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Pilih</option>{options.vehicles.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field id="mw-route" label="Rute">
            <Select id="mw-route" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">Pilih</option>{options.routes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field id="mw-role" label="Peran">
            <Select id="mw-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="DRIVER">Driver</option><option value="ASSISTANT">Kenek</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.withAssistant} onChange={(e) => setForm({ ...form, withAssistant: e.target.checked })} /> Trip itu berkenek</label>
          <Field id="mw-reason" label="Alasan"><Textarea id="mw-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.confirmTwice} onChange={(e) => setForm({ ...form, confirmTwice: e.target.checked })} /> Memang dua kali jalan (bila sudah ada catatan yang sama)</label>
        </div>
      </Dialog>

      <Dialog
        open={!!cancel} onClose={() => setCancel(null)} title="Batalkan ritase"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setCancel(null)}>Batal</Button>
          <Button variant="danger" loading={busy} onClick={async () => { if (cancel && await send({ action: 'cancel_wage', wageId: cancel.id, reason }, 'Ritase dibatalkan.')) setCancel(null); }}>Batalkan ritase</Button></>}
      >
        {cancel && (
          <div className="space-y-3">
            <p>{cancel.name} · {cancel.kindLabel} {cancel.route} · {cancel.date}</p>
            <p className="text-ink-muted">Tidak dihapus: tetap tampil bertanda dibatalkan beserta alasannya.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <Field id="cw-reason" label="Alasan"><Textarea id="cw-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
