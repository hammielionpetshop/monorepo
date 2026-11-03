'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate } from '../rules/salary';
import { ReasonDialog } from './bonus-approval-screen';

type BonusType = {
  kind: string; label: string; key: string; percent: number; bornAs: string; from: string; ownerAllowed: boolean; example: string;
  scheduled: { id: number; value: number; effectiveFrom: string }[]; recipients: string[];
};

/** GAJ-L23 Jenis Bonus (spec L4d §4, §9 butir 8): persen diubah Pemilik/GM mulai tanggal 26; penerima diatur di Pengaturan Jabatan. */
export function BonusTypesScreen({ types, nextStart, canEdit }: { types: BonusType[]; nextStart: string; canEdit: boolean }) {
  const [editing, setEditing] = useState<BonusType | null>(null);
  const [cancelling, setCancelling] = useState<{ id: number; value: number; effectiveFrom: string } | null>(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function close() { setEditing(null); setValue(''); setReason(''); setError(null); }
  async function save() {
    if (!editing) return;
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'bonus_percent_save', values: { [editing.key]: Number(value) }, effectiveFrom: nextStart, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    toast(`Persen bonus ${editing.label.toLowerCase()} terjadwal mulai ${longDate(nextStart)}.`, 'ok');
    close();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Jenis bonus Fase 1: Grooming dan Ongkir (dari data kasir). Bonus Bebas menyusul. Jabatan GM tidak menerima bonus apa pun; Pemilik hanya bonus grooming.
        Penerima per jabatan diubah di <Link className="underline" href="/pengaturan/jabatan">Pengaturan Jabatan</Link> (Penerima bonus grooming / ongkir).
      </Alert>
      {types.map((t) => (
        <Card key={t.kind} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Bonus {t.label}</h2>
            <Badge tone="info">{t.percent}%</Badge>
            {t.ownerAllowed && <Badge tone="ok">boleh untuk jabatan Pemilik</Badge>}
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-muted">Lahir dari</dt><dd>{t.from}</dd>
            <dt className="text-ink-muted">Cara disahkan</dt><dd>{t.bornAs}</dd>
            <dt className="text-ink-muted">Sumber dana</dt><dd>Uang kantor</dd>
            <dt className="text-ink-muted">Jabatan penerima</dt><dd>{t.recipients.length ? t.recipients.join(', ') : 'Belum ada'}</dd>
            <dt className="text-ink-muted">Contoh</dt><dd>{t.example}</dd>
          </dl>
          {t.scheduled.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="warn">Terjadwal {s.value}% mulai {longDate(s.effectiveFrom)}</Badge>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => setCancelling(s)}>Batalkan jadwal</Button>}
            </div>
          ))}
          {canEdit && <Button size="sm" variant="secondary" onClick={() => { setEditing(t); setValue(String(t.percent)); }}>Ubah persen</Button>}
        </Card>
      ))}
      {editing && (
        <Dialog open onClose={close} title={`Ubah persen bonus ${editing.label.toLowerCase()}`}
          footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton loading={busy} disabled={!reason.trim() || value === ''} onClick={save}>Simpan</HoldButton></>}>
          <div className="space-y-3">
            <p className="text-sm">Berlaku mulai <b>{longDate(nextStart)}</b> (pengaturan gaji hanya berubah tanggal 26). Penerimanya diberi tahu.</p>
            <Field id="bt-value" label="Persen"><Input id="bt-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field id="bt-reason" label="Alasan"><Textarea id="bt-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
      {cancelling && <ReasonDialog
        title={`Batalkan jadwal ${cancelling.value}% mulai ${longDate(cancelling.effectiveFrom)}`}
        confirm="Batalkan jadwal"
        onClose={() => setCancelling(null)}
        onSubmit={(r) => postJson('/api/payroll', { kind: 'bonus_percent_cancel', id: cancelling.id, reason: r })}
        done={() => { toast('Jadwal dibatalkan.', 'ok'); setCancelling(null); router.refresh(); }}
      />}
    </div>
  );
}
