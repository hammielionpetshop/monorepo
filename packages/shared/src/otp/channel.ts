// Abstraksi channel pengiriman OTP WhatsApp (provider-agnostic).
// Tujuan: bisa mulai murah (console/gateway unofficial) lalu migrasi ke WA Cloud API
// tanpa mengubah alur auth. Implementasi produksi (Fonnte/WA Cloud) ditambah di C2.

export type OtpProvider = 'console' | 'fonnte' | 'wablas' | 'wa_cloud';

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

// Factory: pilih channel berdasarkan OTP_PROVIDER. Provider produksi menyusul di C2.
export function createOtpChannel(provider: OtpProvider = 'console'): OtpChannel {
  switch (provider) {
    case 'console':
      return new ConsoleOtpChannel();
    case 'fonnte':
    case 'wablas':
    case 'wa_cloud':
      throw new Error(`OTP provider "${provider}" belum diimplementasikan (menyusul di C2)`);
    default:
      throw new Error(`OTP provider tidak dikenal: ${provider}`);
  }
}
