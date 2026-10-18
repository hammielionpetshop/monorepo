### Added

- Saat nota disimpan, **server** kini menegakkan **kuota per cabang** dan **syarat stok** promo:
  sisa jatah dibaca sambil mengunci datanya (anti-rebutan antar kasir), promo dihitung ulang, dan
  pemakaian jatah ditambah di transaksi yang sama. Kiriman kasir yang tidak lagi cocok (jatah/stok
  keburu habis) ditolak supaya kasir menghitung ulang — jatah tidak pernah jebol minus.
- **Batalkan nota** mengembalikan jatah kuota yang terpakai nota itu; **retur tidak** (barang sempat
  terjual dengan promo) — sesuai keputusan owner 2026-10-18.
- Promo untuk layar kasir (`GET /api/pos/promos`) ikut mengirim **sisa jatah & stok barang hadiah**
  supaya perkiraan di layar mendekati keputusan server (promo diam-diam berhenti saat jatah/stok habis).
