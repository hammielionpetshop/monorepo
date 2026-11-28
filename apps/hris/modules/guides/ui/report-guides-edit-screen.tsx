'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea, Input } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { CASE_LABEL_MAX, REPORT_TO_MAX } from '../rules/report-guides';

type History = { what: string; by: string; at: string };
type Row = { id: number; caseLabel: string; reportTo: string; requestType: string | null; active: boolean; history: History[] };
type TypeOption = { key: string; label: string };

const OWN_CASE = '';
const API = '/api/report-guides';

function when(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** KAR-L35 Ubah Pedoman Lapor (Pemilik/GM): tambah, ubah, urutkan, nonaktifkan/aktifkan. Tidak ada hapus. */
export function ReportGuidesEditScreen({ rows, typeOptions }: { rows: Row[]; typeOptions: TypeOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  async function act(id: number, body: Record<string, unknown>, done: string) {
    setBusyId(id);
    const result = await postJson(API, { id, ...body });
    setBusyId(null);
    if (!result.ok) return toast(result.error ?? 'Gagal menyimpan.', 'danger');
    toast(done, 'ok');
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Pedoman hanya untuk dibaca karyawan di <Link href="/guides/report" className="text-brand-700">Panduan › Pedoman Lapor</Link> dan di
        kepala isian pengajuan. Tidak mengubah siapa penyetuju — itu diatur di{' '}
        <Link href="/settings/access-rights" className="text-brand-700">Hak Akses Jabatan</Link>.
      </p>
      <Button onClick={() => setEditing('new')}>Tambah baris</Button>
      {rows.length === 0 ? (
        <Card><EmptyState title="Pedoman belum diisi." /></Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id}>
              <Card className={row.active ? undefined : 'opacity-70'}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.caseLabel}{' '}
                      {row.requestType ? <Badge>Pengajuan</Badge> : <Badge tone="ok">Kasus lain</Badge>}{' '}
                      {!row.active && <Badge tone="warn">Nonaktif</Badge>}
                    </p>
                    <p className="mt-1 text-sm">{row.reportTo}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" aria-label="Naikkan" disabled={index === 0 || busyId !== null}
                      onClick={() => act(row.id, { kind: 'move', direction: 'up' }, 'Urutan diubah.')}>↑</Button>
                    <Button size="sm" variant="ghost" aria-label="Turunkan" disabled={index === rows.length - 1 || busyId !== null}
                      onClick={() => act(row.id, { kind: 'move', direction: 'down' }, 'Urutan diubah.')}>↓</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>Ubah</Button>
                    <Button size="sm" variant="secondary" loading={busyId === row.id}
                      onClick={() => act(row.id, { kind: 'active', active: !row.active }, row.active ? 'Baris dinonaktifkan.' : 'Baris diaktifkan.')}>
                      {row.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </div>
                {row.history.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-ink-muted">Riwayat ({row.history.length})</summary>
                    <ul className="mt-1 space-y-1">
                      {row.history.map((h, i) => (
                        <li key={i}>{when(h.at)} · {h.by} · {h.what}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <GuideDialog key={editing === 'new' ? 'new' : editing.id} row={editing === 'new' ? null : editing} typeOptions={typeOptions}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function GuideDialog({ row, typeOptions, onClose }: { row: Row | null; typeOptions: TypeOption[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [requestType, setRequestType] = useState(row ? row.requestType ?? OWN_CASE : OWN_CASE);
  const [caseLabel, setCaseLabel] = useState(row && !row.requestType ? row.caseLabel : '');
  const [reportTo, setReportTo] = useState(row?.reportTo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson(API, {
      kind: 'save', id: row?.id ?? null, requestType: requestType || null, caseLabel: requestType ? null : caseLabel, reportTo,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Pedoman disimpan.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title={row ? `Ubah: ${row.caseLabel}` : 'Tambah baris pedoman'}
      footer={<><Button variant="secondary" onClick={onClose}>Kembali</Button><Button loading={busy} onClick={save}>Simpan</Button></>}>
      <div className="space-y-3">
        <Field id="rg-type" label="Jenis" hint="Pilih jenis pengajuan agar kalimatnya juga tampil di isian pengajuan itu, atau tulis jenis kasus sendiri.">
          <Select id="rg-type" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value={OWN_CASE}>Kasus lain (tulis sendiri)</option>
            {typeOptions.map((option) => <option key={option.key} value={option.key}>Pengajuan: {option.label}</option>)}
          </Select>
        </Field>
        {!requestType && (
          <Field id="rg-case" label="Jenis kasus" hint={`Mis. "Mobil mogok". Paling panjang ${CASE_LABEL_MAX} huruf.`}>
            <Input id="rg-case" maxLength={CASE_LABEL_MAX} value={caseLabel} onChange={(e) => setCaseLabel(e.target.value)} />
          </Field>
        )}
        <Field id="rg-to" label="Lapor ke siapa" hint={`Satu–dua kalimat. Paling panjang ${REPORT_TO_MAX} huruf.`}>
          <Textarea id="rg-to" maxLength={REPORT_TO_MAX} value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
