import { randomInt } from 'crypto';
import * as argon2 from 'argon2';
import { db, customers, customerAuth, customerOtpCodes, eq, and, gt, desc, isNull } from '../db';
import { createOtpChannel, normalizePhoneE164, type CustomerJWTPayload, type OtpProvider } from '@petshop/shared';
import { signCustomerToken } from '../customer-auth';

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300);
const REQUEST_COOLDOWN_SECONDS = 60;
const REQUEST_MAX_PER_HOUR = 5;
const VERIFY_MAX_ATTEMPTS = 5;

function generateOtpCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function otpChannel() {
  const provider = (process.env.OTP_PROVIDER || 'console') as OtpProvider;
  return createOtpChannel(provider, { fonnteToken: process.env.FONNTE_TOKEN });
}

export type RequestOtpReason = 'INVALID_PHONE' | 'RATE_LIMITED' | 'SEND_FAILED';
export type RequestOtpResult = { ok: true } | { ok: false; error: string; reason: RequestOtpReason };

// Selalu mengembalikan respons yang sama baik nomor terdaftar (whitelist) maupun tidak,
// agar tidak bocorkan status whitelist lewat endpoint ini (enumeration). OTP sungguhan
// HANYA dikirim (dan biaya gateway HANYA dikeluarkan) untuk nomor yang ter-whitelist —
// pengecekan whitelist "final" tetap di verify-otp.
export async function requestOtp(rawPhone: string): Promise<RequestOtpResult> {
  const phone = normalizePhoneE164(rawPhone);
  if (!phone) {
    return { ok: false, error: 'Format nomor HP tidak valid', reason: 'INVALID_PHONE' };
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentCodes = await db
    .select({ id: customerOtpCodes.id, createdAt: customerOtpCodes.createdAt })
    .from(customerOtpCodes)
    .where(and(eq(customerOtpCodes.phone, phone), gt(customerOtpCodes.createdAt, hourAgo)))
    .orderBy(desc(customerOtpCodes.createdAt));

  const cooldownSince = new Date(now.getTime() - REQUEST_COOLDOWN_SECONDS * 1000);
  if (recentCodes.length > 0 && recentCodes[0].createdAt > cooldownSince) {
    return { ok: false, error: 'Tunggu sebentar sebelum meminta kode baru', reason: 'RATE_LIMITED' };
  }

  if (recentCodes.length >= REQUEST_MAX_PER_HOUR) {
    return { ok: false, error: 'Terlalu banyak permintaan kode, coba lagi nanti', reason: 'RATE_LIMITED' };
  }

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.phone, phone), eq(customers.canOrderOnline, true), eq(customers.isActive, true)))
    .limit(1);

  // Nomor tak ter-whitelist: jangan simpan/kirim OTP (hemat biaya gateway), tapi tetap
  // balas sukses generik supaya klien tak bisa membedakan status whitelist.
  if (!customer) {
    return { ok: true };
  }

  const code = generateOtpCode();
  const codeHash = await argon2.hash(code);
  const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);

  await db.insert(customerOtpCodes).values({ phone, codeHash, expiresAt });

  const result = await otpChannel().send(phone, code);
  if (!result.ok) {
    return { ok: false, error: 'Gagal mengirim kode OTP, coba lagi nanti', reason: 'SEND_FAILED' };
  }

  return { ok: true };
}

export type VerifyOtpReason = 'INVALID_PHONE' | 'NOT_WHITELISTED' | 'OTP_INVALID';
export type VerifyOtpResult = { ok: true; token: string } | { ok: false; error: string; reason: VerifyOtpReason };

export async function verifyOtp(rawPhone: string, code: string): Promise<VerifyOtpResult> {
  const phone = normalizePhoneE164(rawPhone);
  if (!phone) {
    return { ok: false, error: 'Format nomor HP tidak valid', reason: 'INVALID_PHONE' };
  }

  const [customer] = await db
    .select({ id: customers.id, name: customers.name, defaultTierType: customers.defaultTierType })
    .from(customers)
    .where(and(eq(customers.phone, phone), eq(customers.canOrderOnline, true), eq(customers.isActive, true)))
    .limit(1);

  if (!customer) {
    return { ok: false, error: 'Nomor belum terdaftar, hubungi admin', reason: 'NOT_WHITELISTED' };
  }

  const [otpRow] = await db
    .select()
    .from(customerOtpCodes)
    .where(and(eq(customerOtpCodes.phone, phone), isNull(customerOtpCodes.consumedAt)))
    .orderBy(desc(customerOtpCodes.createdAt))
    .limit(1);

  if (!otpRow || otpRow.expiresAt < new Date()) {
    return { ok: false, error: 'Kode OTP tidak ditemukan atau kedaluwarsa, minta kode baru', reason: 'OTP_INVALID' };
  }

  if (otpRow.attempts >= VERIFY_MAX_ATTEMPTS) {
    return { ok: false, error: 'Terlalu banyak percobaan, minta kode baru', reason: 'OTP_INVALID' };
  }

  const valid = await argon2.verify(otpRow.codeHash, code);
  if (!valid) {
    await db.update(customerOtpCodes).set({ attempts: otpRow.attempts + 1 }).where(eq(customerOtpCodes.id, otpRow.id));
    return { ok: false, error: 'Kode OTP salah', reason: 'OTP_INVALID' };
  }

  await db.update(customerOtpCodes).set({ consumedAt: new Date() }).where(eq(customerOtpCodes.id, otpRow.id));

  const [existingAuth] = await db
    .select({ id: customerAuth.id })
    .from(customerAuth)
    .where(eq(customerAuth.customerId, customer.id))
    .limit(1);

  if (existingAuth) {
    await db.update(customerAuth).set({ lastLoginAt: new Date(), phone }).where(eq(customerAuth.id, existingAuth.id));
  } else {
    await db.insert(customerAuth).values({ customerId: customer.id, phone, lastLoginAt: new Date() });
  }

  const payload: CustomerJWTPayload = {
    customerId: customer.id,
    name: customer.name,
    phone,
    tierType: customer.defaultTierType as CustomerJWTPayload['tierType'],
    branchId: Number(process.env.ORDER_BRANCH_ID),
  };

  const token = await signCustomerToken(payload);
  return { ok: true, token };
}
