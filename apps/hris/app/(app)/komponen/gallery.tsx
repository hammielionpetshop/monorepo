'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';

const sample = [
  { id: 1, name: 'Contoh Satu', branch: 'Cabang A', status: 'Aktif' },
  { id: 2, name: 'Contoh Dua', branch: 'Cabang B', status: 'Nonaktif' },
];

export function Gallery() {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Komponen"
        description="Contoh semua komponen dasar HRIS. Halaman ini hanya acuan tampilan."
        actions={<Button size="sm" onClick={() => setOpen(true)}>Buka dialog</Button>}
      />

      <Card>
        <h2 className="mb-3 font-semibold">Tombol</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Utama</Button>
          <Button variant="secondary">Sekunder</Button>
          <Button variant="danger">Hapus</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Simpan</Button>
          <Button disabled>Nonaktif</Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Isian</h2>
        <Field id="g-name" label="Nama" hint="Sesuai KTP.">
          <Input id="g-name" placeholder="Nama lengkap" />
        </Field>
        <Field id="g-branch" label="Cabang">
          <Select id="g-branch" defaultValue=""><option value="" disabled>Pilih cabang</option><option>Cabang A</option></Select>
        </Field>
        <Field id="g-note" label="Catatan" error="Catatan wajib diisi.">
          <Textarea id="g-note" aria-invalid />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Pesan dan status</h2>
        <Alert tone="info" title="Informasi">Pengajuan Anda sedang diperiksa.</Alert>
        <Alert tone="ok">Perubahan tersimpan.</Alert>
        <Alert tone="warn">Foto diri belum diunggah.</Alert>
        <Alert tone="danger" title="Gagal">Koneksi terputus, coba lagi.</Alert>
        <div className="flex gap-2"><Badge tone="ok">Aktif</Badge><Badge tone="warn">Menunggu</Badge><Badge tone="danger">Ditolak</Badge><Badge>Info</Badge></div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => toast('Tersimpan.', 'ok')}>Toast sukses</Button>
          <Button size="sm" variant="secondary" onClick={() => toast('Gagal menyimpan.', 'danger')}>Toast gagal</Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold">Daftar (tabel di layar lebar, kartu di HP)</h2>
        <DataList
          rows={sample}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Nama', primary: true, render: (r) => r.name },
            { key: 'branch', header: 'Cabang', render: (r) => r.branch },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Aktif' ? 'ok' : 'warn'}>{r.status}</Badge> },
          ]}
        />
        <DataList rows={[]} rowKey={() => 0} columns={[{ key: 'x', header: 'x', render: () => null }]} empty="Belum ada karyawan." />
      </div>

      <EmptyState title="Status kosong dengan tindakan" action={<Button size="sm">Tambah</Button>}>
        Dipakai saat daftar belum berisi data.
      </EmptyState>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Konfirmasi"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button onClick={() => { setOpen(false); toast('Dikonfirmasi.', 'ok'); }}>Ya, lanjut</Button></>}
      >
        Lanjutkan tindakan ini? Contoh dialog (lembar dari bawah di HP).
      </Dialog>
    </div>
  );
}
