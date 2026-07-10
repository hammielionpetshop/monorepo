import { z } from 'zod';

export const requestOtpSchema = z.object({
  phone: z.string().min(8, 'Nomor HP tidak valid').max(20, 'Nomor HP tidak valid'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(8, 'Nomor HP tidak valid').max(20, 'Nomor HP tidak valid'),
  code: z.string().regex(/^\d{6}$/, 'Kode OTP harus 6 digit angka'),
});

export const addCartItemSchema = z.object({
  productId: z.number().int().positive('productId tidak valid'),
  uomId: z.number().int().positive('uomId tidak valid'),
  qty: z.number().int().positive('Jumlah harus lebih dari 0'),
});

export const updateCartItemSchema = z.object({
  qty: z.number().int().min(0, 'Jumlah tidak valid'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
