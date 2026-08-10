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
// `credential` hanya divalidasi non-empty di sini — verifikasi sebenarnya via argon2 agar
// password/PIN legacy tak tertolak.
//
// Mode `email_password` sengaja DIPERTAHANKAN di union: web-POS (`app/pos/login`) masih memakainya.
// `bo` adalah mode baru khusus login backoffice (mendukung username & PIN), berdampingan.
export const loginBoSchema = z.object({
  mode: z.literal('bo'),
  identifier: z.string().min(1, 'Email atau username wajib diisi'),
  credential: z.string().min(1, 'Password atau PIN wajib diisi'),
  credentialType: z.enum(['password', 'pin']),
});

export const loginSchema = z.discriminatedUnion('mode', [
  loginStaffPinSchema,
  loginEmailPasswordSchema,
  loginBoSchema,
]);

// Onboarding first-login: wajib ganti password + isi PIN. Penolakan nilai == default
// dilakukan di route (butuh baca app_settings), bukan di schema.
export const onboardingSchema = z.object({
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN harus 4–6 digit angka'),
});

// Ganti PIN sendiri. Identitas diverifikasi ulang lewat PIN lama, atau password bagi user
// yang belum punya `pin_hash` (data lama) — tanpa ini siapa pun yang menemukan sesi terbuka
// bisa mengganti PIN persetujuan. Penolakan nilai == PIN default dilakukan di route.
export const changePinSchema = z.object({
  currentCredential: z.string().min(1, 'PIN atau password saat ini wajib diisi'),
  credentialType: z.enum(['pin', 'password']),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN harus 4–6 digit angka'),
});

// Reset PIN staf oleh OWNER. `default` memakai PIN default dari app_settings; `custom`
// memakai PIN yang diketik OWNER. Keduanya memaksa staf memilih PIN sendiri saat login.
export const resetPinSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('default') }),
  z.object({
    mode: z.literal('custom'),
    newPin: z.string().regex(/^\d{4,6}$/, 'PIN harus 4–6 digit angka'),
  }),
]);

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginStaffPinInput = z.infer<typeof loginStaffPinSchema>;
export type LoginEmailPasswordInput = z.infer<typeof loginEmailPasswordSchema>;
export type LoginBoInput = z.infer<typeof loginBoSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
export type ResetPinInput = z.infer<typeof resetPinSchema>;
