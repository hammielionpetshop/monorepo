-- Backfill stock_opname_items.variance_cost_value untuk item SO APPROVED lama yang
-- kebetulan tersimpan Rp0 padahal qty selisihnya nyata (lihat commit "fix(stock-opname):
-- fallback modal saat selisih tak tertutup batch" — logika di bawah ini mencerminkan
-- computeVarianceCostValue di apps/backoffice/lib/services/stock-opname.ts).
--
-- TIDAK menyentuh qty atau batch. Best-effort: pakai data modal SAAT INI (batch berstok
-- sekarang -> cost matrix cabang -> defaultCostPrice), bukan rekonstruksi historis persis.
-- Item yang nilainya sudah non-nol TIDAK disentuh.
--
-- Pemakaian (lihat reference-akses-psql-prod):
--   ssh ubuntu@43.173.8.37
--   sudo docker exec -i hammielion-postgres-1 psql -U admin -d petshop_db < backfill-so-variance-cost.sql
--
-- DRY RUN dulu (baris terakhir p_apply=false) untuk lihat daftar & nilai yang akan
-- ditulis. Ganti ke true pada baris terakhir untuk benar-benar menerapkan, lalu jalankan
-- ulang skrip ini (function di-DROP di akhir supaya idempotent dijalankan berkali-kali).

CREATE OR REPLACE FUNCTION petshop._backfill_so_variance_cost(p_apply boolean, p_from_date date DEFAULT NULL)
RETURNS TABLE(item_id integer, so_number varchar, product_name varchar, branch_id integer, old_value integer, new_value integer) AS $$
DECLARE
  r RECORD;
  b RECORD;
  remaining numeric;
  total_cost numeric;
  covered numeric;
  uncovered numeric;
  variance_base numeric;
  fallback numeric;
  base_uom integer;
  default_cost integer;
BEGIN
  FOR r IN
    SELECT soi.id AS item_id, soi.product_id, soi.uom_id, soi.variance_qty, soi.variance_cost_value,
           so.branch_id, so.so_number, p.name AS product_name,
           COALESCE(c.ratio, 1) AS item_ratio
    FROM petshop.stock_opname_items soi
    JOIN petshop.stock_opnames so ON so.id = soi.so_id
    JOIN petshop.products p ON p.id = soi.product_id
    LEFT JOIN petshop.product_uom_conversions c
      ON c.product_id = soi.product_id AND c.uom_id = soi.uom_id
    WHERE so.status = 'APPROVED'
      AND soi.variance_qty <> 0
      AND soi.variance_cost_value = 0
      AND (soi.item_status = 'APPROVED' OR soi.item_status IS NULL)
      AND (p_from_date IS NULL OR (so.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= p_from_date)
  LOOP
    variance_base := ROUND(ABS(r.variance_qty) * r.item_ratio);
    remaining := variance_base;
    total_cost := 0;
    covered := 0;

    FOR b IN
      SELECT bb.qty_remaining * COALESCE(cc.ratio, 1) AS qty,
             CASE WHEN COALESCE(cc.ratio, 1) > 1 THEN bb.cost_price::numeric / cc.ratio ELSE bb.cost_price::numeric END AS cost_price
      FROM petshop.product_stock_batches bb
      LEFT JOIN petshop.product_uom_conversions cc
        ON cc.product_id = bb.product_id AND cc.uom_id = bb.uom_id
      WHERE bb.product_id = r.product_id AND bb.branch_id = r.branch_id AND bb.qty_remaining > 0
      ORDER BY bb.received_at ASC
    LOOP
      EXIT WHEN remaining <= 0;
      CONTINUE WHEN b.qty <= 0;
      IF b.qty >= remaining THEN
        total_cost := total_cost + remaining * b.cost_price;
        covered := covered + remaining;
        remaining := 0;
      ELSE
        total_cost := total_cost + b.qty * b.cost_price;
        covered := covered + b.qty;
        remaining := remaining - b.qty;
      END IF;
    END LOOP;

    uncovered := variance_base - covered;
    IF uncovered > 0 THEN
      SELECT pp.base_uom_id, pp.default_cost_price INTO base_uom, default_cost
      FROM petshop.products pp WHERE pp.id = r.product_id;

      fallback := NULL;
      IF base_uom IS NOT NULL THEN
        SELECT puc.cost_price INTO fallback
        FROM petshop.product_uom_costs puc
        WHERE puc.product_id = r.product_id AND puc.branch_id = r.branch_id
          AND puc.uom_id = base_uom AND puc.cost_price > 0
        LIMIT 1;

        IF fallback IS NULL THEN
          SELECT puc.cost_price::numeric / cc.ratio INTO fallback
          FROM petshop.product_uom_costs puc
          JOIN petshop.product_uom_conversions cc
            ON cc.product_id = puc.product_id AND cc.uom_id = puc.uom_id
          WHERE puc.product_id = r.product_id AND puc.branch_id = r.branch_id
            AND puc.uom_id <> base_uom AND puc.cost_price > 0 AND cc.ratio > 0
          ORDER BY cc.ratio DESC
          LIMIT 1;
        END IF;

        IF fallback IS NULL AND default_cost > 0 THEN
          fallback := default_cost;
        END IF;

        IF fallback IS NOT NULL THEN
          total_cost := total_cost + uncovered * fallback;
        END IF;
      END IF;
    END IF;

    IF ROUND(total_cost) > 0 THEN
      item_id := r.item_id;
      so_number := r.so_number;
      product_name := r.product_name;
      branch_id := r.branch_id;
      old_value := r.variance_cost_value;
      new_value := ROUND(total_cost);
      RETURN NEXT;

      IF p_apply THEN
        UPDATE petshop.stock_opname_items
        SET variance_cost_value = ROUND(total_cost)
        WHERE id = r.item_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ganti p_apply ke true untuk benar-benar menulis; false = pratinjau saja (tidak menulis)
-- p_from_date: hanya SO yang dibuat >= tanggal ini (WIB) yang ikut; NULL = semua tanggal
--
-- Sudah dijalankan 2026-09-22 dengan p_apply=true, p_from_date='2026-09-01' (324 item,
-- Rp36.822.784, cabang 4 & 7) — item itu sudah bernilai non-nol jadi otomatis terlewati
-- kalau dijalankan ulang. Item lama (Juli–Agustus 2026, ~Rp754 juta, terutama Gudang)
-- SENGAJA belum dibackfill — bertumpuk dengan insiden "stok produksi rusak" dan modal
-- yang tersedia sekarang bukan modal historis asli; perlu keputusan terpisah.
SELECT * FROM petshop._backfill_so_variance_cost(false, '2026-09-01') ORDER BY branch_id, item_id;

DROP FUNCTION petshop._backfill_so_variance_cost(boolean, date);
