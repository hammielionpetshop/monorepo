import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_NAMES, type ActionCatalog, type Scope } from './actions';
import { can, hasAction, type Actor } from './can';
import { validateGrantChanges, type PositionForGrants } from './grant-changes';

function actor(overrides: Partial<Omit<Actor, 'grants'>> & { grants?: Record<string, Scope> } = {}): Actor {
  const { grants, ...rest } = overrides;
  return {
    accountId: 1, personId: 10, positionId: 5, fullAccess: false, highRights: false,
    branchId: 100, departmentId: 7, grants: new Map(Object.entries(grants ?? {})), ...rest,
  };
}

const owner = actor({ positionId: 1, fullAccess: true, highRights: true });
const cashierPosition: PositionForGrants = { id: 20, name: 'Kasir', fullAccess: false, highRights: false };

describe('can()', () => {
  it('bawaan tertutup: tanpa pelaku atau tanpa jabatan selalu ditolak', () => {
    expect(can(null, 'profile.view')).toBe(false);
    expect(can(actor({ positionId: null, fullAccess: true }), 'profile.view')).toBe(false);
    expect(hasAction(null, 'org.manage')).toBe(false);
  });

  it('lingkup diri sendiri hanya untuk data miliknya', () => {
    const a = actor({ grants: { 'profile.view': 'SELF' } });
    expect(can(a, 'profile.view', { personId: 10 })).toBe(true);
    expect(can(a, 'profile.view', { personId: 11, branchId: 100 })).toBe(false);
    expect(can(a, 'profile.view')).toBe(false);
  });

  it('lingkup cabang dan departemen mengikuti penempatan pelaku', () => {
    const a = actor({ grants: { 'employee.list': 'BRANCH', 'employee.update': 'DEPARTMENT' } });
    expect(can(a, 'employee.list', { personId: 11, branchId: 100 })).toBe(true);
    expect(can(a, 'employee.list', { personId: 12, branchId: 200 })).toBe(false);
    expect(can(a, 'employee.update', { personId: 11, departmentId: 7 })).toBe(true);
    expect(can(a, 'employee.update', { personId: 11, departmentId: 8 })).toBe(false);
    expect(can(actor({ branchId: null, grants: { 'employee.list': 'BRANCH' } }), 'employee.list', { branchId: null })).toBe(false);
  });

  it('lingkup semua lolos tanpa target; menu memakai hasAction dengan lingkup apa pun', () => {
    const a = actor({ grants: { 'org.manage': 'ALL', 'profile.view': 'SELF' } });
    expect(can(a, 'org.manage')).toBe(true);
    expect(hasAction(a, 'profile.view')).toBe(true);
    expect(hasAction(a, 'employee.list')).toBe(false);
  });

  it('Pemilik/GM berhak semua tindakan, termasuk yang hanya untuk mereka', () => {
    for (const action of ACTION_NAMES) expect(can(owner, action, { personId: 99 })).toBe(true);
    expect(hasAction(owner, 'position.grants.update')).toBe(true);
  });

  it('tindakan ownerOnly tetap ditolak walau barisnya ada (data disusupkan)', () => {
    const a = actor({ grants: { 'position.grants.update': 'ALL', view_as: 'ALL' } });
    expect(can(a, 'position.grants.update')).toBe(false);
    expect(can(a, 'view_as', { personId: 11 })).toBe(false);
    expect(hasAction(a, 'position.grants.update')).toBe(false);
  });

  it('KAR-72: tindakan terlarang atas diri sendiri ditolak, termasuk untuk Pemilik', () => {
    const hr = actor({ grants: { 'placement.record': 'ALL', 'employee.activation': 'ALL' } });
    expect(can(hr, 'placement.record', { personId: 10 })).toBe(false);
    expect(can(hr, 'employee.activation', { personId: 10 })).toBe(false);
    expect(can(hr, 'placement.record', { personId: 11 })).toBe(true);
    expect(can(owner, 'employee.activation', { personId: owner.personId })).toBe(false);
    expect(can(owner, 'position_settings.approve', { personId: owner.personId })).toBe(false);
  });
});

describe('validateGrantChanges()', () => {
  const admin = actor({ positionId: 2, fullAccess: true, highRights: true });

  it('hanya Pemilik/GM yang boleh mengubah', () => {
    const hr = actor({ grants: { 'org.manage': 'ALL' } });
    expect(validateGrantChanges(hr, cashierPosition, [{ action: 'employee.list', scope: 'ALL' }])).toEqual([
      'Anda tidak berhak mengubah Hak Akses Jabatan.',
    ]);
    expect(validateGrantChanges(null, cashierPosition, [{ action: 'employee.list', scope: 'ALL' }])).toHaveLength(1);
  });

  it('jabatan berhak penuh tidak bisa diubah haknya', () => {
    const gm: PositionForGrants = { id: 3, name: 'GM', fullAccess: true, highRights: true };
    expect(validateGrantChanges(admin, gm, [{ action: 'employee.list', scope: null }])[0]).toContain('mengikuti Pemilik');
  });

  it('tidak bisa mengubah hak jabatan sendiri', () => {
    const own = { ...cashierPosition, id: admin.positionId as number };
    expect(validateGrantChanges(admin, own, [{ action: 'employee.list', scope: 'ALL' }])[0]).toContain('sedang Anda pegang');
  });

  it('menolak ownerOnly, lingkup salah untuk selfOnly, tindakan tak dikenal, dan duplikat', () => {
    const errors = validateGrantChanges(admin, cashierPosition, [
      { action: 'position.grants.update', scope: 'ALL' },
      { action: 'contact.update_own', scope: 'ALL' },
      { action: 'tidak.ada', scope: 'ALL' },
      { action: 'employee.list', scope: 'ALL' },
      { action: 'employee.list', scope: null },
    ]);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain('hanya untuk Pemilik dan GM');
    expect(errors[1]).toContain('diri sendiri');
  });

  it('mencabut tindakan ownerOnly (lingkup kosong) tetap boleh, dan perubahan sah lolos', () => {
    expect(validateGrantChanges(admin, cashierPosition, [
      { action: 'view_as', scope: null },
      { action: 'employee.list', scope: 'BRANCH' },
      { action: 'contact.update_own', scope: 'SELF' },
    ])).toEqual([]);
  });

  it('tindakan highRightsOnly hanya untuk jabatan berhak tinggi', () => {
    const catalog: ActionCatalog = { ...ACTIONS, 'salary.view': { label: 'Lihat gaji', group: 'Gaji', highRightsOnly: true } };
    expect(validateGrantChanges(admin, cashierPosition, [{ action: 'salary.view', scope: 'ALL' }], catalog)[0])
      .toContain('berhak tinggi');
    expect(validateGrantChanges(admin, { ...cashierPosition, highRights: true }, [{ action: 'salary.view', scope: 'ALL' }], catalog))
      .toEqual([]);
  });
});

describe('hak Akun & Tautan', () => {
  const other = { personId: 11, branchId: 100, departmentId: 7 };
  const self = { personId: 10, branchId: 100, departmentId: 7 };

  it('Pemilik/GM mengelola akun orang lain, tetapi tidak akun sendiri (KAR-34, KAR-72)', () => {
    for (const action of ['account.manage', 'account.reset_password', 'backoffice_access.manage', 'sessions.revoke'] as const) {
      expect(can(owner, action, other)).toBe(true);
      expect(can(owner, action, self)).toBe(false);
    }
  });

  it('tindakan akun hanya untuk Pemilik/GM walau tercatat di hak jabatan lain', () => {
    const hr = actor({ grants: { 'account.manage': 'ALL', 'account.reset_password': 'ALL', 'backoffice_access.manage': 'ALL', 'sessions.revoke': 'ALL' } });
    expect(can(hr, 'account.manage', other)).toBe(false);
    expect(can(hr, 'account.reset_password', other)).toBe(false);
    expect(can(hr, 'backoffice_access.manage', other)).toBe(false);
    // Mengeluarkan orang dari perangkat tetap hak HR (00-peta-modul), kecuali atas dirinya sendiri.
    expect(can(hr, 'sessions.revoke', other)).toBe(true);
    expect(can(hr, 'sessions.revoke', self)).toBe(false);
  });
});
