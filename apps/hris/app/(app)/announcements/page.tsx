import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { cn } from '@/lib/cn';
import { NoAccess } from '@/modules/access';
import { AnnouncementsScreen, RuleOfficeScreen, canOpenOffice, listEmergencies, listRuleOffice, type RuleOfficeTab } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

const RULE_TABS: RuleOfficeTab[] = ['drafts', 'waiting', 'scheduled', 'published', 'withdrawn'];

// Kantor › Pengumuman (BER-L22): Perubahan aturan (spec F3-3 §3.7) dan Darurat (spec F3-2 §3.5).
export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ view?: string; tab?: string }> }) {
  const actor = await requirePageAnyAction(['announcement.view', 'announcement.emergency.send', 'announcement.rule.draft', 'announcement.rule.publish']);
  if (!actor || !canOpenOffice(actor)) return <NoAccess />;
  const { view, tab } = await searchParams;
  const emergencyView = view === 'emergency';
  const [rules, emergencies] = await Promise.all([listRuleOffice(actor), listEmergencies(actor)]);
  if (!rules.ok) return <NoAccess />;
  const canSend = emergencies.ok && emergencies.value.canSend;
  const switchClass = (active: boolean) => cn('rounded-lg px-3 py-1.5 text-sm font-medium', active ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-canvas');
  return (
    <>
      <PageHeader
        title="Pengumuman"
        description={emergencyView
          ? 'Pengumuman darurat tampil paling depan di layar penerima dan wajib dibaca.'
          : 'Perubahan aturan perusahaan diumumkan sebelum berlaku, hanya kepada yang terkena.'}
        actions={(
          <>
            <NewBadge feature="/announcements" />
            {!emergencyView && rules.value.canDraft && <Link href="/announcements/rules/new" className={buttonClass()}>Tulis perubahan aturan</Link>}
            {emergencyView && canSend && <Link href="/announcements/emergency/new" className={buttonClass({ variant: 'danger' })}>Kirim pengumuman darurat</Link>}
          </>
        )}
      />
      <nav className="mb-4 inline-flex gap-1 rounded-lg border border-line bg-surface p-1" aria-label="Jenis pengumuman">
        <Link href="/announcements" className={switchClass(!emergencyView)}>Perubahan aturan <NewBadge feature="fitur/papan-perubahan-aturan" /></Link>
        {emergencies.ok && <Link href="/announcements?view=emergency" className={switchClass(emergencyView)}>Darurat</Link>}
      </nav>
      {emergencyView && emergencies.ok
        ? <AnnouncementsScreen rows={emergencies.value.rows} tab={tab === 'done' ? 'done' : 'showing'} />
        : <RuleOfficeScreen rules={rules.value.rules} drafts={rules.value.drafts} tab={RULE_TABS.includes(tab as RuleOfficeTab) ? tab as RuleOfficeTab : 'published'} />}
    </>
  );
}
