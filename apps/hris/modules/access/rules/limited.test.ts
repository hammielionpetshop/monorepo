import { describe, expect, it } from 'vitest';
import { limitedPathAllowed } from './limited';

// Spec L4g §3.7: alamat yang terbuka untuk mantan karyawan dalam akses terbatas.
describe('alamat akses terbatas', () => {
  it('hanya Pendapatan Saya, Pengajuan Saya, Pemberitahuan, Profil, dan pintu API-nya', () => {
    for (const ok of ['/', '/pendapatan', '/pendapatan/slip/12', '/pendapatan/slip/12/keberatan', '/pengajuan', '/pengajuan/9', '/pemberitahuan', '/profil',
      '/api/requests', '/api/requests/9/attachments/abc', '/api/files', '/api/payroll', '/api/notifications']) {
      expect(limitedPathAllowed(ok), ok).toBe(true);
    }
    for (const no of ['/absen', '/pengajuan/baru', '/pengajuan/baru/identity_change', '/gaji', '/akun', '/riwayat-masuk', '/api/payroll/totals',
      '/api/payroll/transfer', '/api/employees/me', '/api/accounts/me', '/pendapatanx', null, '']) {
      expect(limitedPathAllowed(no), String(no)).toBe(false);
    }
  });
});
