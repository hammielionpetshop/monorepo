import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, MessageCircle, Store, Warehouse } from 'lucide-react'
import {
  KalauMaka,
  Klik,
  Kotak,
  LabelPeran,
  LabelStatus,
  Langkah,
  Menu,
  Tombol,
  Urutan,
  type Status,
} from '../_components/panduan-ui'

export const metadata: Metadata = {
  title: 'Minta Barang ke Cabang Lain — Panduan Hammielion',
}

const PETA: { siapa: 'minta' | 'kirim'; teks: string; status?: Status }[] = [
  { siapa: 'minta', teks: 'Tulis permintaan di POS, kabari grup WhatsApp', status: 'menunggu' },
  { siapa: 'kirim', teks: 'Proses permintaan jadi nota (paling lambat besok)', status: 'disetujui' },
  { siapa: 'kirim', teks: 'Siapkan barang, lalu kirim', status: 'dikirim' },
  { siapa: 'minta', teks: 'Barang datang: hitung, lalu terima di POS', status: 'penuh' },
]

const ARTI_STATUS: { status: Status; arti: string }[] = [
  { status: 'menunggu', arti: 'Permintaan sudah terkirim. Cabang pengirim belum memprosesnya.' },
  { status: 'disetujui', arti: 'Cabang pengirim sudah membuat nota. Barang belum dikirim.' },
  { status: 'disiapkan', arti: 'Barang sedang dikemas di cabang pengirim.' },
  { status: 'dikirim', arti: 'Barang sedang di jalan. Begitu sampai, lakukan penerimaan.' },
  { status: 'penuh', arti: 'Selesai. Semua barang sudah diterima.' },
  { status: 'sebagian', arti: 'Selesai, tapi ada barang yang kurang. Alasannya sudah ditulis.' },
  { status: 'batal', arti: 'Permintaan dibatalkan. Tidak ada barang yang dikirim.' },
]

export default function PanduanPoInternalPage() {
  return (
    <article className="space-y-10">
      <div>
        <Link href="/panduan" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Semua panduan
        </Link>
        <h1 className="mt-3 text-3xl font-black leading-tight text-foreground sm:text-4xl">Minta Barang ke Cabang Lain</h1>
        <p className="mt-1 text-lg font-semibold text-muted-foreground">Di aplikasi namanya: PO Internal</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">Untuk:</span>
          <LabelPeran peran="kasir" />
          <LabelPeran peran="gm" />
          <LabelPeran peran="owner" />
        </div>
      </div>

      <div className="rounded-2xl bg-primary/10 p-5 text-lg leading-relaxed text-foreground">
        <p>
          <strong>Contoh:</strong> Toko Depan kehabisan pasir kucing. Gudang punya banyak.
        </p>
        <p className="mt-2">Toko Depan tidak boleh langsung minta lewat WhatsApp. Permintaannya harus ditulis di sistem. Caranya ada di bawah.</p>
      </div>

      <Kotak jenis="penting" judul="ATURAN PALING PENTING">
        <p className="text-lg font-bold">Semua permintaan barang WAJIB lewat sistem.</p>
        <p>Grup WhatsApp hanya untuk memberi kabar dan mengingatkan, bukan untuk meminta barang.</p>
        <p>Kalau tidak lewat sistem, stok jadi kacau dan laporan akhir bulan tidak lengkap.</p>
      </Kotak>

      <section aria-labelledby="dua-pihak">
        <h2 id="dua-pihak" className="text-2xl font-black text-foreground">Ada dua pihak</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-emerald-300 bg-card p-4 dark:border-emerald-800">
            <Store className="h-8 w-8 text-emerald-600" aria-hidden />
            <p className="mt-2 text-xl font-black text-foreground">Toko yang minta</p>
            <p className="text-base text-muted-foreground">
              Toko yang butuh barang. Di aplikasi disebut <strong>Cabang Tujuan</strong>.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-sky-300 bg-card p-4 dark:border-sky-800">
            <Warehouse className="h-8 w-8 text-sky-600" aria-hidden />
            <p className="mt-2 text-xl font-black text-foreground">Cabang yang kirim</p>
            <p className="text-base text-muted-foreground">
              Cabang yang punya barang, biasanya Gudang. Di aplikasi disebut <strong>Cabang Pengirim</strong>.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="peta">
        <h2 id="peta" className="text-2xl font-black text-foreground">Alurnya singkat</h2>
        <ol className="mt-4 space-y-1">
          {PETA.map((p, i) => (
            <li key={i}>
              <div
                className={`flex items-center gap-3 rounded-xl border-2 bg-card p-3 ${
                  p.siapa === 'minta' ? 'border-emerald-300 dark:border-emerald-800' : 'border-sky-300 dark:border-sky-800 sm:ml-10'
                }`}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-muted-foreground">
                    {p.siapa === 'minta' ? 'Toko yang minta' : 'Cabang yang kirim'}
                  </p>
                  <p className="text-base font-semibold text-foreground">{p.teks}</p>
                </div>
                {p.status && (
                  <span className="hidden sm:block">
                    <LabelStatus status={p.status} />
                  </span>
                )}
              </div>
              {i < PETA.length - 1 && <ArrowDown className="mx-auto my-1 h-5 w-5 text-muted-foreground" aria-hidden />}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="langkah" className="space-y-5">
        <h2 id="langkah" className="text-2xl font-black text-foreground">Langkah demi langkah</h2>

        <Langkah
          nomor={1}
          judul="Tulis permintaan"
          peran={{ label: 'Dikerjakan oleh', daftar: ['kasir'] }}
          tempat="Toko yang minta · Web POS"
        >
          <Urutan>
            <Klik>
              Buka menu <Menu>PO Internal</Menu>.
            </Klik>
            <Klik>
              Klik <Tombol>+ Buat PO Internal</Tombol>.
            </Klik>
            <Klik>
              Pilih <strong>Cabang Pengirim</strong> (cabang yang punya barang).
            </Klik>
            <Klik>Cari produk, isi jumlah dan satuannya. Ulangi untuk setiap produk.</Klik>
            <Klik>
              Periksa lagi semuanya: nama produk, jumlah, satuan. Lalu klik <Tombol>Kirim Permintaan</Tombol>.
            </Klik>
            <Klik>
              Muncul layar &quot;Periksa kembali sebelum mengirim&quot;. Kalau sudah benar, klik <Tombol>Ya, Kirim</Tombol>.
            </Klik>
          </Urutan>
          <p>
            Sekarang status permintaan: <LabelStatus status="menunggu" />
          </p>
          <Kotak jenis="penting" judul="SETELAH TERKIRIM, KABARI GRUP">
            <p className="flex items-start gap-2">
              <MessageCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden />
              <span>
                Foto atau screenshot permintaan tadi, lalu kirim ke <strong>grup WhatsApp</strong> supaya Owner/GM tahu.
              </span>
            </p>
          </Kotak>
          <Kotak jenis="tips">
            <p>
              Belum selesai mengetik? Klik <Tombol>Tahan sebagai draft</Tombol>. Nanti lanjutkan dengan <Tombol>Lanjutkan</Tombol>.
            </p>
            <p>
              Selama statusnya masih <LabelStatus status="menunggu" />, isi permintaan masih bisa ditambah, diubah, atau
              dihapus.
            </p>
          </Kotak>
        </Langkah>

        <Langkah
          nomor={2}
          judul="Proses permintaan jadi nota"
          peran={{ label: 'Dikerjakan oleh', daftar: ['kasir', 'gm', 'owner'] }}
          tempat="Cabang yang kirim · paling lambat besok (H+1)"
        >
          <p>Ada dua cara. Pilih salah satu saja.</p>

          <div className="rounded-xl border border-border p-4">
            <p className="flex flex-wrap items-center gap-2 text-lg font-black">
              Cara A: lewat POS <LabelPeran peran="kasir" />
            </p>
            <div className="mt-3">
              <Urutan>
                <Klik>
                  Buka menu <Menu>Kasir</Menu>, lalu klik tombol <Tombol>PO Internal</Tombol>.
                </Klik>
                <Klik>
                  Di bagian <Menu>Menunggu</Menu>, pilih permintaannya.
                </Klik>
                <Klik>
                  Klik <Tombol>Proses ke Keranjang</Tombol>. Barang masuk ke keranjang.
                </Klik>
                <Klik>
                  <strong>Periksa harga.</strong> Harga awalnya harga eceran. Ganti ke harga khusus toko dengan <Tombol>Ubah Tier</Tombol>.
                </Klik>
                <Klik>
                  Bayar dengan metode <strong>hutang/tempo</strong>. <strong>Jangan pilih Tunai.</strong>
                </Klik>
              </Urutan>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="flex flex-wrap items-center gap-2 text-lg font-black">
              Cara B: lewat Backoffice <LabelPeran peran="gm" />
              <LabelPeran peran="owner" />
            </p>
            <div className="mt-3">
              <Urutan>
                <Klik>
                  Buka menu <Menu>Transfer Internal</Menu>, lalu klik permintaannya.
                </Klik>
                <Klik>
                  Klik <Tombol>Proses via Bulk Sale</Tombol>.
                </Klik>
                <Klik>
                  <strong>Periksa harga</strong>, pastikan sudah memakai harga khusus toko.
                </Klik>
                <Klik>Simpan notanya.</Klik>
              </Urutan>
            </div>
          </div>

          <p>
            Sekarang status: <LabelStatus status="disetujui" />. <strong>Stok cabang pengirim langsung berkurang.</strong>
          </p>
          <Kotak jenis="penting" judul="HARGA HARUS BENAR SEBELUM DISIMPAN">
            <p>Harga di nota ini nanti menjadi modal toko yang minta. Kalau salah, modal dan laba toko itu ikut salah.</p>
          </Kotak>
        </Langkah>

        <Langkah
          nomor={3}
          judul="Siapkan dan kirim barang"
          peran={{ label: 'Dikerjakan oleh', daftar: ['kasir', 'gm', 'owner'] }}
          tempat="Cabang yang kirim"
        >
          <p>Ubah status sesuai keadaan barang yang sebenarnya.</p>
          <div className="rounded-xl border border-border p-4">
            <p className="text-lg font-black">Kalau lewat POS</p>
            <div className="mt-3">
              <Urutan>
                <Klik>
                  Klik tombol <Tombol>PO Internal</Tombol>, buka bagian <Menu>Terjual, Menunggu Kirim</Menu>.
                </Klik>
                <Klik>
                  Saat barang sudah dibawa, klik <Tombol>Konfirmasi Pengiriman</Tombol>.
                </Klik>
              </Urutan>
            </div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-lg font-black">Kalau lewat Backoffice</p>
            <div className="mt-3">
              <Urutan>
                <Klik>
                  Saat barang mulai dikemas, klik <Tombol>Mulai Persiapan</Tombol>. Status jadi <LabelStatus status="disiapkan" />
                </Klik>
                <Klik>
                  Cetak surat jalan dengan <Tombol>Print Surat Jalan</Tombol>.
                </Klik>
                <Klik>
                  Saat barang sudah dibawa, klik <Tombol>Konfirmasi Pengiriman</Tombol>.
                </Klik>
              </Urutan>
            </div>
          </div>
          <p>
            Sekarang status: <LabelStatus status="dikirim" />
          </p>
        </Langkah>

        <Langkah
          nomor={4}
          judul="Pantau status permintaan"
          peran={{ label: 'Dikerjakan oleh', daftar: ['kasir'] }}
          tempat="Toko yang minta · Web POS → PO Internal"
        >
          <p>Cek status permintaanmu setiap hari, sampai barangnya datang.</p>
          <Kotak jenis="penting" judul="BELUM DIPROSES SAMPAI BESOK?">
            <p>
              Kalau statusnya masih <LabelStatus status="menunggu" /> lewat dari 1 hari, <strong>ingatkan di grup WhatsApp</strong>.
            </p>
          </Kotak>
        </Langkah>

        <Langkah
          nomor={5}
          judul="Barang datang: hitung, lalu terima"
          peran={{ label: 'Dikerjakan oleh', daftar: ['kasir'] }}
          tempat="Toko yang minta · Web POS"
        >
          <Urutan>
            <Klik>
              Buka menu <Menu>Transfer Masuk</Menu>.
            </Klik>
            <Klik>
              <strong>Hitung barangnya dulu</strong>, satu per satu.
            </Klik>
            <Klik>
              Isi <strong>Qty Terima</strong> sesuai hasil hitunganmu.
            </Klik>
            <Klik>
              Ada yang kurang? Tulis alasannya di <strong>Alasan Selisih</strong>. Kolom ini wajib diisi.
            </Klik>
            <Klik>
              Klik <Tombol>Konfirmasi Diterima</Tombol>.
            </Klik>
          </Urutan>
          <p>
            Sekarang status: <LabelStatus status="penuh" /> atau <LabelStatus status="sebagian" />.{' '}
            <strong>Baru sekarang stok tokomu bertambah.</strong>
          </p>
          <Kotak jenis="jangan">
            <p>
              <strong>Jangan klik Konfirmasi Diterima sebelum selesai menghitung.</strong> Penerimaan hanya bisa disimpan
              <strong> satu kali</strong> dan tidak bisa diulang.
            </p>
            <p>Jangan menunda penerimaan. Kalau barang sudah datang, langsung terima hari itu juga.</p>
          </Kotak>
          <Kotak jenis="penting" judul="BARANG KURANG ATAU RUSAK?">
            <p className="flex items-start gap-2">
              <MessageCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden />
              <span>
                Tulis di <strong>Alasan Selisih</strong>, lalu <strong>laporkan ke grup WhatsApp</strong>.
              </span>
            </p>
          </Kotak>
        </Langkah>

        <Langkah
          nomor={6}
          judul="Hutang antar cabang"
          peran={{ label: 'Dibayar oleh', daftar: ['owner', 'gm'] }}
          tempat="Backoffice → Hutang Piutang Internal"
        >
          <p>
            Ini <strong>otomatis</strong>. Setelah barang diterima, sistem mencatat bahwa toko yang minta berhutang ke cabang
            pengirim.
          </p>
          <p>
            Jumlah hutangnya = <strong>barang yang diterima</strong> × <strong>harga di nota</strong>. Barang yang tidak
            datang tidak dihitung.
          </p>
          <p>
            Owner atau GM bisa membayarnya kapan saja di menu <Menu>Hutang Piutang Internal</Menu>.
          </p>
        </Langkah>
      </section>

      <section aria-labelledby="arti-status">
        <h2 id="arti-status" className="text-2xl font-black text-foreground">Arti warna status</h2>
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
          {ARTI_STATUS.map((s) => (
            <li key={s.status} className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-center sm:gap-4">
              <span className="sm:w-44 sm:flex-shrink-0">
                <LabelStatus status={s.status} />
              </span>
              <span className="text-base text-foreground">{s.arti}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="jangan" className="space-y-3">
        <h2 id="jangan" className="text-2xl font-black text-foreground">Yang tidak boleh dilakukan</h2>
        <Kotak jenis="jangan">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Minta barang lewat grup WhatsApp tanpa menulisnya di sistem.</strong>
            </li>
            <li>Mengirim barang yang permintaannya belum ada di sistem.</li>
            <li>
              Membuat nota baru sendiri untuk permintaan yang sudah ada. Selalu proses dari <Tombol>PO Internal</Tombol> atau{' '}
              <Tombol>Proses via Bulk Sale</Tombol>, supaya stok dan hutang tidak tercatat dua kali.
            </li>
            <li>Memilih pembayaran Tunai saat memproses permintaan cabang lain.</li>
            <li>Menerima barang tanpa menghitungnya.</li>
          </ul>
        </Kotak>
      </section>

      <section aria-labelledby="kalau" className="space-y-3">
        <h2 id="kalau" className="text-2xl font-black text-foreground">Kalau ada masalah</h2>
        <KalauMaka kalau="Saya salah tulis permintaan. Bagaimana?">
          <p>
            Kalau status masih <LabelStatus status="menunggu" />: buka menu <Menu>PO Internal</Menu>, klik{' '}
            <strong>Lihat detail</strong>, lalu <Tombol>+ Tambah Produk</Tombol>. Di sana produk bisa ditambah, jumlahnya
            diubah, atau dihapus.
          </p>
          <p>Mau membatalkan seluruh permintaan? Atau sudah diproses cabang pengirim? Kabari di grup WhatsApp supaya GM/Owner yang mengurusnya.</p>
        </KalauMaka>
        <KalauMaka kalau="Permintaan saya belum diproses juga.">
          <p>Cabang pengirim punya waktu paling lambat 1 hari (H+1). Lewat dari itu, ingatkan di grup WhatsApp.</p>
        </KalauMaka>
        <KalauMaka kalau="Barang sudah sampai, tapi stok di POS belum bertambah.">
          <p>
            Stok baru bertambah setelah kamu klik <Tombol>Konfirmasi Diterima</Tombol> di menu <Menu>Transfer Masuk</Menu>{' '}
            (langkah 5).
          </p>
        </KalauMaka>
        <KalauMaka kalau="Barang belum muncul di menu Transfer Masuk.">
          <p>
            Artinya cabang pengirim belum klik <Tombol>Konfirmasi Pengiriman</Tombol>. Minta mereka melakukannya lewat grup
            WhatsApp. Jangan terima barang di luar sistem.
          </p>
        </KalauMaka>
        <KalauMaka kalau="Harga di nota ternyata salah, padahal sudah disimpan.">
          <p>Lapor ke GM/Owner di grup WhatsApp. Jangan membuat nota baru sendiri.</p>
        </KalauMaka>
      </section>

      <p className="border-t border-border pt-6 text-sm text-muted-foreground">Terakhir diperbarui: 4 Oktober 2026</p>
    </article>
  )
}
