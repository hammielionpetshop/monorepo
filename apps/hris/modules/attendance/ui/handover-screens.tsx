'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';
import { TabNav } from './tab-nav';

type Reader = { name: string; readAt: string | null };
type Card = {
  id: number; from: string; branch: string; sentAt: string; text: string; hasPhoto: boolean; notes: { text: string; at: string }[];
  noRecipients: boolean; readers: Reader[];
};

/** Tambah keterangan oleh pengirimnya (KEH-95). Isi lama tetap. */
export function AddNote({ endpoint, id }: { endpoint: string; id: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Tambah keterangan</Button>;
  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson(endpoint, { action: 'note', id, body });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Belum tersimpan.');
    setOpen(false);
    setBody('');
    router.refresh();
  }
  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Textarea aria-label="Keterangan tambahan" rows={2} value={body} maxLength={1000} onChange={(event) => setBody(event.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" loading={busy} onClick={() => void save()}>Simpan keterangan</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </div>
  );
}

function HandoverItem({ card, children }: { card: Card; children?: React.ReactNode }) {
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{card.from}</span>
        <span className="text-ink-muted">{card.branch} · {card.sentAt}</span>
        {card.noRecipients && <Badge tone="warn">Tidak ada penerima</Badge>}
      </div>
      <p className="whitespace-pre-wrap text-sm">{card.text}</p>
      {card.notes.map((note, i) => <p key={i} className="rounded bg-canvas p-2 text-sm text-ink-muted">Keterangan {note.at}: {note.text}</p>)}
      {card.hasPhoto && (
        <a href={`/api/attendance/handovers/${card.id}/photo`} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/attendance/handovers/${card.id}/photo`} alt="Foto serah terima" loading="lazy" className="max-h-48 rounded-lg" />
        </a>
      )}
      {card.readers.length > 0 && (
        <p className="text-xs text-ink-muted">
          {card.readers.map((reader) => `${reader.name}: ${reader.readAt ? `dibaca ${reader.readAt}` : 'belum dibaca'}`).join(' · ')}
        </p>
      )}
      {children}
    </Card>
  );
}

function MarkRead({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
      setBusy(true);
      await postJson('/api/attendance/handovers', { action: 'read', id });
      setBusy(false);
      router.refresh();
    }}>Sudah saya baca</Button>
  );
}

/** KEH-L21 Serah Terima Saya: Diterima / Dikirim. */
export function MyHandoversScreen({ tab, cards }: { tab: 'received' | 'sent'; cards: (Card & { canAddNote: boolean; read: boolean })[] }) {
  return (
    <div className="space-y-4">
      <TabNav label="Serah terima" active={tab} tabs={[
        { key: 'received', label: 'Diterima', href: '/serah-terima' },
        { key: 'sent', label: 'Dikirim', href: '/serah-terima?tab=dikirim' },
      ]} />
      {!cards.length && <EmptyState title={tab === 'sent' ? 'Belum ada serah terima yang Anda kirim.' : 'Belum ada serah terima untuk Anda.'} />}
      <ul className="space-y-3">
        {cards.map((card) => (
          <li key={card.id}>
            <HandoverItem card={card}>
              <div className="flex flex-wrap items-center gap-2">
                {tab === 'received' && (card.read ? <Badge tone="ok">Sudah dibaca</Badge> : <MarkRead id={card.id} />)}
                {card.canAddNote && <AddNote endpoint="/api/attendance/handovers" id={card.id} />}
              </div>
            </HandoverItem>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** KEH-L22 Serah Terima Tim: per tanggal, cari dan saring. */
export function TeamHandoversScreen({ from, to, today, branchId, unread, photo, q, branches, cards }: {
  from: string; to: string; today: string; branchId: number | null; unread: boolean; photo: boolean; q: string;
  branches: { id: number; name: string }[]; cards: (Card & { unread: number })[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const go = (next: Partial<{ from: string; to: string; branch: string; unread: boolean; photo: boolean; q: string }>) => {
    const params = new URLSearchParams();
    const values = { from, to, branch: branchId ? String(branchId) : '', unread, photo, q: search, ...next };
    if (values.from) params.set('from', values.from);
    if (values.to) params.set('to', values.to);
    if (values.branch) params.set('branch', values.branch);
    if (values.unread) params.set('unread', '1');
    if (values.photo) params.set('photo', '1');
    if (values.q.trim()) params.set('q', values.q.trim());
    router.push(`/kehadiran/serah-terima?${params}`);
  };
  const groups = new Map<string, typeof cards>();
  for (const card of cards) {
    const date = card.sentAt.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), card]);
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="ho-from" label="Dari"><Input id="ho-from" type="date" max={today} value={from} onChange={(event) => event.target.value && go({ from: event.target.value })} /></Field>
        <Field id="ho-to" label="Sampai"><Input id="ho-to" type="date" max={today} value={to} onChange={(event) => event.target.value && go({ to: event.target.value })} /></Field>
        <Field id="ho-branch" label="Cabang">
          <Select id="ho-branch" value={branchId ?? ''} onChange={(event) => go({ branch: event.target.value })}>
            <option value="">Semua yang boleh dilihat</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
        <Field id="ho-q" label="Cari isi atau nama">
          <form onSubmit={(event) => { event.preventDefault(); go({ q: search }); }}>
            <Input id="ho-q" value={search} onChange={(event) => setSearch(event.target.value)} />
          </form>
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={unread} onChange={(event) => go({ unread: event.target.checked })} />Ada yang belum membaca</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={photo} onChange={(event) => go({ photo: event.target.checked })} />Ada foto</label>
      </div>
      {!cards.length && <EmptyState title="Tidak ada serah terima pada rentang ini." />}
      {[...groups.entries()].map(([date, list]) => (
        <section key={date} className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">{date}</h2>
          <ul className="space-y-3">
            {list.map((card) => (
              <li key={card.id}>
                <HandoverItem card={card}>{card.unread > 0 && <Badge tone="warn">{card.unread} belum membaca</Badge>}</HandoverItem>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
