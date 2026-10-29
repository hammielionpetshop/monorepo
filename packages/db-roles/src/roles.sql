-- Role aplikasi & hak aksesnya (spec HRIS L0 §5).
--
-- Idempoten: dijalankan apply-roles.mjs di SETIAP deploy, sesudah keempat aliran migrasi,
-- supaya tabel yang baru dibuat migrasi langsung ikut ter-GRANT.
--
-- Role bersifat se-cluster, hak CONNECT per database. Database berakhiran `_staging`
-- mendapat role `stg_*`, selain itu role produksi. Karena CONNECT dicabut dari PUBLIC,
-- role staging tidak bisa membuka database produksi, dan sebaliknya.
--
-- View HRIS yang membaca petshop dimiliki pemilik migrasi, jadi hris_app sengaja tidak
-- diberi akses apa pun ke schema petshop.
DO $$
DECLARE
  prefix text := CASE WHEN current_database() LIKE '%\_staging' THEN 'stg_' ELSE '' END;
  role_name text;
  schema_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['bo_app', 'order_app', 'hris_app'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = prefix || role_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', prefix || role_name);
    END IF;
  END LOOP;

  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;

  FOR role_name, schema_name IN
    SELECT * FROM (VALUES
      ('bo_app', 'petshop'),
      ('bo_app', 'auth'),
      ('order_app', 'petshop'),
      ('hris_app', 'hris'),
      ('hris_app', 'logistics'),
      ('hris_app', 'auth')
    ) AS access(role_name, schema_name)
  LOOP
    role_name := prefix || role_name;
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', schema_name, role_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', schema_name, role_name);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO %I', schema_name, role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', schema_name, role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', schema_name, role_name);
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY['bo_app', 'order_app', 'hris_app'] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), prefix || role_name);
  END LOOP;
END $$;
