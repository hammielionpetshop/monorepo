import type { ReactNode } from 'react';
import Link from 'next/link';
import { QueueHold } from '@/components/queue';
import { Alert, Card } from '@/components/ui/surface';
import { REQUEST_TYPES, type RequestTypeDefinition, type RequestTypeKey } from '../rules/types';

/**
 * BER-L06 kerangka isian: kepala (nama jenis, baris pedoman lapor KAR-79, batas waktu) milik Mesin Pengajuan;
 * isi khasnya disediakan modul jenisnya sebagai `children`.
 */
export function RequestFormFrame({ typeKey, resubmitOf, children }: {
  typeKey: RequestTypeKey; resubmitOf?: number | null; children: ReactNode;
}) {
  const type: RequestTypeDefinition = REQUEST_TYPES[typeKey];
  return (
    <div className="space-y-4">
      {/* Antrean berantai menunggu sampai isian selesai atau ditinggalkan (BER-L03, spec F3-1 §3.5). */}
      <QueueHold />
      <Card>
        <h2 className="text-lg font-semibold">{type.label}</h2>
        <p className="mt-1 text-sm">{type.guideLine}</p>
        <p className="mt-1 text-xs text-ink-muted">{type.deadline.label} Lampiran: {type.attachments.rule.toLowerCase()}.</p>
      </Card>
      {resubmitOf && <Alert>Ajukan ulang dari PJ-{resubmitOf}: isian lama sudah terisi. Perbaiki lalu kirim.</Alert>}
      {children}
      <Link href="/requests/new" className="inline-block text-sm text-brand-700">← Pilih jenis lain</Link>
    </div>
  );
}
