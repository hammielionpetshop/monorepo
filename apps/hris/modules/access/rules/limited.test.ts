import { describe, expect, it } from 'vitest';
import { limitedPathAllowed } from './limited';

// Spec L4g §3.7: alamat yang terbuka untuk mantan karyawan dalam akses terbatas.
describe('alamat akses terbatas', () => {
  it('hanya Pendapatan Saya, Pengajuan Saya, Pemberitahuan, Profil, dan pintu API-nya', () => {
    for (const ok of ['/', '/earnings', '/earnings/payslips/12', '/earnings/payslips/12/objections', '/requests', '/requests/9', '/notifications', '/profile',
      '/api/requests', '/api/requests/9/attachments/abc', '/api/files', '/api/payroll', '/api/notifications']) {
      expect(limitedPathAllowed(ok), ok).toBe(true);
    }
    for (const no of ['/clock-in', '/requests/new', '/requests/new/identity_change', '/payroll', '/accounts', '/login-history', '/api/payroll/totals',
      '/api/payroll/transfer', '/api/employees/me', '/api/accounts/me', '/pendapatanx', null, '']) {
      expect(limitedPathAllowed(no), String(no)).toBe(false);
    }
  });
});
