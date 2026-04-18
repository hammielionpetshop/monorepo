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

export const loginSchema = z.discriminatedUnion('mode', [
  loginStaffPinSchema,
  loginEmailPasswordSchema,
]);

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginStaffPinInput = z.infer<typeof loginStaffPinSchema>;
export type LoginEmailPasswordInput = z.infer<typeof loginEmailPasswordSchema>;
