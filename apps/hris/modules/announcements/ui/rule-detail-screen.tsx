'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HoldButton, HoldSecondsProvider } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { RuleRow } from '../server/rules';
import { RuleContent } from './rule-card';
import { whenWib } from './shared';

/** Rincian perubahan aturan (BER-L09) dengan tombol Sudah saya baca (sekali, tercatat kapan). */
export function RuleDetailScreen({ rule, canRead, holdSeconds }: { rule: RuleRow; canRead: boolean; holdSeconds: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/announcements/${rule.id}/read`, {});
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Gagal.');
    toast('Tercatat sudah dibaca.', 'ok');
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4">
      <RuleContent rule={rule} linkBase="/rule-board" />
      {rule.myReadAt
        ? <p className="text-sm"><Badge tone="ok">Sudah dibaca</Badge> {whenWib(rule.myReadAt)}</p>
        : canRead && (
          <HoldSecondsProvider seconds={holdSeconds}>
            <HoldButton loading={busy} onClick={() => void read()}>Sudah saya baca</HoldButton>
          </HoldSecondsProvider>
        )}
      {error && <Alert tone="danger">{error}</Alert>}
    </Card>
  );
}
