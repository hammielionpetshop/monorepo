'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { DayStrip } from '@/components/ui/week-table';
import { addDays, mondayOf } from '../rules/schedule';

type Cell = { date: string; shiftName: string | null; hours: string | null; closed: boolean };

export function MyScheduleScreen({ week, today, shiftless, cells, friends, branchShifts }: {
  week: string; today: string; shiftless: boolean; cells: Cell[];
  friends: { employeeId: number; name: string; cells: Cell[] }[];
  branchShifts: { id: number; name: string; hours: string | null; breakMinutes: number | null }[];
}) {
  const [showFriends, setShowFriends] = useState(false);
  const thisWeek = mondayOf(today);
  const isThisWeek = week === thisWeek;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{isThisWeek ? 'Minggu ini' : `Minggu ${week}`}</h2>
        <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={isThisWeek ? `/jadwal?week=${addDays(thisWeek, 7)}` : '/jadwal'}>
          {isThisWeek ? 'Minggu depan' : 'Minggu ini'}
        </Link>
      </div>
      <DayStrip
        days={cells.map((cell) => ({
          date: cell.date,
          today: cell.date === today,
          title: cell.closed ? 'Hari tutup' : shiftless ? 'Absen lewat trip' : cell.shiftName ?? 'Shift belum ditentukan',
          detail: cell.closed ? null : cell.hours,
          tone: cell.closed || shiftless ? 'muted' : cell.shiftName ? undefined : 'warn',
        }))}
      />
      {!shiftless && (
        <Card>
          <h2 className="mb-1 font-semibold">Jam kerja cabang</h2>
          {branchShifts.map((shift) => (
            <p key={shift.id} className="text-sm">
              {shift.name}: {shift.hours ?? 'belum berlaku'}{shift.breakMinutes ? `, istirahat ${shift.breakMinutes} menit` : ''}
            </p>
          ))}
          {!branchShifts.length && <p className="text-sm text-ink-muted">Belum diisi.</p>}
        </Card>
      )}
      {!shiftless && (
        <div>
          <Button variant="secondary" onClick={() => setShowFriends(!showFriends)}>{showFriends ? 'Tutup' : 'Lihat teman'}</Button>
          {showFriends && (
            <ul className="mt-3 space-y-2">
              {friends.map((friend) => (
                <li key={friend.employeeId} className="rounded-card border border-line bg-surface p-3 text-sm">
                  <p className="font-medium">{friend.name}</p>
                  <p className="text-xs text-ink-muted">
                    {friend.cells.map((cell) => (cell.closed ? 'Tutup' : cell.shiftName ?? '-')).join(' · ')}
                  </p>
                </li>
              ))}
              {!friends.length && <li className="text-sm text-ink-muted">Belum ada teman satu cabang.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
