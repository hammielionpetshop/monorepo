### Fixed

- Setelah onboarding login pertama (ganti password + PIN), user kini benar-benar diarahkan ke halaman tujuan sesuai peran. Sebelumnya `router.replace` menyajikan hasil redirect `/onboarding` yang masih ter-cache dari saat cookie lama aktif, sehingga user mentok di halaman onboarding meski kredensial sudah tersimpan. Kini memakai full-page navigation agar middleware dievaluasi ulang dengan cookie baru.
