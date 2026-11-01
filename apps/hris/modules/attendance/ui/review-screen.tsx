'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { PATTERN_LABELS, REVIEW_OUTCOME_LABELS, type PatternKind, type ReviewOutcome } from '../rules/review';
import { TabNav } from './tab-nav';

type Row = {
  id: number; employeeId: number; name: string; workDate: string; kindLabel: string; clock: string; branch: string;
  distanceM: number | null; radiusM: number; accuracyM: number | null; photo: boolean; canDecide: boolean;
  latestReviewId: number | null; status: 'pending' | 'decided' | 'uncorrected';
  history: { id: number; outcome: ReviewOutcome; reason: string; at: string; by: string }[];
};

type Flag = {
  id: number; kind: PatternKind; detectedOn: string; people: { id: number; name: string }[];
  days: { employeeId: number; workDate: string; name: string }[];
  seen: { by: string; at: string; note: string } | null;
};

const FILTERS = [
  { key: 'pending', label: 'Menunggu putusan' },
  { key: 'uncorrected', label: 'Perlu dikoreksi, belum dikoreksi' },
  { key: 'decided', label: 'Sudah diputuskan' },
] as const;

const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

/** KEH-L12 Tinjau Absen: putuskan absen luar titik dan lihat tanda pola lokasi. */
export function ReviewScreen({ tab, filter, branchId, branches, canDecide, rows, flags }: {
  tab: 'outside' | 'patterns'; filter: string; branchId: number | null; branches: { id: number; name: string }[];
  canDecide: boolean; rows: Row[]; flags: Flag[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [deciding, setDeciding] = useState<{ row: Row; outcome: ReviewOutcome } | null>(null);
  const [seeing, setSeeing] = useState<Flag | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<Row | null>(null);

  const href = (next: { tab?: string; filter?: string; branch?: string }) => {
    const params = new URLSearchParams({ tab: next.tab ?? tab, filter: next.filter ?? filter });
    const branch = next.branch ?? (branchId ? String(branchId) : '');
    if (branch) params.set('branch', branch);
    return `/kehadiran/tinjau?${params}`;
  };

  async function send(body: Record<string, unknown>, done: () => void) {
    setBusy(true);
    const result = await postJson('/api/attendance/review', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    done();
    const link = result.data?.link;
    if (typeof link === 'string') router.push(link);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <TabNav
        label="Tab Tinjau Absen"
        active={tab}
        tabs={[
          { key: 'outside', label: 'Luar titik', href: href({ tab: 'outside' }) },
          { key: 'patterns', label: 'Pola', href: href({ tab: 'patterns' }) },
        ]}
      />

      {tab === 'outside' && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((item) => (
                <Link key={item.key} href={href({ filter: item.key })} className={`rounded-full border px-3 py-1 text-sm ${filter === item.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-ink-muted'}`}>
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="w-56">
              <Field id="review-branch" label="Cabang">
                <Select id="review-branch" value={branchId ?? ''} onChange={(event) => router.push(href({ branch: event.target.value }))}>
                  <option value="">Semua yang boleh dilihat</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </Field>
            </div>
          </div>
          {!canDecide && <Alert>Anda hanya melihat daftar ini. Yang memutuskan: HR, Pemilik, atau GM.</Alert>}
          {!rows.length && <EmptyState title={filter === 'pending' ? 'Tidak ada absen yang menunggu putusan.' : 'Tidak ada absen di daftar ini.'} />}
          <ul className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Card className="space-y-3">
                  <div className="flex gap-3">
                    {row.photo ? (
                      <button type="button" onClick={() => setZoom(row)} className="shrink-0" aria-label={`Perbesar foto ${row.name}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/attendance/photos/${row.id}`} alt={`Foto absen ${row.name}`} className="size-24 rounded-lg object-cover" draggable={false} onContextMenu={(event) => event.preventDefault()} />
                      </button>
                    ) : <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-canvas p-2 text-center text-xs text-ink-muted">Foto tidak tersedia</div>}
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="font-medium">{row.name}</p>
                      <p>Absen {row.kindLabel.toLowerCase()} {row.clock}, {row.workDate}, di {row.branch}</p>
                      <p>Berjarak <b>{row.distanceM ?? '-'} m</b> dari titik (radius {row.radiusM} m){row.accuracyM != null && <> · akurasi GPS ±{row.accuracyM} m</>}</p>
                      <div className="flex flex-wrap gap-1">
                        {row.status === 'pending' && <Badge tone="warn">Menunggu putusan</Badge>}
                        {row.status === 'uncorrected' && <Badge tone="danger">Perlu dikoreksi, belum dikoreksi</Badge>}
                        {row.history[0] && <Badge tone={row.history[0].outcome === 'FINE' ? 'ok' : 'info'}>{REVIEW_OUTCOME_LABELS[row.history[0].outcome]}</Badge>}
                      </div>
                    </div>
                  </div>
                  {row.history.length > 0 && (
                    <ul className="space-y-1 border-t border-line pt-2 text-xs text-ink-muted">
                      {row.history.map((item) => (
                        <li key={item.id}>{REVIEW_OUTCOME_LABELS[item.outcome]} oleh {item.by}, {when(item.at)}: {item.reason}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {row.canDecide && row.history[0]?.outcome !== 'FINE' && (
                      <Button size="sm" variant="secondary" onClick={() => { setDeciding({ row, outcome: 'FINE' }); setText(''); setError(null); }}>Wajar</Button>
                    )}
                    {row.canDecide && row.history[0]?.outcome !== 'NEEDS_CORRECTION' && (
                      <Button size="sm" variant="secondary" onClick={() => { setDeciding({ row, outcome: 'NEEDS_CORRECTION' }); setText(''); setError(null); }}>Perlu dikoreksi</Button>
                    )}
                    {row.status === 'uncorrected' && row.canDecide && (
                      <Link href={`/kehadiran/koreksi?mode=one&employee=${row.employeeId}&date=${row.workDate}`} className="text-sm text-brand-700">Buka koreksi</Link>
                    )}
                    <Link href={`/kehadiran/catatan-hari?employee=${row.employeeId}&date=${row.workDate}`} className="text-sm text-brand-700">Catatan hari</Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'patterns' && (
        <>
          <Alert>Tanda pola tidak menahan apa pun dan bukan tugas. Tandai Sudah dilihat setelah diperiksa.</Alert>
          {!flags.length && <EmptyState title="Tidak ada tanda pola lokasi." />}
          <ul className="grid gap-3 lg:grid-cols-2">
            {flags.map((flag) => (
              <li key={flag.id}>
                <Card className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{PATTERN_LABELS[flag.kind]}</p>
                    {flag.seen ? <Badge tone="ok">Sudah dilihat</Badge> : <Badge tone="warn">Belum dilihat</Badge>}
                  </div>
                  <p>{flag.people.map((person) => person.name).join(' dan ')} · terdeteksi {flag.detectedOn}</p>
                  <ul className="flex flex-wrap gap-2">
                    {flag.days.map((day) => (
                      <li key={`${day.employeeId}-${day.workDate}`}>
                        <Link href={`/kehadiran/catatan-hari?employee=${day.employeeId}&date=${day.workDate}`} className="text-brand-700">
                          {flag.people.length > 1 ? `${day.name} ` : ''}{day.workDate}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {flag.seen && <p className="text-xs text-ink-muted">Dilihat {flag.seen.by}, {when(flag.seen.at)}: {flag.seen.note}</p>}
                  {!flag.seen && canDecide && (
                    <Button size="sm" variant="secondary" onClick={() => { setSeeing(flag); setText(''); setError(null); }}>Sudah dilihat</Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={deciding != null}
        onClose={() => setDeciding(null)}
        title={deciding ? `${REVIEW_OUTCOME_LABELS[deciding.outcome]}: ${deciding.row.name}` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeciding(null)}>Kembali</Button>
            <Button loading={busy} onClick={() => deciding && send({
              kind: 'decide', recordId: deciding.row.id, outcome: deciding.outcome, reason: text, baseReviewId: deciding.row.latestReviewId,
            }, () => setDeciding(null))}>Simpan putusan</Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm">
          {deciding?.outcome === 'FINE'
            ? <p>Tanda perlu ditinjau dicabut. Jam absen tidak berubah.</p>
            : <p>Sesudah disimpan, layar Koreksi Absen terbuka dengan orang dan tanggal sudah terisi.</p>}
          <Field id="review-reason" label="Alasan"><Textarea id="review-reason" value={text} onChange={(event) => setText(event.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>

      <Dialog
        open={seeing != null}
        onClose={() => setSeeing(null)}
        title="Tandai sudah dilihat"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setSeeing(null)}>Kembali</Button>
            <Button loading={busy} onClick={() => seeing && send({ kind: 'pattern_seen', flagId: seeing.id, note: text }, () => setSeeing(null))}>Simpan</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field id="pattern-note" label="Catatan"><Textarea id="pattern-note" value={text} onChange={(event) => setText(event.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>

      <Dialog open={zoom != null} onClose={() => setZoom(null)} title={zoom ? `${zoom.name} · ${zoom.kindLabel} ${zoom.clock}` : ''}>
        {zoom && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/attendance/photos/${zoom.id}`} alt={`Foto absen ${zoom.name}`} className="w-full rounded-lg" draggable={false} onContextMenu={(event) => event.preventDefault()} />
        )}
      </Dialog>
    </div>
  );
}
