import { getOrgLookup, type Actor } from '@/modules/access';
import { supersedeOptions } from '@/modules/announcements';

/** Pilihan layar Tulis perubahan aturan: cabang/jabatan aktif dan aturan yang bisa digantikan. */
export async function writeRuleOptions(actor: Actor) {
  const [org, supersede] = await Promise.all([getOrgLookup(), supersedeOptions(actor)]);
  return {
    branches: org.branches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name })),
    positions: org.positions.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
    supersedeOptions: supersede,
  };
}
