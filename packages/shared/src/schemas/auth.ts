import { z } from 'zod';

export const loginStaffPinSchema = z.object({
  mode: z.literal('staff_pin'),
  staffNumber: z.string().min(1, 'Nomor staff wajib diisi'),
  pin: z.string().min(4, 'PIN minimal 4 digit').max(6, 'PIN maksimal 6 digit'),
});

export const loginEmailPasswordSchema = z.object({
  mode: z.literal('email_password'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

// Login backoffice generik: identifier = email ATAU username; kredensial = password ATAU PIN.
// Menggantikan `email_password` mulai S3 (resolver di route.ts). `credential` hanya divalidasi
// non-empty di sini — verifikasi sebenarnya via argon2 agar password/PIN legacy tak tertolak.
//
// CATATAN: sengaja BELUM digabung ke `loginSchema` discriminatedUnion. Penggabungan ditunda ke
// S3 agar dilakukan atomik bersama penulisan ulang route.ts + login page (menambah `mode:'bo'`
// ke union sekarang akan memutus narrowing di route yang masih menangani `email_password`).
export const loginBoSchema = z.object({
  mode: z.literal('bo'),
  identifier: z.string().min(1, 'Email atau username wajib diisi'),
  credential: z.string().min(1, 'Password atau PIN wajib diisi'),
  credentialType: z.enum(['password', 'pin']),
});

export const loginSchema = z.discriminatedUnion('mode', [
  loginStaffPinSchema,
  loginEmailPasswordSchema,
]);

// Onboarding first-login: wajib ganti password + isi PIN. Penolakan nilai == default
// dilakukan di route (butuh baca app_settings), bukan di schema.
export const onboardingSchema = z.object({
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN harus 4–6 digit angka'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginStaffPinInput = z.infer<typeof loginStaffPinSchema>;
export type LoginEmailPasswordInput = z.infer<typeof loginEmailPasswordSchema>;
export type LoginBoInput = z.infer<typeof loginBoSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
