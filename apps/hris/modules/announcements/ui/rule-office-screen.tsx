'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList, type Column } from '@/components/ui/data-list';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { postJson } from '@/lib/post-json';
import { RULE_STATUS_LABELS, type RuleStatus } from '../rules/rule';
import type { DraftListRow, RuleOfficeTab, RuleRow } from '../server/rules';
import { dateText, whenWib } from './shared';

const TABS: { id: RuleOfficeTab; label: string }[] = [
  { id: 'drafts', label: 'Konsep' },
  { id: 'waiting', label: 'Menunggu persetujuan' },
  { id: 'scheduled', label: 'Terjadwal' },
  { id: 'published', label: 'Terbit' },
  { id: 'withdrawn', label: 'Ditarik' },
];

const PUBLISHED: RuleStatus[] = ['PUBLISHED', 'EFFECTIVE', 'CORRECTED', 'SUPERSEDED'];

function statusTone(status: RuleStatus): 'ok' | 'warn' | 'info' | 'danger' {
  if (status === 'EFFECTIVE') return 'ok';
  if (status === 'PUBLISHED' || status === 'SCHEDULED') return 'warn';
  if (status === 'WITHDRAWN') return 'danger';
  return 'info';
}

/** Kantor › Pengumuman › Perubahan aturan (BER-L22): Konsep, Menunggu persetujuan, Terjadwal, Terbit, Ditarik. */
export function RuleOfficeScreen({ rules, drafts, tab }: { rules: RuleRow[]; drafts: DraftListRow[]; tab: RuleOfficeTab }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function act(path: string, done: (data: Record<string, unknown> | undefined) => void) {
    setError(null);
    const res = await postJson(path, {});
    setBusy(null);
    if (!res.ok) return setError(res.error ?? 'Gagal.');
    done(res.data);
  }

  const counts: Record<RuleOfficeTab, number> = {
    drafts: drafts.filter((d) => d.status === 'DRAFT' || d.status === 'REJECTED').length,
    waiting: drafts.filter((d) => d.status === 'SUBMITTED').length,
    scheduled: rules.filter((r) => r.status === 'SCHEDULED').length,
    published: rules.filter((r) => PUBLISHED.includes(r.status)).length,
    withdrawn: rules.filter((r) => r.status === 'WITHDRAWN').length,
  };

  const ruleColumns: Column<RuleRow>[] = [
    {
      key: 'title', header: 'Judul', primary: true,
      render: (row) => <Link href={`/announcements/${row.id}`} className="font-medium text-brand-700 hover:underline">{row.title}</Link>,
    },
    { key: 'target', header: 'Sasaran', render: (row) => row.targetText },
    { key: 'publish', header: 'Terbit', render: (row) => `${whenWib(row.publishesAt)}${row.authorName ? ` · ${row.authorName}` : ''}` },
    { key: 'effective', header: 'Berlaku', render: (row) => dateText(row.effectiveOn) },
    {
      key: 'status', header: 'Status',
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={statusTone(row.status)}>{RULE_STATUS_LABELS[row.status]}</Badge>
          {row.affectsMoney && <Badge tone="info">Uang</Badge>}
          {row.correctsId && <Badge tone="info">Ralat</Badge>}
        </span>
      ),
    },
    { key: 'read', header: 'Sudah baca', render: (row) => <Link href={`/announcements/${row.id}`} className="hover:underline">{row.readCount} dari {row.recipientCount}</Link> },
  ];

  const draftColumns: Column<DraftListRow>[] = [
    {
      key: 'title', header: 'Judul', primary: true,
      render: (row) => (row.status === 'DRAFT'
        ? <Link href={`/announcements/rules/drafts/${row.id}`} className="font-medium text-brand-700 hover:underline">{row.title || '(tanpa judul)'}</Link>
        : <span className="font-medium">{row.title || '(tanpa judul)'}</span>),
    },
    { key: 'author', header: 'Penulis', render: (row) => `${row.authorName ?? '—'} · ${whenWib(row.updatedAt)}` },
    { key: 'effective', header: 'Berlaku', render: (row) => (row.effectiveOn ? dateText(row.effectiveOn) : '—') },
    {
      key: 'status', header: 'Status',
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.status === 'DRAFT' && <Badge tone="info">Konsep</Badge>}
          {row.status === 'SUBMITTED' && <Badge tone="warn">Menunggu persetujuan</Badge>}
          {row.status === 'REJECTED' && <Badge tone="danger">Ditolak / dibatalkan</Badge>}
          {row.affectsMoney && <Badge tone="info">Uang</Badge>}
          {row.correctsId && <Badge tone="info">Ralat</Badge>}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: (row) => (
        <span className="flex flex-wrap gap-2">
          {row.status === 'SUBMITTED' && row.requestId && <Link href={`/approvals/${row.requestId}`} className="text-sm text-brand-700 hover:underline">Lihat pengajuan</Link>}
          {row.status === 'REJECTED' && (
            <>
              {row.closeReason && <span className="text-xs text-ink-muted">Alasan: {row.closeReason}</span>}
              <Button size="sm" variant="secondary" loading={busy === row.id} onClick={() => { setBusy(row.id); void act(`/api/announcements/rules/drafts/${row.id}/copy`, (data) => router.push(`/announcements/rules/drafts/${data?.id}`)); }}>
                Salin jadi konsep baru
              </Button>
            </>
          )}
          {row.status === 'DRAFT' && (
            <Button size="sm" variant="ghost" loading={busy === row.id} onClick={() => { setBusy(row.id); void act(`/api/announcements/rules/drafts/${row.id}/discard`, () => { toast('Konsep dibuang.', 'ok'); router.refresh(); }); }}>
              Buang
            </Button>
          )}
        </span>
      ),
    },
  ];

  const shownRules = rules.filter((r) => (tab === 'scheduled' ? r.status === 'SCHEDULED' : tab === 'published' ? PUBLISHED.includes(r.status) : r.status === 'WITHDRAWN'));
  const shownDrafts = drafts.filter((d) => (tab === 'waiting' ? d.status === 'SUBMITTED' : d.status === 'DRAFT' || d.status === 'REJECTED'));

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Tab perubahan aturan">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/announcements?tab=${item.id}`}
            className={cn('rounded-full border px-3 py-1.5 text-sm', item.id === tab ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-ink')}
          >
            {item.label} ({counts[item.id]})
          </Link>
        ))}
      </nav>
      {error && <Alert tone="danger">{error}</Alert>}
      {tab === 'drafts' || tab === 'waiting'
        ? <DataList rows={shownDrafts} columns={draftColumns} rowKey={(row) => row.id} empty={tab === 'drafts' ? 'Tidak ada konsep.' : 'Tidak ada yang menunggu persetujuan.'} />
        : <DataList rows={shownRules} columns={ruleColumns} rowKey={(row) => row.id} empty="Belum ada pengumuman di sini." />}
    </div>
  );
}
