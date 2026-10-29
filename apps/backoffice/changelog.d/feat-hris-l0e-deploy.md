### Added

- Lingkungan staging terpisah untuk Back Office, HRIS, dan portal pesanan di domain `staginghml.my.id`, dengan gerbang kata sandi, database/role staging, serta volume unggahan tersendiri.
- Pipeline staging dan alat penyegaran salinan database yang dibatasi ke `petshop_staging`. Image HRIS ikut dibangun, sementara layanan HRIS produksi tetap harus diaktifkan secara khusus.

### Changed

- Jatah koneksi database portal pesanan menjadi enam; staging memakai jatah kecil tersendiri agar berbagi server tanpa menghabiskan koneksi produksi.
