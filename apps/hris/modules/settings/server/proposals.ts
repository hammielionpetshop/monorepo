import { eq, sql } from 'drizzle-orm';
import { positionSettingProposals, settingValues } from '@petshop/hris-db/schema/settings';
import { db } from '@/lib/db';
import { can, getOrgLookup, recordAudit, type Actor, type ChangeAnnounce, type Tx } from '@/modules/access';
import { SETTINGS, isSettingKey, type SettingDefinition, type SettingKey } from '../rules/registry';
import {
  earliestEffectiveFrom, effectiveDateProblem, formatSettingValue, resolveSetting, sameValue, todayWib, valueProblem,
} from '../rules/resolve';
import { loadRows } from './read';
import { checkReason } from './write';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const lockKey = (key: string, kind: string, id: number | null) => `setting:${key}:${kind}:${id ?? 0}`;
const targetOf = (kind: string, id: number | null) => (kind === 'POSITION' ? { positionId: id } : {});

async function targetLabel(kind: string, id: number | null): Promise<string> {
  if (kind !== 'POSITION') return 'semua jabatan';
  const org = await getOrgLookup();
  return `jabatan ${org.positions.find((p) => p.id === id)?.name ?? `#${id}`}`;
}

async function load(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor
    .select({ proposal: positionSettingProposals, value: settingValues })
    .from(positionSettingProposals)
    .innerJoin(settingValues, eq(settingValues.id, positionSettingProposals.settingValueId))
    .where(eq(positionSettingProposals.requestId, requestId));
  return row && isSettingKey(row.value.key) ? { ...row, key: row.value.key as SettingKey } : null;
}

function show(key: SettingKey, value: unknown): string {
  return value == null ? 'belum ada' : formatSettingValue(key, value);
}

/**
 * Isi khas pengajuan "Usulan Pengaturan Jabatan" (KAR-73, spec L2f-2 §2). Bentuknya mengikuti `RequestHandler`
 * modul `requests`; dirangkai di `lib/request-handlers.ts`, jadi modul ini tidak mengimpor modul `requests`.
 */
export function positionSettingHandler(announce: ChangeAnnounce) {
  return {
    async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
      const key = typeof input.key === 'string' ? input.key : '';
      if (!isSettingKey(key)) return fail(400, 'Pengaturan tidak dikenal.');
      const settingKey: SettingKey = key;
      const definition: SettingDefinition = SETTINGS[settingKey];
      if (definition.review !== 'PROPOSE_APPROVE') return fail(400, 'Pengaturan ini tidak melalui usulan.');
      if (can(actor, definition.editAction)) return fail(400, 'Anda bisa mengubah pengaturan ini langsung dari Pengaturan Jabatan.');
      const targetKind = input.targetKind;
      if (targetKind !== 'ALL' && targetKind !== 'POSITION') return fail(400, 'Sasaran pengaturan tidak valid.');
      const targetId = targetKind === 'ALL' ? null : Number(input.targetId);
      if (targetKind === 'POSITION') {
        const org = await getOrgLookup();
        if (!org.positions.some((p) => p.id === targetId && p.active)) return fail(400, 'Jabatan tidak ditemukan atau nonaktif.');
      }
      const problem = valueProblem(definition, input.value);
      if (problem) return fail(400, problem);
      const dateProblem = effectiveDateProblem(definition, input.effectiveFrom, todayWib());
      if (dateProblem) return fail(400, dateProblem);
      const effectiveFrom = input.effectiveFrom as string;
      const reason = await checkReason(input.reason);
      if (!reason.ok) return fail(400, reason.error);

      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey(settingKey, targetKind, targetId)}))`);
      const rows = await loadRows(tx, [settingKey]);
      const own = rows.filter((r) => r.targetKind === targetKind && r.targetId === targetId);
      if (own.some((r) => r.status === 'ACTIVE' && r.effectiveFrom === effectiveFrom)) {
        return fail(409, 'Sudah ada nilai yang berlaku di tanggal itu. Pilih tanggal lain.');
      }
      const current = resolveSetting(rows, effectiveFrom, targetOf(targetKind, targetId));
      if (current && sameValue(current.value, input.value)) return fail(400, 'Nilainya sama dengan yang berlaku pada tanggal itu; tidak ada yang berubah.');

      const label = await targetLabel(targetKind, targetId);
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `${definition.label} ${label}: ${show(settingKey, current?.value)} → ${show(settingKey, input.value)}, mulai ${longDate(effectiveFrom)}`,
          dedupeKey: `position_setting:${settingKey}:${targetKind}:${targetId ?? 0}`,
          requiredAttachment: null,
          save: async (saveTx: Tx, requestId: number) => {
            const [value] = await saveTx.insert(settingValues).values({
              key: settingKey, targetKind, targetId, value: input.value, effectiveFrom, status: 'PROPOSED',
              reason: reason.reason, createdByAccountId: actor.accountId,
            }).returning({ id: settingValues.id });
            await saveTx.insert(positionSettingProposals).values({ requestId, settingValueId: value.id, beforeValue: current?.value ?? null });
            await recordAudit(saveTx, {
              actorAccountId: actor.accountId, entity: 'setting', entityId: value.id, action: 'setting.propose',
              before: current ? { value: current.value, effectiveFrom: current.effectiveFrom } : null,
              after: { key: settingKey, targetKind, targetId, value: input.value, effectiveFrom, requestId },
              reason: reason.reason,
            });
          },
        },
      };
    },

    async apply(tx: Tx, actorAccountId: number, requestId: number) {
      const row = await load(tx, requestId);
      if (!row) return fail(404, 'Usulan tidak ditemukan.');
      const { value: setting, key } = row;
      const definition: SettingDefinition = SETTINGS[key];
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey(key, setting.targetKind, setting.targetId)}))`);
      const REJECT_HINT = 'Tolak usulan ini dan minta diajukan ulang.';
      if (setting.effectiveFrom < earliestEffectiveFrom(definition, todayWib())) {
        return fail(409, `Tanggal berlaku usulan sudah lewat. ${REJECT_HINT}`);
      }
      const rows = await loadRows(tx, [key]);
      const own = rows.filter((r) => r.targetKind === setting.targetKind && r.targetId === setting.targetId);
      if (own.some((r) => r.status === 'ACTIVE' && r.effectiveFrom === setting.effectiveFrom)) {
        return fail(409, `Sudah ada nilai lain yang berlaku di tanggal itu. ${REJECT_HINT}`);
      }
      const current = resolveSetting(rows, setting.effectiveFrom, targetOf(setting.targetKind, setting.targetId));
      if (!sameValue(current?.value ?? null, row.proposal.beforeValue ?? null)) {
        return fail(409, `Nilai pengaturan ini sudah berubah sejak diusulkan. ${REJECT_HINT}`);
      }
      await tx.update(settingValues).set({ status: 'ACTIVE', approvedByAccountId: actorAccountId, approvedAt: new Date() })
        .where(eq(settingValues.id, setting.id));
      const label = await targetLabel(setting.targetKind, setting.targetId);
      const effect = `${definition.label} ${label} menjadi ${show(key, setting.value)} mulai ${longDate(setting.effectiveFrom)}.`;
      await recordAudit(tx, {
        actorAccountId, entity: 'setting', entityId: setting.id, action: 'setting.approve',
        before: { status: 'PROPOSED', value: row.proposal.beforeValue }, after: { status: 'ACTIVE', value: setting.value, requestId },
        reason: setting.reason,
      });
      await announce(tx, actorAccountId, {
        what: `menyetujui usulan: ${effect}`, link: `/persetujuan/${requestId}`, entity: 'setting', entityId: setting.id,
      });
      return { ok: true as const, effect };
    },

    /** Usulan ditolak atau dibatalkan: nilainya gugur di transaksi yang sama. */
    async close(tx: Tx, actorAccountId: number, requestId: number, reason: string) {
      const row = await load(tx, requestId);
      if (!row || row.value.status !== 'PROPOSED') return;
      await tx.update(settingValues).set({ status: 'CANCELLED', cancelledByAccountId: actorAccountId, cancelledAt: new Date(), cancelReason: reason })
        .where(eq(settingValues.id, row.value.id));
      await recordAudit(tx, {
        actorAccountId, entity: 'setting', entityId: row.value.id, action: 'setting.cancel',
        before: { status: 'PROPOSED', value: row.value.value }, after: { status: 'CANCELLED', requestId }, reason,
      });
    },

    async effectPreview(requestId: number) {
      const row = await load(db, requestId);
      if (!row) return 'Usulan ini akan disetujui.';
      const label = await targetLabel(row.value.targetKind, row.value.targetId);
      return `${SETTINGS[row.key].label} ${label} menjadi ${show(row.key, row.value.value)} mulai ${longDate(row.value.effectiveFrom)}.`;
    },

    async describe(requestId: number) {
      const row = await load(db, requestId);
      if (!row) return [];
      return [
        { label: 'Pengaturan', before: null, after: SETTINGS[row.key].label },
        { label: 'Berlaku untuk', before: null, after: await targetLabel(row.value.targetKind, row.value.targetId) },
        { label: 'Nilai', before: show(row.key, row.proposal.beforeValue), after: show(row.key, row.value.value) },
        { label: 'Mulai berlaku', before: null, after: longDate(row.value.effectiveFrom) },
        { label: 'Alasan', before: null, after: row.value.reason },
      ];
    },

    async resubmitValues(requestId: number) {
      const row = await load(db, requestId);
      if (!row) return null;
      return {
        key: row.key, targetKind: row.value.targetKind, targetId: row.value.targetId, value: row.value.value,
        effectiveFrom: row.value.effectiveFrom, reason: row.value.reason,
      };
    },
  };
}
