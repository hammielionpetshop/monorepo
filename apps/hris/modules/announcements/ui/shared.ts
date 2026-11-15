/** Tanggal dan jam WIB untuk layar pengumuman. */
export const whenWib = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

/** Tanggal YYYY-MM-DD sebagai teks panjang ("15 November 2026"). */
export const dateText = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));
