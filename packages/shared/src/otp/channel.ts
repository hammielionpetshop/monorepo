// Abstraksi channel pengiriman OTP WhatsApp (provider-agnostic).
// Tujuan: bisa mulai murah (console/gateway unofficial) lalu migrasi ke WA Cloud API
// tanpa mengubah alur auth.

export type OtpProvider = 'console' | 'fonnte' | 'wablas' | 'wa_cloud' | 'waha';

export interface OtpSendResult {
  ok: boolean;
  error?: string;
}

export interface OtpChannel {
  // Kirim kode OTP ke nomor tujuan (format E.164, mis. +6281234567890)
  send(phoneE164: string, code: string): Promise<OtpSendResult>;
}

// Channel dev/local: OTP hanya di-log, tidak mengirim WA sungguhan. WAJIB ada.
export class ConsoleOtpChannel implements OtpChannel {
  async send(phoneE164: string, code: string): Promise<OtpSendResult> {
    // eslint-disable-next-line no-console
    console.log(`[OTP][console] Kirim ke ${phoneE164}: ${code}`);
    return { ok: true };
  }
}

// Produksi awal: gateway WA unofficial Fonnte (~Rp 50-150rb/bln, config paling ringan).
// Risiko: nomor unofficial bisa kena banned bila dipakai untuk spam massal.
export class FonnteOtpChannel implements OtpChannel {
  constructor(private readonly token: string) {}

  async send(phoneE164: string, code: string): Promise<OtpSendResult> {
    try {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: this.token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          target: phoneE164.replace(/^\+/, ''),
          message: `Kode OTP Hammielion Anda: ${code}. Jangan bagikan kode ini ke siapa pun. Berlaku 5 menit.`,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.status === false) {
        return { ok: false, error: data?.reason || 'Gagal mengirim OTP via Fonnte' };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Gagal mengirim OTP' };
    }
  }
}

// Produksi (pilihan final): WAHA (WhatsApp HTTP API) self-host — gratis selain biaya server,
// tapi tetap "unofficial" (mem-puppeteer WhatsApp Web multi-device seperti Fonnte/Wablas,
// bukan Meta Cloud API resmi), jadi risiko banned nomor tetap ada & sesi bisa perlu scan
// ulang QR bila logout. Endpoint & auth: lihat https://waha.devlike.pro.
export class WahaOtpChannel implements OtpChannel {
  constructor(
    private readonly baseUrl: string,
    private readonly session: string,
    private readonly apiKey?: string,
  ) {}

  async send(phoneE164: string, code: string): Promise<OtpSendResult> {
    try {
      const chatId = `${phoneE164.replace(/^\+/, '')}@c.us`;
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          chatId,
          text: `Kode OTP Hammielion Anda: ${code}. Jangan bagikan kode ini ke siapa pun. Berlaku 5 menit.`,
          session: this.session,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return {
          ok: false,
          error: data?.message || data?.error || `Gagal mengirim OTP via WAHA (HTTP ${res.status})`,
        };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Gagal mengirim OTP' };
    }
  }
}

export interface CreateOtpChannelOptions {
  fonnteToken?: string;
  wahaBaseUrl?: string;
  wahaApiKey?: string;
  wahaSession?: string;
}

// Factory: pilih channel berdasarkan OTP_PROVIDER. wablas/wa_cloud menyusul (fast-follow).
export function createOtpChannel(provider: OtpProvider = 'console', options: CreateOtpChannelOptions = {}): OtpChannel {
  switch (provider) {
    case 'console':
      return new ConsoleOtpChannel();
    case 'fonnte': {
      if (!options.fonnteToken) {
        throw new Error('FONNTE_TOKEN belum dikonfigurasi');
      }
      return new FonnteOtpChannel(options.fonnteToken);
    }
    case 'waha': {
      if (!options.wahaBaseUrl) {
        throw new Error('WAHA_BASE_URL belum dikonfigurasi');
      }
      return new WahaOtpChannel(options.wahaBaseUrl, options.wahaSession || 'default', options.wahaApiKey);
    }
    case 'wablas':
    case 'wa_cloud':
      throw new Error(`OTP provider "${provider}" belum diimplementasikan (fast-follow)`);
    default:
      throw new Error(`OTP provider tidak dikenal: ${provider}`);
  }
}
