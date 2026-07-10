import { db, appSettings, eq, inArray } from '@/lib/db';

// Nilai fallback bila baris app_settings belum ada (mis. seed terlewat).
// Harus selaras dengan seed migrasi 0005 (default_password / default_pin).
const FALLBACK_DEFAULT_PASSWORD = 'password123';
const FALLBACK_DEFAULT_PIN = '123456';

// Baca satu pengaturan global. Mengembalikan null bila key tidak ada.
export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

// Default kredensial staf (plaintext by design) — dipakai onboarding untuk menolak
// nilai == default, dan users create/edit untuk pre-fill/reset kredensial.
export async function getDefaultCredentials(): Promise<{ password: string; pin: string }> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, ['default_password', 'default_pin']));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    password: map.get('default_password') ?? FALLBACK_DEFAULT_PASSWORD,
    pin: map.get('default_pin') ?? FALLBACK_DEFAULT_PIN,
  };
}
