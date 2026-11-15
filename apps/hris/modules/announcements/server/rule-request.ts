import { db } from '@/lib/db';
import { getOrgLookup, type Actor, type Tx } from '@/modules/access';
import { CHANGE_KIND_LABELS } from '../rules/rule';
import type { EmergencyTarget } from '../rules/emergency';
import {
  closeSubmitted, draftByRequest, markDraftSubmitted, prepareRuleSubmit, publishApproved, scheduleIfApprovedNow, scheduleText,
} from './rules';
import { countRecipients } from './emergency';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };

function targetLine(target: EmergencyTarget, names: { branches: Map<number, string>; positions: Map<number, string> }): string {
  if (target.all) return 'Semua orang';
  const branches = target.branchIds.map((id) => names.branches.get(id) ?? `Cabang #${id}`);
  const positions = target.positionIds.map((id) => names.positions.get(id) ?? `Jabatan #${id}`);
  return [branches.length ? `Cabang: ${branches.join(', ')}` : 'Semua cabang', positions.length ? `Jabatan: ${positions.join(', ')}` : 'semua jabatan'].join(' · ');
}

/**
 * Isi khas pengajuan "Pengumuman perubahan aturan" (spec F3-3 §3.4): pengumuman yang menyangkut uang dari HR
 * menunggu Pemilik/GM. Bentuknya mengikuti `RequestHandler` modul `requests`; dirangkai di `lib/request-handlers.ts`.
 */
export function ruleAnnouncementHandler() {
  return {
    async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
      const draftId = Number(input.draftId);
      if (!Number.isInteger(draftId) || draftId <= 0) return { ok: false, status: 400, error: 'Konsep tidak dikenal.' } as Fail;
      const checked = await prepareRuleSubmit(tx, actor, draftId);
      if (!checked.ok) return checked as Fail;
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Perubahan aturan: ${checked.value.value.title} (berlaku ${checked.value.value.effectiveOn})`,
          dedupeKey: `rule_announcement:${draftId}`,
          requiredAttachment: null,
          save: (saveTx: Tx, requestId: number) => markDraftSubmitted(saveTx, actor, draftId, requestId),
        },
      };
    },

    async apply(tx: Tx, actorAccountId: number, requestId: number) {
      const result = await publishApproved(tx, actorAccountId, requestId);
      if (!result.ok) return result as Fail;
      return { ok: true as const, effect: result.value.text };
    },

    async close(tx: Tx, actorAccountId: number, requestId: number, reason: string) {
      await closeSubmitted(tx, actorAccountId, requestId, reason);
    },

    async effectPreview(requestId: number) {
      const row = await draftByRequest(db, requestId);
      if (!row) return 'Pengumuman ini akan terbit.';
      const schedule = await scheduleIfApprovedNow(row);
      const recipients = await countRecipients(row.target as EmergencyTarget);
      return `${scheduleText(schedule.publishesAt, schedule.effectiveOn, schedule.shifted)} Penerima sekarang: ${recipients} orang.`;
    },

    async describe(requestId: number) {
      const row = await draftByRequest(db, requestId);
      if (!row) return [];
      const org = await getOrgLookup();
      const names = { branches: new Map(org.branches.map((b) => [b.id, b.name])), positions: new Map(org.positions.map((p) => [p.id, p.name])) };
      const when = row.publishesAt ? row.publishesAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : 'saat disetujui';
      const rows = [
        { label: 'Judul', before: null, after: row.title },
        { label: 'Aturan', before: row.beforeText, after: row.afterText },
        { label: 'Kalau ada pertanyaan, tanya ke', before: null, after: row.askWhom },
        { label: 'Jenis perubahan', before: null, after: CHANGE_KIND_LABELS[row.changeKind] },
        { label: 'Sasaran', before: null, after: targetLine(row.target as EmergencyTarget, names) },
        { label: 'Jadwal terbit', before: null, after: when },
        { label: 'Mulai berlaku', before: null, after: row.effectiveOn },
      ];
      if (row.correctsAnnouncementId) {
        rows.push({ label: 'Ralat dari pengumuman', before: null, after: `#${row.correctsAnnouncementId}` });
      }
      return rows;
    },

    async resubmitValues() {
      // Diajukan dari layar Tulis perubahan aturan; ditolak → "Salin jadi konsep baru" di Kantor › Pengumuman.
      return null;
    },
  };
}
