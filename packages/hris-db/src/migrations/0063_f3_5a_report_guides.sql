CREATE TABLE "hris"."report_guides" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" text,
	"case_label" text,
	"report_to" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by_account_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_guides_case_label" CHECK ("hris"."report_guides"."request_type" is not null or btrim(coalesce("hris"."report_guides"."case_label", '')) <> ''),
	CONSTRAINT "report_guides_report_to_not_blank" CHECK (btrim("hris"."report_guides"."report_to") <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "report_guides_active_type_uq" ON "hris"."report_guides" USING btree ("request_type") WHERE "hris"."report_guides"."active" and "hris"."report_guides"."request_type" is not null;--> statement-breakpoint
CREATE INDEX "report_guides_sort_idx" ON "hris"."report_guides" USING btree ("sort_order");--> statement-breakpoint
-- Ditulis tangan: isi awal = baris guideLine di kode sebelum F3-5a, urutan = urutan daftar jenis (spec F3-5 §2.1).
INSERT INTO "hris"."report_guides" ("request_type", "report_to", "sort_order") VALUES
  ('identity_change', 'Ganti rekening wajib foto buku tabungan. HR memeriksa.', 1),
  ('position_setting_change', 'Pilih jabatan dan tandanya di Pengaturan Jabatan. Pemilik atau GM memutuskan.', 2),
  ('rule_announcement', 'Tulis di Kantor › Pengumuman › Tulis perubahan aturan. Pemilik atau GM memutuskan yang menyangkut uang.', 3),
  ('relocation', 'Dijawab dari pertanyaan "Sudah pindah cabang?" di Absen. HR, Pemilik, atau GM memutuskan.', 4),
  ('absence', 'Sakit lebih dari 2 hari wajib surat dokter. HR, Pemilik, atau GM memutuskan.', 5),
  ('clarification', 'Jelaskan dari menu Perlu Dijelaskan sebelum batas 3 hari. HR, Pemilik, atau GM memutuskan.', 6),
  ('overtime_claim', 'Foto kertas lembur dan pilih yang menyuruh, dari menu Lembur Saya. HR, Pemilik, atau GM mengesahkan.', 7),
  ('salary_change', 'Usulkan dari Kantor › Gaji Karyawan › Ubah Gaji. Pemilik atau GM memutuskan.', 8),
  ('inventory_loss', 'Catat dari Kantor › Kehilangan Barang dengan foto hasil opname. Pemilik atau GM mengesahkan.', 9),
  ('manual_cash_shortage', 'Catat dari Kantor › Minus Kas, tab Catat tangan. Pemilik atau GM mengesahkan.', 10),
  ('other_deduction', 'Ajukan dari Kantor › Potongan Lain. Pemilik atau GM mengesahkan.', 11),
  ('driver_fine', 'Ajukan dari Gaji › Denda Driver & Kenek. Pemilik atau GM mengesahkan.', 12),
  ('unloading_late', 'Isi dari Gaji › Laporan Bongkaran › Laporan baru. Pemilik atau GM yang bukan pembuat dan bukan peserta memutuskan.', 13),
  ('unloading_not_received', 'Lapor dari kartu Upah bongkaran di Pendapatan Saya. Pemilik atau GM memutuskan: Sudah diselesaikan (catatan) atau Tidak terbukti (alasan).', 14),
  ('free_bonus', 'Catat dari Kantor › Persetujuan Bonus › Catat Bonus Bebas. Pemilik atau GM mengesahkan.', 15),
  ('payslip_reopen', 'Ajukan dari layar Slip › Minta buka kembali. Pemilik atau GM memutuskan.', 16),
  ('deduction_objection', 'Ajukan dari pemberitahuan potongan sebelum batas 3 hari. Pemilik atau GM memutuskan: disetujui = ditiadakan, ditolak = tetap.', 17),
  ('payslip_objection', 'Ajukan dari Slip Saya sebelum batasnya. HR, Pemilik, atau GM memutuskan; slip tidak ditahan selama menunggu.', 18),
  ('payslip_objection_owner', 'Ajukan dari Slip Saya sebelum batasnya. Pemilik atau GM memutuskan.', 19),
  ('advance', 'Ajukan dari Saya › Kasbon Saya. Finance memeriksa, Pemilik atau GM memutuskan, lalu uangnya diserahkan.', 20),
  ('advance_cancel', 'Minta dari kartu kasbon di Kasbon Saya. Pemilik atau GM memutuskan: Setujui = kasbon dibatalkan, Tolak = tetap berjalan.', 21),
  ('advance_not_received', 'Lapor dari kartu kasbon di Kasbon Saya. Pemilik atau GM memutuskan: Sudah diselesaikan (catatan) atau Tidak terbukti (alasan).', 22),
  ('advance_postpone', 'Minta dari kartu kasbon di Kasbon Saya. Pemilik atau GM memutuskan: Setujui = semua cicilan bergeser satu gajian.', 23),
  ('advance_legacy', 'Finance mengetik sisa per orang dari Gaji › Kasbon › Bawaan. Pemilik atau GM mengesahkan; cicilan dimulai di slip hari pindah.', 24);
