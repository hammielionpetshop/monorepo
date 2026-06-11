<!-- markdownlint-disable MD013 -->

# Backoffice PO Supplier Payable Hardening Design

## Ringkasan

Tahap pertama hardening fokus ke jalur `purchase order` dan `supplier payable` karena area ini langsung memengaruhi stok, hutang supplier, dan audit actor. Middleware sudah mewajibkan token untuk `/api/*`, tetapi beberapa route masih mempercayai `role`, `createdById`, `approvedById`, `paidById`, dan `branchId` dari request body atau query. Perbaikan tahap ini menutup celah pasca-login tanpa membuat refactor auth besar.

## Tujuan

- Menghapus kepercayaan pada actor dan role dari body untuk endpoint PO dan supplier payable.
- Mengunci akses branch: `OWNER` dan `GM` boleh lintas branch; role lain hanya `payload.branchId`.
- Mengunci mutasi finansial/stok dengan validasi Zod dan transaksi kondisional.
- Menjaga pola response error Bahasa Indonesia dan status code yang sudah dipakai repo.
- Menambahkan catatan CHANGELOG karena ini bug fix keamanan/data integrity.

## Scope Tahap 1

Endpoint yang masuk tahap ini:

- `apps/backoffice/app/api/bo/purchase-orders/route.ts`
- `apps/backoffice/app/api/bo/purchase-orders/[id]/route.ts`
- `apps/backoffice/app/api/bo/purchase-orders/[id]/approve/route.ts`
- `apps/backoffice/app/api/bo/purchase-orders/[id]/approve-receiving/route.ts`
- `apps/backoffice/app/api/bo/purchase-orders/[id]/reject/route.ts`
- `apps/backoffice/app/api/bo/purchase-orders/[id]/update-invoice/route.ts`
- `apps/backoffice/app/api/bo/supplier-payables/route.ts`
- `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.ts`
- `apps/backoffice/CHANGELOG.md`

Di luar tahap ini: POS sync/transactions, stock opname, open bills, stock FIFO concurrency, dan session revocation. Area itu tetap masuk backlog tahap berikutnya.

## Pendekatan Terpilih

Gunakan pola lokal yang sudah ada, bukan framework auth baru. Setiap route membaca cookie `accessToken`, memanggil `verifyAccessToken`, lalu melakukan role dan branch check inline. Pola pembanding utama adalah `apps/backoffice/app/api/bo/inter-branch-payables/[id]/pay/route.ts` untuk pembayaran dan `apps/backoffice/app/api/bo/purchase-orders/[id]/reverse-receiving/route.ts` untuk branch-scoped PO mutation.

Alasan memilih pendekatan ini:

- Blast radius kecil karena tidak mengubah middleware atau kontrak auth global.
- Endpoint berisiko bisa ditutup lebih cepat.
- Pola bisa diekstrak menjadi helper bersama pada tahap berikutnya setelah perilaku stabil.

Alternatif yang ditunda:

- Membuat `requireAuth/requireRole/requireBranchAccess` shared helper terlebih dulu. Ini bagus jangka panjang, tetapi memperbesar scope tahap pertama.
- Mengunci semua area audit sekaligus. Ini terlalu besar dan meningkatkan risiko regresi.

## Aturan Otorisasi

- Route GET list/detail PO dan supplier payable wajib punya payload valid.
- `OWNER` dan `GM` dianggap global dan boleh mengakses semua branch.
- `MANAGER` boleh membuat dan mengelola PO hanya untuk `payload.branchId`.
- Approve PO di bawah threshold tetap boleh `OWNER`, `GM`, atau `MANAGER` sesuai pola lama, tetapi branch harus valid.
- Approve PO dengan total minimal Rp 5.000.000 hanya boleh `OWNER`.
- Approve receiving dan update invoice hanya boleh `OWNER` atau `GM` karena memutasi stok dan payable.
- Reject PO boleh `OWNER`, `GM`, atau `MANAGER` dengan branch scope.
- Pembayaran supplier payable boleh `OWNER`, `GM`, `MANAGER`, atau `FINANCE`; non-global hanya untuk payable branch sendiri.

## Aturan Data

- `createdById`, `approvedById`, `rejectedById`, dan `paidById` selalu berasal dari `payload.userId`.
- `role` dari body diabaikan dan tidak boleh dipakai untuk otorisasi.
- `branchId` dari query/body hanya boleh dipakai oleh `OWNER` atau `GM`; role lain dipaksa ke `payload.branchId`.
- PATCH PO detail menggunakan allowlist field, bukan spread `...body`.
- `update-invoice` harus memastikan setiap item yang diupdate milik `poId` route.
- Pembayaran supplier payable harus integer positif, tidak boleh melebihi sisa tagihan, dan update payable harus kondisional untuk mencegah overpayment race.
- Error internal tidak mengembalikan `error.message` mentah ke client.

## Testing

Tambahkan atau perkuat test route di area backoffice bila harness test route sudah tersedia. Test minimal yang harus ada:

- Spoof `role: 'OWNER'` pada approve PO tidak memberi akses jika JWT role bukan OWNER/GM/MANAGER sesuai aturan.
- Spoof `approvedById` atau `paidById` tidak tersimpan; route memakai `payload.userId`.
- Non-global user tidak bisa mengakses/mutasi PO atau payable branch lain.
- Pembayaran negatif, nol, dan melebihi sisa tagihan ditolak.
- Concurrent-style conditional update payment mengembalikan konflik saat payable berubah.

Jika test route penuh sulit dibuat karena dependensi Next/Drizzle, gunakan unit test untuk fungsi helper kecil atau route handler dengan mock `db`, `cookies`, dan `verifyAccessToken`.

## Risiko dan Mitigasi

- UI lama mungkin masih mengirim `role`, `approvedById`, atau `paidById`. Route baru harus tetap menerima body lama tetapi mengabaikan field berbahaya agar frontend tidak langsung rusak.
- Ada working tree yang sudah kotor sebelum pekerjaan ini. Implementasi harus membaca diff sebelum edit dan hanya menyentuh file scope tahap 1.
- Beberapa endpoint POS mungkin memakai BO PO detail. Branch scope harus mengikuti token yang digunakan; bila POS butuh akses khusus, itu harus ditangani pada tahap POS, bukan membuka endpoint BO.

## Acceptance Criteria

- Given user tanpa token, when memanggil endpoint scope tahap 1, then menerima 401.
- Given user role tidak diizinkan, when melakukan mutasi PO/payable, then menerima 403.
- Given non-global user branch A, when membaca atau memutasi data branch B, then menerima 404 atau 403 tanpa data branch B.
- Given request body berisi actor palsu, when mutasi berhasil, then actor tersimpan dari JWT payload.
- Given payment amount tidak valid atau melebihi sisa tagihan, when membayar supplier payable, then request ditolak tanpa mengubah payable.
- Given dua pembayaran bersaing pada payable yang sama, when saldo berubah sebelum update kedua, then update kedua konflik dan tidak membuat overpayment.
- Given perubahan selesai, when `pnpm typecheck` atau scope typecheck terkait dijalankan, then tidak ada error baru dari file tahap 1.
