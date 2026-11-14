/**
 * Aturan hak per web untuk gateway dan tombol Pindah web (spec F2-7a §3). Satu-satunya tempat
 * aturan ini, supaya daftar web selalu sama di gateway, Back Office, HRIS, dan Finance.
 */
export type WebCode = 'pos' | 'hris' | 'finance' | 'logistik';

export type WebEntry = {
  code: WebCode;
  name: string;
  description: string;
  url: string;
  /** Sesi PIN tidak bisa membuka HRIS; kotak tetap tampil dengan keterangan. */
  needsPassword: boolean;
};

export type WebUrls = Partial<Record<WebCode, string>>;

/** Web Finance hanya untuk Owner/GM (keputusan owner 2026-11-12, dikukuhkan F2-7a). */
export const FINANCE_ROLES = ['OWNER', 'GM'];

export type WebAccessInput = {
  authMethod: 'PASSWORD' | 'PIN';
  links: { appCode: string }[];
  /** User Back Office yang tertaut (null bila akun tidak punya tautan Back Office). */
  backofficeUser: { isActive: boolean; role: string } | null;
  /** Hak web Logistik dihitung HRIS dari hak jabatan (spec F2-7b §5); false bila HRIS tidak bisa ditanya. */
  logistics?: boolean;
};

export function listWebs(input: WebAccessInput, urls: WebUrls): WebEntry[] {
  const linked = new Set(input.links.map((link) => link.appCode));
  const backoffice = linked.has('backoffice') && input.backofficeUser?.isActive === true;
  const webs: WebEntry[] = [];
  if (backoffice && urls.pos) {
    webs.push({ code: 'pos', name: 'POS', description: 'Kasir dan Back Office', url: urls.pos, needsPassword: false });
  }
  if (linked.has('hris') && urls.hris) {
    webs.push({
      code: 'hris', name: 'HRIS', description: urls.logistik ? 'Absen, gaji, dan kasbon' : 'Absen, gaji, kasbon, dan logistik',
      url: urls.hris, needsPassword: input.authMethod !== 'PASSWORD',
    });
  }
  if (backoffice && FINANCE_ROLES.includes(input.backofficeUser!.role) && urls.finance) {
    webs.push({ code: 'finance', name: 'Finance', description: 'Analisa keuangan (hanya membaca)', url: urls.finance, needsPassword: false });
  }
  // Logistik dijalankan aplikasi HRIS di alamat sendiri (F2-7b §3), jadi butuh tautan HRIS dan sesi password yang sama.
  if (linked.has('hris') && input.logistics === true && urls.logistik) {
    webs.push({
      code: 'logistik', name: 'Logistik', description: 'Trip, uang toko, bensin, dan sewa mobil', url: urls.logistik,
      needsPassword: input.authMethod !== 'PASSWORD',
    });
  }
  return webs;
}

function cleanUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

/** Alamat publik tiap web dari env. Web tanpa alamat tidak ditampilkan (mis. Finance di produksi). */
export function webUrlsFromEnv(env: Record<string, string | undefined> = process.env): WebUrls {
  return {
    pos: cleanUrl(env.BACKOFFICE_PUBLIC_URL),
    hris: cleanUrl(env.HRIS_PUBLIC_URL),
    finance: cleanUrl(env.FINANCE_PUBLIC_URL),
    logistik: cleanUrl(env.LOGISTICS_PUBLIC_URL),
  };
}

export function gatewayUrlFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  return cleanUrl(env.GATEWAY_PUBLIC_URL);
}

export function isWebCode(value: unknown): value is WebCode {
  return value === 'pos' || value === 'hris' || value === 'finance' || value === 'logistik';
}
