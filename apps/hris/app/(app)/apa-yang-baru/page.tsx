import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { SECTION_LABELS, parseInline, type ChangelogSection } from '@/lib/changelog';
import { readHrisChangelog } from '@/lib/changelog-files';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const SECTION_TONES: Record<string, 'ok' | 'info' | 'warn' | 'danger'> = {
  Added: 'ok', Changed: 'info', Fixed: 'warn', Removed: 'danger',
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function longDate(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : value;
}

/** "2026-11-01 21:45" → "1 November 2026, pukul 21.45". */
function publishedLabel(value: string | null) {
  if (!value) return null;
  const [date, time] = value.split(' ');
  return `${longDate(date)}, pukul ${time.replace(':', '.')}`;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) => (part.kind === 'strong'
        ? <strong key={i}>{part.text}</strong>
        : part.kind === 'code'
          ? <code key={i} className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">{part.text}</code>
          : <span key={i}>{part.text}</span>))}
    </>
  );
}

function Sections({ sections }: { sections: ChangelogSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.name}>
          <Badge tone={SECTION_TONES[section.name] ?? 'info'}>{SECTION_LABELS[section.name] ?? section.name}</Badge>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {section.items.map((item, i) => (
              <li key={i}>
                <Inline text={item.text} />
                {item.children.length > 0 && (
                  <ul className="mt-1 list-[circle] space-y-1 pl-5 text-ink-muted">
                    {item.children.map((child, j) => <li key={j}><Inline text={child} /></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Apa yang baru di HRIS (permintaan owner 2026-11-01; padanan Changelog kasir, BER-L11 v3). Untuk semua orang.
export default async function WhatsNewPage() {
  const { session } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const { released, unreleased } = await readHrisChangelog();
  return (
    <>
      <PageHeader title="Apa yang baru" description="Riwayat perubahan dan pembaruan HRIS, yang terbaru di atas." />
      <div className="mx-auto max-w-3xl space-y-4">
        {unreleased.length > 0 && (
          <Card>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold">Sedang diuji</h2>
              <span className="text-sm text-ink-muted">sudah tayang di staging, belum dirilis</span>
            </div>
            <div className="divide-y divide-line">
              {unreleased.map((update, i) => (
                <section key={i} className="py-4 first:pt-0 last:pb-0">
                  {update.publishedAt && <h3 className="mb-3 font-semibold">{publishedLabel(update.publishedAt)}</h3>}
                  <Sections sections={update.sections} />
                </section>
              ))}
            </div>
          </Card>
        )}
        {released.map((version) => (
          <Card key={version.version}>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold">v{version.version}</h2>
              <span className="text-sm text-ink-muted">{longDate(version.date)}</span>
            </div>
            <Sections sections={version.sections} />
          </Card>
        ))}
        {unreleased.length === 0 && released.length === 0 && <EmptyState title="Belum ada catatan perubahan" />}
      </div>
    </>
  );
}
