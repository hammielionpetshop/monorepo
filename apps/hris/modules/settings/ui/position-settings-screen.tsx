'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Card } from '@/components/ui/surface';
import type { PositionSettingsScreenData, SettingCell, SettingMeta } from '../server/screens';
import { ChangeDialog, HistoryDialog, longDate } from './shared';

type Open = { meta: SettingMeta; cell: SettingCell; targetLabel: string; affected: string; mode: 'change' | 'history' };
export type PositionResubmit = { fromId: number; values: { key: string; targetKind: string; targetId: number | null; value: unknown; effectiveFrom: string; reason: string } };

/**
 * KAR-L31 Pengaturan Jabatan: baris = jabatan, kolom = tanda. Baris "Semua jabatan" adalah nilai bawaan;
 * jabatan tanpa nilai sendiri ikut bawaan. HR mengusulkan lewat kotak Persetujuan; Pemilik/GM langsung berlaku (KAR-73).
 */
export function PositionSettingsScreen({ data, resubmit }: { data: PositionSettingsScreenData; resubmit?: PositionResubmit | null }) {
  const [open, setOpen] = useState<Open | null>(() => {
    if (!resubmit) return null;
    const meta = data.settings.find((s) => s.key === resubmit.values.key);
    const position = data.positions.find((p) => p.id === resubmit.values.targetId);
    const cell = resubmit.values.targetKind === 'ALL' ? data.defaults[resubmit.values.key] : position?.cells[resubmit.values.key];
    if (!meta?.canPropose || !cell) return null;
    return {
      meta, cell, mode: 'change',
      targetLabel: position ? `jabatan ${position.name}` : 'semua jabatan',
      affected: position ? `${position.holders} orang berjabatan ${position.name}` : 'Semua jabatan yang belum punya nilai sendiri',
    };
  });
  const [prefilled, setPrefilled] = useState(!!resubmit);
  const canEditAny = data.settings.some((s) => s.canEdit);
  const canProposeAny = data.settings.some((s) => s.canPropose);
  const totalHolders = data.positions.reduce((n, p) => n + p.holders, 0);

  const rows = [
    { id: 0, name: 'Semua jabatan (bawaan)', holders: totalHolders, cells: data.defaults, isDefault: true },
    ...data.positions.map((p) => ({ ...p, isDefault: false })),
  ];

  return (
    <div className="space-y-4">
      {!canEditAny && canProposeAny && (
        <Alert>
          <span className="flex items-center gap-2"><NewBadge feature="fitur/usulan-pengaturan-jabatan" /> Usulan Anda masuk kotak Persetujuan Pemilik dan GM. Nilai lama tetap berlaku sampai disetujui.</span>
        </Alert>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3 font-medium">Jabatan</th>
              {data.settings.map((s) => <th key={s.key} className="py-2 pr-3 font-medium" title={s.explain}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className={row.isDefault ? 'bg-canvas' : undefined}>
                <td className="py-2 pr-3 align-top">
                  <span className="font-medium">{row.name}</span>
                  {!row.isDefault && <span className="block text-xs text-ink-muted">{row.holders} orang</span>}
                </td>
                {data.settings.map((meta) => {
                  const cell = row.cells[meta.key];
                  const targetLabel = row.isDefault ? 'semua jabatan' : `jabatan ${row.name}`;
                  const affected = row.isDefault
                    ? 'Semua jabatan yang belum punya nilai sendiri'
                    : `${row.holders} orang berjabatan ${row.name}`;
                  return (
                    <td key={meta.key} className="py-2 pr-3 align-top">
                      <span className={cell.inherited ? 'text-ink-muted' : 'font-medium'}>{cell.value}</span>
                      {cell.inherited && <span className="block text-xs text-ink-muted">ikut bawaan</span>}
                      {cell.upcoming.map((u) => (
                        <span key={u.id} className="block text-xs text-ink-muted">→ {u.value} mulai {longDate(u.effectiveFrom)}</span>
                      ))}
                      {cell.proposed && (
                        <Link className="block text-xs text-brand-700" href={`${meta.canEdit ? '/persetujuan' : '/pengajuan'}/${cell.proposed.requestId}`}>
                          Diusulkan: {cell.proposed.value} mulai {longDate(cell.proposed.effectiveFrom)}
                        </Link>
                      )}
                      <span className="mt-1 flex gap-1">
                        {meta.canEdit && <Button size="sm" variant="secondary" onClick={() => setOpen({ meta, cell, targetLabel, affected, mode: 'change' })}>Ubah</Button>}
                        {meta.canPropose && !cell.proposed && <Button size="sm" variant="secondary" onClick={() => { setPrefilled(false); setOpen({ meta, cell, targetLabel, affected, mode: 'change' }); }}>Usulkan</Button>}
                        <Button size="sm" variant="ghost" onClick={() => setOpen({ meta, cell, targetLabel, affected, mode: 'history' })}>Riwayat</Button>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open?.mode === 'change' && (
        <ChangeDialog meta={open.meta} cell={open.cell} targetLabel={open.targetLabel} affected={open.affected} onClose={() => setOpen(null)}
          propose={open.meta.canPropose}
          prefill={prefilled && resubmit ? resubmit.values : undefined}
          resubmitOf={prefilled && resubmit ? resubmit.fromId : undefined}
        />
      )}
      {open?.mode === 'history' && (
        <HistoryDialog meta={open.meta} cell={open.cell} targetLabel={`Untuk ${open.targetLabel}`} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
