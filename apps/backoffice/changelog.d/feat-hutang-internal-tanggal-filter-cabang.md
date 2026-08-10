### Added

- Filter cabang di halaman Hutang Piutang Transfer Internal. Menyaring dua sisi sekaligus
  (debitur maupun kreditur), jadi semua hutang yang melibatkan cabang terpilih tetap muncul.
  Pilihannya diturunkan dari data yang sudah dibatasi server, sehingga tiap opsi dijamin
  ada isinya dan tidak ada nama cabang yang bocor ke user yang tak berhak melihat barisnya.
- Parameter `branchId` di `GET /api/bo/inter-branch-payables`. Di-AND dengan scope cabang
  user, jadi ia hanya bisa mempersempit hasil — bukan jalan pintas melihat cabang lain.

### Changed

- List hutang internal: kolom **No. Transfer** diganti **Tanggal**. Nomor transfernya tetap
  terjangkau lewat tooltip dan halaman transfer yang ditautkan dari tanggal tersebut.
- Kartu ringkasan dan hitungan di tab status kini mengikuti filter cabang, dengan keterangan
  "dari N total" saat filter aktif. Sebelumnya keduanya selalu menghitung seluruh data
  sehingga angkanya membantah isi tabel.

### Fixed

- Halaman Hutang Piutang Transfer Internal menarik hutang **seluruh cabang** untuk siapa pun
  yang membukanya. API-nya sudah memakai `scopeFilterAny`, tapi halamannya query sendiri
  tanpa pembatasan sama sekali. Kini dibatasi di level query, bukan disembunyikan di UI.
