import { z } from 'zod';

export const requestOtpSchema = z.object({
  phone: z.string().min(8, 'Nomor HP tidak valid').max(20, 'Nomor HP tidak valid'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(8, 'Nomor HP tidak valid').max(20, 'Nomor HP tidak valid'),
  code: z.string().regex(/^\d{6}$/, 'Kode OTP harus 6 digit angka'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
