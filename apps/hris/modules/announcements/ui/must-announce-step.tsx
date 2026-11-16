'use client';

import { useState } from 'react';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';
import type { AnnouncePreview } from '@/modules/settings';
import { letterCount } from '../rules/emergency';
import { CHANGE_KIND_LABELS, RULE_TITLE_MAX, type RuleChangeKind } from '../rules/rule';
import { dateText } from './shared';

type Option = { id: number; name: string };
export type AnnounceOptions = { branches: Option[]; positions: Option[] };
type Target = { all: true } | { all: false; branchIds: number[]; positionIds: number[] };

/** Isian langkah Pengumuman yang dikirim bersama simpanan pengaturan/tarif (bentuk `announcementChoiceSchema`). */
export type MustAnnounceValue =
  | { mode: 'announce'; title: string; beforeText: string; afterText: string; askWhom: string; changeKind: RuleChangeKind; target: Target; publishesAt: string | null }
  | { mode: 'skip'; reason: string };

type AnnounceDraft = Extract<MustAnnounceValue, { mode: 'announce' }>;

/** Data langkah Pengumuman dari pintu pratinjau; `required` false = langsung simpan tanpa langkah ini. */
export type MustAnnounceData = { preview: AnnouncePreview; options: AnnounceOptions | null };

const join = (preview: AnnouncePreview, side: 'before' | 'after') =>
  preview.lines.length === 1 ? preview.lines[0][side] : preview.lines.map((line) => `${line.label}: ${line[side]}`).join('\n');

/** Isi awal dari pratinjau: judul = nama pengaturan, sebelumnya/sekarang dari nilai lama/baru, sasaran usulan. */
export function initialAnnounce(preview: AnnouncePreview): AnnounceDraft {
  return {
    mode: 'announce', title: [...preview.title].slice(0, RULE_TITLE_MAX).join(''), beforeText: join(preview, 'before'), afterText: join(preview, 'after'),
    askWhom: 'HR', changeKind: preview.changeKind ?? 'UNFAVORABLE', target: preview.target, publishesAt: null,
  };
}

/** Ambil isi awal langkah Pengumuman untuk simpanan pengaturan (pintu `/api/settings` announce_preview). */
export async function loadSettingAnnounce(body: {
  values: Record<string, unknown>; targetKind: 'ALL' | 'POSITION' | 'BRANCH'; targetId: number | null; effectiveFrom: string; title?: string;
}): Promise<{ ok: true; data: MustAnnounceData } | { ok: false; error: string }> {
  const res = await postJson('/api/settings', { kind: 'announce_preview', ...body });
  if (!res.ok || !res.data?.preview) return { ok: false, error: res.error ?? 'Gagal menyiapkan pengumuman.' };
  return { ok: true, data: { preview: res.data.preview as AnnouncePreview, options: (res.data.options as AnnounceOptions | null) ?? null } };
}

type Loaded = { ok: true; data: MustAnnounceData } | { ok: false; error: string };

/**
 * Alur langkah Pengumuman di layar yang punya jendela "Periksa": tekan Simpan pertama → ambil isi awal; bila wajib,
 * jendela menampilkan langkah Pengumuman dan Simpan berikutnya mengirim `payload()` bersama simpanan.
 */
export function useMustAnnounce() {
  const [data, setData] = useState<MustAnnounceData | null>(null);
  const [value, setValue] = useState<MustAnnounceValue | null>(null);
  const [loading, setLoading] = useState(false);
  /** 'step' = tampilkan langkah Pengumuman; 'save' = tidak wajib, langsung simpan; selain itu pesan galat. */
  async function prepare(load: () => Promise<Loaded>): Promise<'step' | 'save' | { error: string }> {
    setLoading(true);
    const loaded = await load();
    setLoading(false);
    if (!loaded.ok) return { error: loaded.error };
    if (!loaded.data.preview.required) return 'save';
    setData(loaded.data);
    setValue(initialAnnounce(loaded.data.preview));
    return 'step';
  }
  function reset() {
    setData(null);
    setValue(null);
  }
  /** Isian `announcement` untuk dikirim, atau galat pemeriksaan ringan. */
  function payload(): { announcement?: MustAnnounceValue; error?: string } {
    if (!value) return {};
    const problem = announceProblem(value);
    return problem ? { error: problem } : { announcement: value };
  }
  return { data, value, setValue, loading, prepare, reset, payload, active: !!data && !!value };
}

function toLocalWib(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}
function fromLocalWib(value: string): string | null {
  if (!value) return null;
  const at = new Date(`${value}:00+07:00`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** Pemeriksaan ringan sebelum dikirim; aturan lengkap (jarak tanggal, penerima) diperiksa server. */
export function announceProblem(value: MustAnnounceValue): string | null {
  if (value.mode === 'skip') return value.reason.trim() ? null : 'Alasan tidak perlu diumumkan wajib diisi.';
  if (!value.title.trim() || !value.beforeText.trim() || !value.afterText.trim() || !value.askWhom.trim()) {
    return 'Judul, Sebelumnya, Sekarang, dan Tanya ke wajib diisi.';
  }
  if (letterCount(value.title.trim()) > RULE_TITLE_MAX) return `Judul paling banyak ${RULE_TITLE_MAX} huruf.`;
  if (!value.target.all && !value.target.branchIds.length && !value.target.positionIds.length) return 'Pilih Semua orang, atau minimal satu cabang atau jabatan.';
  return null;
}

/**
 * Langkah Pengumuman (spec F3-3 §4.1): perubahan pengaturan bertanda wajib umumkan atau tarif ritase tersimpan
 * bersama pengumumannya di Papan Perubahan Aturan, atau ditandai "Tidak perlu diumumkan" dengan alasan.
 * Tanggal berlaku terkunci = tanggal berlaku perubahannya.
 */
export function MustAnnounceStep({ data, value, onChange, approval = false }: {
  data: MustAnnounceData; value: MustAnnounceValue; onChange: (value: MustAnnounceValue) => void;
  /** Usulan HR: pengumuman terbit saat usulan disetujui. */
  approval?: boolean;
}) {
  const { preview, options } = data;
  // Isian pengumuman diingat saat "Tidak perlu diumumkan" dicentang lalu dibatalkan.
  const [kept, setKept] = useState<AnnounceDraft>(() => (value.mode === 'announce' ? value : initialAnnounce(preview)));
  const draft = value.mode === 'announce' ? value : kept;
  const set = (patch: Partial<AnnounceDraft>) => {
    const next = { ...draft, ...patch };
    setKept(next);
    onChange(next);
  };
  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const target = draft.target;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium">Pengumuman <NewBadge feature="fitur/wajib-umumkan" /></p>
      <Alert tone="info" title="Wajib diumumkan">
        Perubahan ini masuk Papan Perubahan Aturan dan tersimpan bersama pengumumannya. Mulai berlaku <strong>{dateText(preview.effectiveFrom)}</strong> (terkunci,
        mengikuti tanggal berlaku perubahan). Rapikan bahasanya supaya mudah dipahami karyawan.
      </Alert>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={value.mode === 'skip'}
          onChange={(e) => onChange(e.target.checked ? { mode: 'skip', reason: '' } : draft)} />
        <span>Tidak perlu diumumkan<span className="block text-xs text-ink-muted">Alasan wajib dan tercatat di riwayat perubahan.</span></span>
      </label>
      {value.mode === 'skip' ? (
        <Field id="ma-skip" label="Alasan tidak perlu diumumkan">
          <Textarea id="ma-skip" value={value.reason} onChange={(e) => onChange({ mode: 'skip', reason: e.target.value })} />
        </Field>
      ) : (
        <>
          <Field id="ma-title" label="Judul" hint={`${letterCount(draft.title.trim())}/${RULE_TITLE_MAX} huruf`}>
            <Input id="ma-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field id="ma-before" label="Sebelumnya">
            <Textarea id="ma-before" rows={Math.min(6, Math.max(2, preview.lines.length))} value={draft.beforeText} onChange={(e) => set({ beforeText: e.target.value })} />
          </Field>
          <Field id="ma-after" label="Sekarang">
            <Textarea id="ma-after" rows={Math.min(6, Math.max(2, preview.lines.length))} value={draft.afterText} onChange={(e) => set({ afterText: e.target.value })} />
          </Field>
          <Field id="ma-ask" label="Kalau ada pertanyaan, tanya ke">
            <Input id="ma-ask" value={draft.askWhom} onChange={(e) => set({ askWhom: e.target.value })} />
          </Field>
          {preview.changeKind ? (
            <p className="text-sm"><span className="text-ink-muted">Jenis perubahan: </span>{CHANGE_KIND_LABELS[preview.changeKind]}</p>
          ) : (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Jenis perubahan</legend>
              {(['UNFAVORABLE', 'FAVORABLE'] as const).map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="ma-kind" checked={draft.changeKind === kind} onChange={() => set({ changeKind: kind })} /> {CHANGE_KIND_LABELS[kind]}
                </label>
              ))}
            </fieldset>
          )}
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Sasaran</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="ma-target" checked={target.all} onChange={() => set({ target: { all: true } })} /> Semua orang
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="ma-target" checked={!target.all}
                onChange={() => set({ target: { all: false, branchIds: [], positionIds: [] } })} /> Cabang dan/atau jabatan tertentu
            </label>
          </fieldset>
          {!target.all && options && (
            <div className="grid max-h-56 gap-3 overflow-y-auto sm:grid-cols-2">
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Cabang <span className="font-normal text-ink-muted">(kosong = semua)</span></legend>
                {options.branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={target.branchIds.includes(b.id)}
                      onChange={() => set({ target: { ...target, branchIds: toggle(target.branchIds, b.id) } })} /> {b.name}
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Jabatan <span className="font-normal text-ink-muted">(kosong = semua)</span></legend>
                {options.positions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={target.positionIds.includes(p.id)}
                      onChange={() => set({ target: { ...target, positionIds: toggle(target.positionIds, p.id) } })} /> {p.name}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Terbit</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="ma-publish" checked={!draft.publishesAt} onChange={() => set({ publishesAt: null })} /> {approval ? 'Saat disetujui' : 'Sekarang'}
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input type="radio" name="ma-publish" checked={!!draft.publishesAt}
                onChange={() => set({ publishesAt: new Date(Date.now() + 3600_000).toISOString() })} /> Jadwalkan (WIB)
              <Input type="datetime-local" className="w-auto" aria-label="Jadwal terbit" disabled={!draft.publishesAt}
                value={draft.publishesAt ? toLocalWib(draft.publishesAt) : ''} onChange={(e) => set({ publishesAt: fromLocalWib(e.target.value) })} />
            </label>
          </fieldset>
        </>
      )}
    </div>
  );
}
