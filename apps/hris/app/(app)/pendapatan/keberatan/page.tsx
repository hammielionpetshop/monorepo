import { notFound, redirect } from 'next/navigation';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { objectionResubmitHref } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Ajukan ulang keberatan slip dari Pengajuan Saya: diarahkan ke isian slipnya dengan isian lama.
export default async function SlipObjectionResubmitPage({ searchParams }: { searchParams: Promise<{ dari?: string }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const { dari } = await searchParams;
  if (!dari || !/^\d+$/.test(dari)) redirect('/pendapatan');
  const href = await objectionResubmitHref(actor, Number(dari));
  if (!href) notFound();
  redirect(href);
}
