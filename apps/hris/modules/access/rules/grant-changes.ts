import { ACTIONS, SCOPES, type ActionCatalog, type Scope } from './actions';
import { can, type Actor } from './can';

export type GrantChange = { action: string; scope: Scope | null };
export type PositionForGrants = { id: number; name: string; fullAccess: boolean; highRights: boolean };

/**
 * Batas keras saat menyimpan Hak Akses Jabatan (spec L2b §4, KAR-72). Server selalu memanggil ini,
 * walau layar sudah tidak menawarkan pilihan yang menabrak. Mengembalikan daftar pesan; kosong = boleh.
 */
export function validateGrantChanges(
  actor: Actor | null,
  position: PositionForGrants,
  changes: GrantChange[],
  catalog: ActionCatalog = ACTIONS,
): string[] {
  if (!can(actor, 'position.grants.update')) return ['Anda tidak berhak mengubah Hak Akses Jabatan.'];
  if (position.fullAccess) {
    return [`Hak jabatan ${position.name} mengikuti Pemilik dan tidak bisa diubah.`];
  }
  if (actor && actor.positionId === position.id) {
    return ['Tidak bisa mengubah hak jabatan yang sedang Anda pegang.'];
  }
  if (!changes.length) return ['Tidak ada perubahan untuk disimpan.'];

  const errors: string[] = [];
  const seen = new Set<string>();
  for (const change of changes) {
    const definition = Object.hasOwn(catalog, change.action) ? catalog[change.action] : undefined;
    if (!definition) {
      errors.push(`Tindakan "${change.action}" tidak dikenal.`);
      continue;
    }
    if (seen.has(change.action)) {
      errors.push(`Tindakan "${definition.label}" disebut lebih dari sekali.`);
      continue;
    }
    seen.add(change.action);
    if (change.scope === null) continue;
    if (!SCOPES.includes(change.scope)) {
      errors.push(`Lingkup untuk "${definition.label}" tidak dikenal.`);
    } else if (definition.ownerOnly) {
      errors.push(`"${definition.label}" hanya untuk Pemilik dan GM, tidak bisa diberikan ke jabatan lain.`);
    } else if (definition.selfOnly && change.scope !== 'SELF') {
      errors.push(`"${definition.label}" hanya boleh berlingkup diri sendiri.`);
    } else if (definition.highRightsOnly && !position.highRights) {
      errors.push(`"${definition.label}" hanya untuk jabatan berhak tinggi.`);
    }
  }
  return errors;
}
