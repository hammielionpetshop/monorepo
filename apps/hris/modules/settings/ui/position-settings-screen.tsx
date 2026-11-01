'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/surface';
import type { PositionSettingsScreenData, SettingCell, SettingMeta } from '../server/screens';
import { ChangeDialog, HistoryDialog, longDate } from './shared';

type Open = { meta: SettingMeta; cell: SettingCell; targetLabel: string; affected: string; mode: 'change' | 'history' };

/**
 * KAR-L31 Pengaturan Jabatan: baris = jabatan, kolom = tanda. Baris "Semua jabatan" adalah nilai bawaan;
 * jabatan tanpa nilai sendiri ikut bawaan. Usulan oleh HR menyusul bersama kotak Persetujuan (L2f).
 */
export function PositionSettingsScreen({ data }: { data: PositionSettingsScreenData }) {
  const [open, setOpen] = useState<Open | null>(null);
  const canEditAny = data.settings.some((s) => s.canEdit);
  const totalHolders = data.positions.reduce((n, p) => n + p.holders, 0);

  const rows = [
    { id: 0, name: 'Semua jabatan (bawaan)', holders: totalHolders, cells: data.defaults, isDefault: true },
    ...data.positions.map((p) => ({ ...p, isDefault: false })),
  ];

  return (
    <div className="space-y-4">
      {!canEditAny && (
        <Alert>Anda bisa melihat Pengaturan Jabatan. Usulan perubahan bisa dibuat setelah kotak Persetujuan tersedia.</Alert>
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
                      <span className="mt-1 flex gap-1">
                        {meta.canEdit && <Button size="sm" variant="secondary" onClick={() => setOpen({ meta, cell, targetLabel, affected, mode: 'change' })}>Ubah</Button>}
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
        <ChangeDialog meta={open.meta} cell={open.cell} targetLabel={open.targetLabel} affected={open.affected} onClose={() => setOpen(null)} />
      )}
      {open?.mode === 'history' && (
        <HistoryDialog meta={open.meta} cell={open.cell} targetLabel={`Untuk ${open.targetLabel}`} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
