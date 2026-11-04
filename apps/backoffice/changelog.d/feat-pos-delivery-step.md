### Changed
- **Ongkos kirim di kasir kini lewat langkah "Pengiriman" sebelum layar bayar**, supaya tidak ada lagi ongkir yang lupa diinput. Saat menekan Proses Bayar (F10), kasir wajib menjawab untuk **setiap nota** (termasuk nota Umum): **1 Ambil sendiri**, **2 Dikirim kurir cabang**, atau **3 Dikirim truk Gudang**. Tekan angka 1/2/3 untuk memilih cepat.
  - **Kurir cabang:** wajib pilih **siapa yang mengantar** dan **ongkirnya** (tombol cepat Rp 8.000 / 10.000 / 15.000 atau ketik sendiri, kelipatan Rp 1.000), atau centang **Gratis ongkir** bila tidak ditagih. Baris ongkos kirim ditambahkan otomatis ke nota; bonus pengantar, struk, dan laporan Delivery & Antar Barang tetap seperti biasa.
  - **Truk Gudang:** selalu gratis ongkir (penanda kiriman truk untuk HRIS); hanya untuk nota berpelanggan.
  - Layar bayar menampilkan ringkasan pengiriman dengan tombol **← Ubah pengiriman**.
- Produk **Ongkos Kirim tidak lagi muncul di pencarian barang kasir** (ongkir hanya diisi di langkah Pengiriman, supaya tidak dobel). Tab **Grooming** (antar-jemput kucing) tidak berubah dan langsung ke layar bayar; begitu juga keranjang PO Internal.
- "Diantar kurir cabang" selalu bersama ongkos kirim: tidak muncul di Bulk Sale, tidak bisa dipilih lewat **Ubah cara kirim**, dan server menolak kurir tanpa ongkir.
