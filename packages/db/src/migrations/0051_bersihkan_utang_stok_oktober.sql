-- Koreksi data: bersihkan utang stok (oversell) yang masih terbuka dan tercatat sampai
-- 31 Oktober 2026 WIB (keputusan owner 2026-11-05: "bukan hapus, tapi bersihkan, agar
-- tidak menumpuk"). Penyebab menumpuk: kiriman Gudang ke toko dulu tidak melunasi utang
-- stok, sehingga utang toko praktis hanya tertutup lewat Stock Opname. Mulai rilis ini
-- terima kiriman ikut melunasi (lihat internal-transfers/[id]/status).
--
-- Tidak ada baris yang dihapus dan angka stok kasir (product_stocks.qty) TIDAK berubah.
-- Invarian yang dijaga: product_stocks.qty = SUM(batch.qty_remaining) − SUM(utang belum lunas).
-- Per utang (tertua dulu, per cabang+produk):
--   1. Bagian yang tertutup batch: batch cabang itu dikurangi FIFO sebesar qty tersebut,
--      dicatat di stock_shortfall_clearings (reference_type CLEANUP) — sama seperti pelunasan
--      lewat penerimaan barang. Batch berkurang X, utang berkurang X → stok kasir tetap.
--      HPP nota lama sengaja TIDAK dikoreksi supaya laporan bulan yang sudah lewat tidak berubah.
--   2. Sisa yang tidak tertutup batch (stok sistem memang minus) ditandai write-off dengan
--      alasan pembersihan; tetap tampil sebagai defisit sampai Stock Opname berikutnya.
--
-- Idempoten: utang yang sudah lunas/write-off tidak disentuh lagi. Di DB tanpa utang lama
-- migrasi ini tidak mengubah apa pun selain satu baris audit log ringkasan.
DO $$
DECLARE
  cutoff CONSTANT timestamp := '2026-10-31 17:00:00'; -- 1 Nov 2026 00.00 WIB, kolom disimpan UTC
  reason CONSTANT varchar := 'Pembersihan utang stok s.d. 31 Okt 2026 (keputusan owner 2026-11-05)';
  sf RECORD;
  b RECORD;
  need integer;
  take integer;
  cleared integer;
  cost_sum numeric;
  n_closed integer := 0;
  n_partial_wo integer := 0;
  n_wo integer := 0;
  qty_cleared_total bigint := 0;
  qty_wo_total bigint := 0;
BEGIN
  FOR sf IN
    SELECT id, branch_id, product_id, qty_remaining
    FROM petshop.stock_shortfalls
    WHERE closed_at IS NULL AND written_off_at IS NULL
      AND qty_remaining > 0 AND created_at < cutoff
    ORDER BY branch_id, product_id, created_at, id
    FOR UPDATE
  LOOP
    need := sf.qty_remaining;
    cleared := 0;
    cost_sum := 0;

    FOR b IN
      SELECT id, qty_remaining, cost_price
      FROM petshop.product_stock_batches
      WHERE branch_id = sf.branch_id AND product_id = sf.product_id AND qty_remaining > 0
      ORDER BY received_at, id
      FOR UPDATE
    LOOP
      EXIT WHEN need <= 0;
      take := LEAST(need, b.qty_remaining);
      UPDATE petshop.product_stock_batches SET qty_remaining = qty_remaining - take WHERE id = b.id;
      need := need - take;
      cleared := cleared + take;
      cost_sum := cost_sum + take::numeric * b.cost_price;
    END LOOP;

    IF cleared > 0 THEN
      INSERT INTO petshop.stock_shortfall_clearings (shortfall_id, qty_cleared, cost_price_at_clearing, reference_type, reference_id)
      VALUES (sf.id, cleared, ROUND(cost_sum / cleared)::integer, 'CLEANUP', NULL);
      qty_cleared_total := qty_cleared_total + cleared;
    END IF;

    IF need = 0 THEN
      UPDATE petshop.stock_shortfalls SET qty_remaining = 0, closed_at = now() WHERE id = sf.id;
      n_closed := n_closed + 1;
    ELSE
      UPDATE petshop.stock_shortfalls
      SET qty_remaining = need, written_off_at = now(), write_off_reason = reason
      WHERE id = sf.id;
      IF cleared > 0 THEN n_partial_wo := n_partial_wo + 1; ELSE n_wo := n_wo + 1; END IF;
      qty_wo_total := qty_wo_total + need;
    END IF;
  END LOOP;

  INSERT INTO petshop.audit_logs (action, table_name, record_id, new_data)
  VALUES (
    'STOCK_SHORTFALL_CLEANUP', 'stock_shortfalls', '0051',
    json_build_object(
      'reason', reason,
      'lunasLewatBatch', n_closed,
      'sebagianLunasSisanyaWriteOff', n_partial_wo,
      'writeOffPenuh', n_wo,
      'qtyDilunasiBatch', qty_cleared_total,
      'qtyWriteOff', qty_wo_total
    )::text
  );
END $$;
