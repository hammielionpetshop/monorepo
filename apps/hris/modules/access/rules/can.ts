import { ACTIONS, type ActionDefinition, type ActionName, type Scope } from './actions';

/**
 * Pelaku sebuah permintaan, dibaca ulang tiap permintaan (hak berubah langsung berlaku).
 * Cabang/departemen = penempatan pelaku pada tanggal data (KAR-56); sumbernya dipilih server.
 */
export type Actor = {
  accountId: number;
  personId: number;
  positionId: number | null;
  fullAccess: boolean;
  highRights: boolean;
  branchId: number | null;
  departmentId: number | null;
  grants: ReadonlyMap<string, Scope>;
};

/** Data yang hendak disentuh: pemiliknya dan penempatannya pada tanggal data. */
export type Target = {
  personId?: number | null;
  branchId?: number | null;
  departmentId?: number | null;
};

function scopeCovers(actor: Actor, scope: Scope, target: Target): boolean {
  if (scope === 'ALL') return true;
  if (target.personId != null && target.personId === actor.personId) return true;
  if (scope === 'BRANCH') return actor.branchId != null && target.branchId === actor.branchId;
  if (scope === 'DEPARTMENT') return actor.departmentId != null && target.departmentId === actor.departmentId;
  return false;
}

/**
 * Satu-satunya pemeriksa hak. Bawaan tertutup: tanpa pelaku, tanpa jabatan, atau tindakan
 * tak dikenal: tolak. Tanpa target, hanya lingkup "semua" yang lolos.
 */
export function can(actor: Actor | null, action: ActionName, target?: Target): boolean {
  if (!actor || actor.positionId == null) return false;
  const definition: ActionDefinition | undefined = ACTIONS[action];
  if (!definition) return false;
  const isSelf = target?.personId != null && target.personId === actor.personId;
  if (definition.selfForbidden && isSelf) return false;
  if (actor.fullAccess) return true;
  if (definition.ownerOnly) return false;
  const scope = actor.grants.get(action);
  if (!scope) return false;
  return scopeCovers(actor, scope, target ?? {});
}

/** Untuk menu dan tombol: punya tindakan ini dengan lingkup apa pun. Penjaga tetap `can()`. */
export function hasAction(actor: Actor | null, action: ActionName): boolean {
  if (!actor || actor.positionId == null) return false;
  if (actor.fullAccess) return true;
  const definition: ActionDefinition | undefined = ACTIONS[action];
  if (!definition || definition.ownerOnly) return false;
  return actor.grants.has(action);
}
