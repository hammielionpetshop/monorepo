'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QueueHold } from '@/components/queue';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { letterCount } from '../rules/emergency';
import { CHANGE_KIND_LABELS, RULE_ASK_MAX, RULE_TEXT_MAX, RULE_TITLE_MAX, type RuleChangeKind } from '../rules/rule';
import type { DraftView } from '../server/rules';
import { dateText } from './shared';

type Option = { id: number; name: string };
type Supersede = { id: number; title: string; effectiveOn: string };

const STEPS = ['Isi', 'Sasaran', 'Dua tanggal', 'Periksa'] as const;

/** Nilai `datetime-local` (waktu WIB) ↔ ISO. */
function toLocalWib(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}
function fromLocalWib(value: string): string | null {
  if (!value) return null;
  const at = new Date(`${value}:00+07:00`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * Tulis perubahan aturan (BER-L23): Isi → Sasaran → Dua tanggal → Periksa. Simpan sebagai konsep kapan saja;
 * di akhir Terbitkan / Jadwalkan, atau Kirim untuk disetujui bila menyangkut uang dan penulisnya bukan Pemilik/GM.
 */
export function WriteRuleScreen({ draft, branches, positions, supersedeOptions, canPublish, fullAccess, correctsTitle }: {
  draft: DraftView | null; branches: Option[]; positions: Option[]; supersedeOptions: Supersede[];
  canPublish: boolean; fullAccess: boolean; correctsTitle: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draftId, setDraftId] = useState<number | null>(draft?.id ?? null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [beforeText, setBeforeText] = useState(draft?.beforeText ?? '');
  const [afterText, setAfterText] = useState(draft?.afterText ?? '');
  const [askWhom, setAskWhom] = useState(draft?.askWhom ?? '');
  const [changeKind, setChangeKind] = useState<RuleChangeKind>(draft?.changeKind ?? 'UNFAVORABLE');
  const [affectsMoney, setAffectsMoney] = useState(draft?.affectsMoney ?? false);
  const [supersedesId, setSupersedesId] = useState<number | null>(draft?.supersedesAnnouncementId ?? null);
  const initialTarget = draft?.target ?? { all: true as const };
  const [all, setAll] = useState(initialTarget.all);
  const [branchIds, setBranchIds] = useState<number[]>(initialTarget.all ? [] : initialTarget.branchIds);
  const [positionIds, setPositionIds] = useState<number[]>(initialTarget.all ? [] : initialTarget.positionIds);
  const [scheduled, setScheduled] = useState(!!draft?.publishesAt);
  const [publishLocal, setPublishLocal] = useState(draft?.publishesAt ? toLocalWib(draft.publishesAt) : '');
  const [effectiveOn, setEffectiveOn] = useState(draft?.effectiveOn ?? '');
  const [recipients, setRecipients] = useState<number | null>(null);
  const [earliest, setEarliest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = all ? { all: true as const } : { all: false as const, branchIds, positionIds };
  const publishesAt = scheduled ? fromLocalWib(publishLocal) : null;
  const previewKey = JSON.stringify({ target, publishesAt, changeKind });
  const approval = affectsMoney && !fullAccess;

  useEffect(() => {
    if (step < 1) return;
    let stale = false;
    setRecipients(null);
    void postJson('/api/announcements/rules/preview', JSON.parse(previewKey)).then((res) => {
      if (stale || !res.ok) return;
      setRecipients(Number(res.data?.recipients ?? 0));
      setEarliest(String(res.data?.earliestEffective ?? ''));
    });
    return () => { stale = true; };
  }, [step, previewKey]);

  const body = () => ({
    title, beforeText, afterText, askWhom, changeKind, affectsMoney, target,
    publishesAt, effectiveOn: effectiveOn || null, supersedesAnnouncementId: supersedesId,
  });

  async function save(): Promise<number | null> {
    const res = draftId
      ? await postJson(`/api/announcements/rules/drafts/${draftId}`, body())
      : await postJson('/api/announcements/rules/drafts', body());
    if (!res.ok) { setError(res.error ?? 'Gagal menyimpan konsep.'); return null; }
    const id = draftId ?? Number(res.data?.id);
    if (!draftId) {
      setDraftId(id);
      window.history.replaceState(null, '', `/announcements/rules/drafts/${id}`);
    }
    return id;
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    const id = await save();
    setBusy(false);
    if (id) toast('Konsep tersimpan.', 'ok');
  }

  async function finish() {
    setBusy(true);
    setError(null);
    const id = await save();
    if (!id) return setBusy(false);
    const mode = approval ? 'submit' : scheduled ? 'schedule' : 'now';
    const res = await postJson(`/api/announcements/rules/drafts/${id}/publish`, { mode });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Gagal.');
    if (mode === 'submit') {
      toast(String(res.data?.message ?? 'Terkirim untuk disetujui.'), 'ok');
      router.push('/announcements?tab=waiting');
    } else {
      toast(mode === 'now' ? `Terbit ke ${res.data?.recipients ?? 0} orang.` : 'Terjadwal.', 'ok');
      router.push(`/announcements/${res.data?.announcementId}`);
    }
    router.refresh();
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!title.trim() || !beforeText.trim() || !afterText.trim() || !askWhom.trim()) return setError('Judul, Sebelumnya, Sekarang, dan Tanya ke wajib diisi.');
      if (letterCount(title.trim()) > RULE_TITLE_MAX) return setError(`Judul paling banyak ${RULE_TITLE_MAX} huruf.`);
      if (letterCount(beforeText.trim()) > RULE_TEXT_MAX || letterCount(afterText.trim()) > RULE_TEXT_MAX) return setError(`Sebelumnya dan Sekarang paling banyak ${RULE_TEXT_MAX} huruf.`);
      if (letterCount(askWhom.trim()) > RULE_ASK_MAX) return setError(`"Tanya ke" paling banyak ${RULE_ASK_MAX} huruf.`);
    }
    if (step === 1) {
      if (!all && !branchIds.length && !positionIds.length) return setError('Pilih Semua orang, atau minimal satu cabang atau jabatan.');
      if (recipients === 0) return setError('Tidak ada karyawan aktif pada sasaran ini.');
    }
    if (step === 2) {
      if (scheduled && (!publishesAt || new Date(publishesAt).getTime() <= Date.now())) return setError('Pilih jadwal terbit yang akan datang.');
      if (!effectiveOn) return setError('Tanggal berlaku wajib diisi.');
      if (earliest && effectiveOn < earliest) return setError(`Tanggal berlaku paling cepat ${dateText(earliest)}.`);
    }
    setStep((n) => n + 1);
  }

  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const chosen = (options: Option[], ids: number[]) => options.filter((o) => ids.includes(o.id)).map((o) => o.name).join(', ');
  const finishLabel = approval ? 'Kirim untuk disetujui' : scheduled ? 'Jadwalkan' : 'Terbitkan sekarang';

  return (
    <Card className="max-w-2xl space-y-5">
      <QueueHold />
      {correctsTitle && <Alert tone="warn" title="Ralat">Meralat &ldquo;{correctsTitle}&rdquo;. Sesudah ralat terbit, yang lama bertanda Diralat dan semua sasaran membaca lagi.</Alert>}
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? 'font-semibold text-brand-700' : 'text-ink-muted'}>{index + 1}. {label}</li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <Field id="rule-title" label="Judul" hint={`${letterCount(title.trim())}/${RULE_TITLE_MAX} huruf`}>
            <Input id="rule-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Tarif lembur naik" />
          </Field>
          <Field id="rule-before" label="Sebelumnya" hint="Aturan yang berlaku sekarang, dalam bahasa sehari-hari">
            <Textarea id="rule-before" value={beforeText} onChange={(e) => setBeforeText(e.target.value)} rows={3} />
          </Field>
          <Field id="rule-after" label="Sekarang" hint="Aturan yang baru">
            <Textarea id="rule-after" value={afterText} onChange={(e) => setAfterText(e.target.value)} rows={3} />
          </Field>
          <Field id="rule-ask" label="Kalau ada pertanyaan, tanya ke">
            <Input id="rule-ask" value={askWhom} onChange={(e) => setAskWhom(e.target.value)} placeholder="Contoh: HR (Bu Rina) atau kepala cabang" />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Jenis perubahan</legend>
            {(['UNFAVORABLE', 'FAVORABLE'] as const).map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm">
                <input type="radio" name="kind" checked={changeKind === kind} onChange={() => setChangeKind(kind)} /> {CHANGE_KIND_LABELS[kind]}
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={affectsMoney} onChange={(e) => setAffectsMoney(e.target.checked)} />
            <span>Menyangkut uang (gaji, denda, potongan, tarif, bonus, kasbon){!fullAccess && <span className="block text-xs text-ink-muted">Perlu disetujui Pemilik atau GM sebelum terbit.</span>}</span>
          </label>
          {supersedeOptions.length > 0 && (
            <Field id="rule-supersedes" label="Menggantikan aturan lama (tidak wajib)" hint="Aturan lama pindah ke Riwayat sejak tanggal berlaku yang baru">
              <Select id="rule-supersedes" value={supersedesId ?? ''} onChange={(e) => setSupersedesId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Tidak menggantikan —</option>
                {supersedeOptions.map((o) => <option key={o.id} value={o.id}>{o.title} (berlaku {dateText(o.effectiveOn)})</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sasaran — hanya mereka yang melihat pengumuman ini</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="target" checked={all} onChange={() => setAll(true)} /> Semua orang</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="target" checked={!all} onChange={() => setAll(false)} /> Cabang dan/atau jabatan tertentu</label>
          </fieldset>
          {!all && (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Cabang <span className="font-normal text-ink-muted">(kosong = semua cabang)</span></legend>
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => setBranchIds(toggle(branchIds, b.id))} /> {b.name}
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Jabatan <span className="font-normal text-ink-muted">(kosong = semua jabatan)</span></legend>
                {positions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={positionIds.includes(p.id)} onChange={() => setPositionIds(toggle(positionIds, p.id))} /> {p.name}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
          <p className="text-sm">Penerima: <strong>{recipients == null ? 'menghitung…' : `${recipients} orang`}</strong></p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Terbit</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="publish" checked={!scheduled} onChange={() => setScheduled(false)} /> {approval ? 'Saat disetujui' : 'Sekarang'}</label>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input type="radio" name="publish" checked={scheduled} onChange={() => setScheduled(true)} /> Jadwalkan (WIB)
              <Input type="datetime-local" className="w-auto" value={publishLocal} disabled={!scheduled} onChange={(e) => setPublishLocal(e.target.value)} aria-label="Jadwal terbit" />
            </label>
          </fieldset>
          <Field id="rule-effective" label="Mulai berlaku" hint={earliest ? `Paling cepat ${dateText(earliest)} (${changeKind === 'FAVORABLE' ? 'perubahan menguntungkan' : 'perubahan merugikan atau mengubah cara hitung'}). Tidak pernah berlaku di hari terbit.` : 'Menghitung…'}>
            <Input id="rule-effective" type="date" className="w-auto" min={earliest ?? undefined} value={effectiveOn} disabled={draft?.linked}
              onChange={(e) => setEffectiveOn(e.target.value)} />
          </Field>
          {draft?.linked && <p className="text-xs text-ink-muted">Pengumuman ini lahir dari perubahan pengaturan atau tarif ritase: tanggal berlaku terkunci, ralat hanya mengubah tulisan.</p>}
          {approval && <p className="text-xs text-ink-muted">Bila disetujui sesudah jadwal terbit lewat, pengumuman terbit saat disetujui dan tanggal berlaku bergeser bila jaraknya tidak lagi cukup.</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Pratinjau seperti yang dilihat karyawan:</p>
          <div className="space-y-2 rounded-card border border-line p-4">
            <h3 className="font-semibold">{title.trim()}</h3>
            <p className="text-sm"><span className="text-ink-muted">Sebelumnya: </span>{beforeText.trim()}</p>
            <p className="text-sm"><span className="text-ink-muted">Sekarang: </span><strong>{afterText.trim()}</strong></p>
            <p className="text-sm"><span className="text-ink-muted">Mulai berlaku: </span>{effectiveOn ? dateText(effectiveOn) : '—'}</p>
            <p className="text-sm"><span className="text-ink-muted">Kalau ada pertanyaan, tanya ke: </span>{askWhom.trim()}</p>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2"><dt className="text-ink-muted">Sasaran:</dt><dd>{all ? 'Semua orang' : [branchIds.length ? chosen(branches, branchIds) : 'semua cabang', positionIds.length ? chosen(positions, positionIds) : 'semua jabatan'].join(' · ')} ({recipients ?? '…'} orang)</dd></div>
            <div className="flex gap-2"><dt className="text-ink-muted">Terbit:</dt><dd>{scheduled && publishLocal ? publishLocal.replace('T', ' ') + ' WIB' : approval ? 'saat disetujui' : 'sekarang'}</dd></div>
            <div className="flex gap-2"><dt className="text-ink-muted">Jenis:</dt><dd>{CHANGE_KIND_LABELS[changeKind]}{affectsMoney ? ' · menyangkut uang' : ''}</dd></div>
          </dl>
          <p className="text-xs text-ink-muted">Sesudah terbit, pengumuman tidak bisa diubah. Bila salah: Ralat (semua membaca lagi), atau Tarik sebelum berlaku.</p>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => (step === 0 ? router.push('/announcements') : setStep((n) => n - 1))} disabled={busy}>
            {step === 0 ? 'Tutup' : 'Kembali'}
          </Button>
          <Button variant="ghost" onClick={() => void saveDraft()} disabled={busy}>Simpan sebagai konsep</Button>
        </div>
        {step < 3
          ? <Button onClick={next} disabled={step === 1 && recipients == null}>Lanjut</Button>
          : canPublish
            ? <HoldButton key="finish" loading={busy} onClick={() => void finish()}>{finishLabel}</HoldButton>
            : <p className="text-sm text-ink-muted">Anda menyiapkan konsep; HR atau Pemilik/GM yang menerbitkan.</p>}
      </div>
    </Card>
  );
}
