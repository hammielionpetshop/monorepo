'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import type { DayCard } from '../server/review';
import { DayCardBody } from './day-card';

type History = { id: number; before: string; after: string; reason: string; note: string; reversesId: number | null; by: string; at: string };

const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

/** KEH-L15 Catatan Hari Kerja: satu orang, satu hari, beserta asal angkanya. */
export function DayRecordScreen({ date, employeeId, people, card, history, canCorrect }: {
  date: string; employeeId: number | null; people: { id: number; name: string }[]; card: DayCard | null; history: History[]; canCorrect: boolean;
}) {
  const router = useRouter();
  const go = (next: { employee?: string; date?: string }) => {
    const params = new URLSearchParams({ date: next.date ?? date });
    const employee = next.employee ?? (employeeId ? String(employeeId) : '');
    if (employee) params.set('employee', employee);
    router.push(`/kehadiran/catatan-hari?${params}`);
  };
  return (
    <div className="space-y-4">
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        <Field id="dr-person" label="Orang">
          <Select id="dr-person" value={employeeId ?? ''} onChange={(event) => go({ employee: event.target.value })}>
            <option value="">Pilih orang</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
        </Field>
        <Field id="dr-date" label="Tanggal">
          <Input id="dr-date" type="date" value={date} onChange={(event) => event.target.value && go({ date: event.target.value })} />
        </Field>
      </div>
      {!card && <EmptyState title="Pilih orang dan tanggal." />}
      {card && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{card.name} · {card.workDate}</h2>
            <div className="flex gap-2">
              {canCorrect && <Link className={buttonClass({ size: 'sm' })} href={`/kehadiran/koreksi?mode=one&employee=${card.employeeId}&date=${card.workDate}`}>Koreksi</Link>}
              <button type="button" className={buttonClass({ size: 'sm', variant: 'secondary' })} onClick={() => router.back()}>Kembali</button>
            </div>
          </div>
          <DayCardBody card={card} office />
        </Card>
      )}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Riwayat koreksi hari ini</h2>
          <DataList
            rows={history}
            rowKey={(row) => row.id}
            columns={[
              { key: 'after', header: 'Menjadi', primary: true, render: (row) => row.after },
              { key: 'before', header: 'Sebelumnya', render: (row) => row.before },
              { key: 'reason', header: 'Alasan', render: (row) => <>{row.reversesId ? <Badge tone="info">Membalik koreksi</Badge> : row.reason} {row.note}</> },
              { key: 'by', header: 'Oleh', render: (row) => `${row.by}, ${when(row.at)}` },
            ]}
          />
        </section>
      )}
    </div>
  );
}
