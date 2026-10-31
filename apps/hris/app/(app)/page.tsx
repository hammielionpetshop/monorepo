import { Card, EmptyState, PageHeader } from '@/components/ui/surface';

// Beranda dasar. Kartu "perlu perhatian saya" diisi modul sesudahnya (L2f dst.).
export default function HomePage() {
  return (
    <>
      <PageHeader title="Beranda" description="Ringkasan hal yang perlu perhatian Anda." />
      <Card>
        <EmptyState title="Belum ada yang perlu perhatian">
          Pengajuan, pemberitahuan, dan tugas Anda akan muncul di sini.
        </EmptyState>
      </Card>
    </>
  );
}
