import { cleanPersonFields, type PersonValues } from './fields';

/**
 * Muat data awal karyawan dari Excel HRIS lama (spec L2g). Fungsi murni: baris Excel → karyawan siap simpan, memakai
 * pemeriksa yang sama dengan layar (`cleanPersonFields`). Satu baris salah menggagalkan seluruh muatan.
 */
export type LegacyRow = Record<string, unknown>;

export type LegacyEmployee = {
  /** Kode EMP lama, disimpan sebagai Kode lama (L9c). */
  sourceCode: string;
  person: PersonValues & { name: string };
  joinedOn: string;
  branchName: string;
  positionName: string;
  workStatus: 'TRAINING' | 'EMPLOYEE';
};

export const UNASSIGNED_POSITION = 'Belum ditentukan';

/** Keputusan owner 2026-11-01. Cabang lain sama namanya. */
const BRANCH_MAP: Record<string, string> = {
  'Back Office': 'Gudang', 'Raja Petshop': 'Toko Raja', 'Markas Petshop': 'Toko Markas',
};
const KNOWN_BRANCHES = new Set(['Gudang', 'Toko Pusat', 'Toko Depan', 'Toko Raja', 'Toko Markas']);

const POSITION_MAP: Record<string, string> = { Owner: 'Pemilik', Helper: UNASSIGNED_POSITION };
/** Keputusan owner 2026-11-04: Helper di Team Gudang adalah Kenek. */
const WAREHOUSE_HELPER = 'Kenek';
const KNOWN_POSITIONS = new Set([
  'Pemilik', 'Finance', 'Marketing', 'Kepala Gudang', 'Driver', 'Kenek', 'Kepala Toko', 'Kasir', 'Pramuniaga', 'Groomer',
  UNASSIGNED_POSITION,
]);

const GENDER_MAP: Record<string, string> = { male: 'MALE', 'laki-laki': 'MALE', female: 'FEMALE', perempuan: 'FEMALE' };
const MARITAL_MAP: Record<string, string> = {
  single: 'Belum menikah', 'belum menikah': 'Belum menikah', married: 'Menikah', menikah: 'Menikah', divorced: 'Cerai', cerai: 'Cerai',
};
const WORK_STATUS: Record<string, LegacyEmployee['workStatus']> = { training: 'TRAINING', permanent: 'EMPLOYEE', driver: 'EMPLOYEE' };

const text = (value: unknown) => (value == null ? '' : String(value).trim());

export type LegacyOptions = { excludeCodes?: readonly string[]; renames?: Readonly<Record<string, string>> };
export type LegacyResult = {
  employees: LegacyEmployee[]; errors: string[]; warnings: string[]; skippedInactive: number; skippedExcluded: number;
};

export function mapLegacyRows(rows: readonly LegacyRow[], options: LegacyOptions = {}): LegacyResult {
  const employees: LegacyEmployee[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let skippedInactive = 0;
  let skippedExcluded = 0;
  const excluded = new Set(options.excludeCodes ?? []);

  rows.forEach((row, index) => {
    const code = text(row['Kode Karyawan']);
    const where = `Baris ${index + 2} (${code || 'tanpa kode'})`;
    const status = text(row.Status);
    if (status === 'Nonaktif') { skippedInactive += 1; return; }
    if (status !== 'Aktif') { errors.push(`${where}: status "${status}" tidak dikenal.`); return; }
    if (excluded.has(code)) { skippedExcluded += 1; return; }

    const rawBranch = text(row.Cabang);
    const branchName = BRANCH_MAP[rawBranch] ?? rawBranch;
    if (!KNOWN_BRANCHES.has(branchName)) errors.push(`${where}: cabang "${rawBranch}" tidak dikenal.`);
    const rawPosition = text(row.Jabatan);
    const positionName = rawPosition === 'Helper' && text(row.Departemen) === 'Team Gudang'
      ? WAREHOUSE_HELPER
      : POSITION_MAP[rawPosition] ?? rawPosition;
    if (!KNOWN_POSITIONS.has(positionName)) errors.push(`${where}: jabatan "${rawPosition}" tidak dikenal.`);
    const workStatus = WORK_STATUS[text(row['Tipe Karyawan'])];
    if (!workStatus) errors.push(`${where}: tipe karyawan "${text(row['Tipe Karyawan'])}" tidak dikenal.`);
    const joinedOn = text(row['Tanggal Masuk']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) errors.push(`${where}: tanggal masuk tidak valid.`);

    const rawGender = text(row['Jenis Kelamin']).toLowerCase();
    if (rawGender && !GENDER_MAP[rawGender]) errors.push(`${where}: jenis kelamin "${rawGender}" tidak dikenal.`);
    const rawMarital = text(row['Status Pernikahan']).toLowerCase();
    if (rawMarital && !MARITAL_MAP[rawMarital]) errors.push(`${where}: status nikah "${rawMarital}" tidak dikenal.`);

    if (!/^[A-Z]+-\d+$/.test(code)) errors.push(`${where}: kode karyawan harus berbentuk EMP-001.`);
    // NIK keliru tidak menggagalkan muatan: dikosongkan dan dilaporkan, HR melengkapinya di layar (L9c).
    let nationalId: unknown = row.NIK;
    const nik = cleanPersonFields({ nationalId }, ['nationalId']);
    if (!nik.ok) {
      warnings.push(`${code}: NIK tidak 16 angka, dikosongkan.`);
      nationalId = null;
    }

    const cleaned = cleanPersonFields({
      nationalId,
      emergencyContactRelation: row['Hubungan Kontak Darurat'],
      name: options.renames?.[code] ?? row['Nama Lengkap'],
      phone: row['No. HP'],
      birthDate: row['Tanggal Lahir'],
      gender: GENDER_MAP[rawGender] ?? null,
      birthPlace: row['Tempat Lahir'],
      address: row.Alamat,
      emergencyContactName: row['Kontak Darurat'],
      emergencyContactPhone: row['HP Kontak Darurat'],
      religion: row.Agama,
      maritalStatus: MARITAL_MAP[rawMarital] ?? null,
      dependents: row.Tanggungan,
      education: row.Pendidikan,
      bankName: row.Bank,
      bankAccountNumber: row['No. Rekening'],
      bankAccountHolder: row['Nama Rekening'],
    }, [
      'name', 'phone', 'birthDate', 'gender', 'birthPlace', 'address', 'emergencyContactName', 'emergencyContactPhone',
      'religion', 'maritalStatus', 'dependents', 'education', 'bankName', 'bankAccountNumber', 'bankAccountHolder',
      'nationalId', 'emergencyContactRelation',
    ]);
    if (!cleaned.ok) { errors.push(`${where}: ${cleaned.error}`); return; }
    if (!cleaned.values.name) { errors.push(`${where}: nama kosong.`); return; }
    if (errors.some((e) => e.startsWith(where))) return;
    employees.push({
      sourceCode: code, person: { ...cleaned.values, name: cleaned.values.name } as LegacyEmployee['person'],
      joinedOn, branchName, positionName, workStatus,
    });
  });

  // Nomor HP unik di database; laporkan semua sekaligus, bukan gagal di baris pertama saat disimpan.
  const phones = new Map<string, string>();
  for (const employee of employees) {
    const phone = employee.person.phone;
    if (!phone) continue;
    if (phones.has(phone)) errors.push(`${employee.sourceCode}: nomor HP sama dengan ${phones.get(phone)}.`);
    phones.set(phone, employee.sourceCode);
  }
  const nationalIds = new Map<string, string>();
  for (const employee of employees) {
    const nik = employee.person.nationalId;
    if (!nik) continue;
    if (nationalIds.has(nik)) errors.push(`${employee.sourceCode}: NIK sama dengan ${nationalIds.get(nik)}.`);
    nationalIds.set(nik, employee.sourceCode);
  }
  return { employees, errors, warnings, skippedInactive, skippedExcluded };
}

const COLUMNS: Record<string, string> = {
  nationalId: 'national_id', emergencyContactRelation: 'emergency_contact_relation',
  name: 'name', phone: 'phone', birthDate: 'birth_date', gender: 'gender', birthPlace: 'birth_place', address: 'address',
  emergencyContactName: 'emergency_contact_name', emergencyContactPhone: 'emergency_contact_phone', religion: 'religion',
  maritalStatus: 'marital_status', dependents: 'dependents', education: 'education', bankName: 'bank_name',
  bankAccountNumber: 'bank_account_number', bankAccountHolder: 'bank_account_holder',
};

function literal(value: unknown): string {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Satu transaksi semua-atau-tidak-sama-sekali. Cabang/jabatan tak ditemukan = kolom wajib NULL = seluruhnya batal. */
export function legacyLoadSql(employees: readonly LegacyEmployee[]): string {
  const lines = [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM hris.employees WHERE source = 'LEGACY') THEN
  RAISE EXCEPTION 'Data lama sudah pernah dimuat.'; END IF; END $$;`,
  ];
  for (const employee of employees) {
    const entries = Object.entries(COLUMNS).map(([field, column]) => [column, literal((employee.person as Record<string, unknown>)[field])]);
    const columns = entries.map(([column]) => column).join(', ');
    const values = entries.map(([, value]) => value).join(', ');
    lines.push(`WITH e AS (
  INSERT INTO hris.employees (code, joined_on, source, legacy_code, ${columns})
  VALUES (hris.next_employee_code(), ${literal(employee.joinedOn)}, 'LEGACY', ${literal(employee.sourceCode)}, ${values}) RETURNING id, code
), p AS (
  INSERT INTO hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from, reason)
  SELECT e.id, 'INITIAL',
    (SELECT id FROM hris.branches WHERE lower(name) = lower(${literal(employee.branchName)})),
    (SELECT id FROM hris.positions WHERE lower(name) = lower(${literal(employee.positionName)})),
    ${literal(employee.workStatus)}, ${literal(employee.joinedOn)}, 'Bawaan sistem lama.'
  FROM e RETURNING employee_id
)
INSERT INTO hris.audit_events (source, job_name, entity, entity_id, action, after)
SELECT 'JOB', 'legacy-load', 'employee', p.employee_id, 'legacy_load', '{"source":"LEGACY"}'::jsonb FROM p;`);
  }
  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}

/**
 * Lengkapi karyawan bawaan yang dimuat sebelum L9c (Kode lama, NIK, hubungan kontak darurat). Dicocokkan lewat nama
 * persis di antara karyawan LEGACY; harus tepat satu, dan Kode lamanya masih kosong atau sama. Kolom yang sudah terisi
 * di HRIS tidak ditimpa. Satu transaksi; satu orang tak cocok = seluruhnya batal.
 */
export function legacyEnrichSql(employees: readonly LegacyEmployee[]): string {
  const lines = ['\\set ON_ERROR_STOP on', 'BEGIN;'];
  for (const employee of employees) {
    const name = literal(employee.person.name);
    const code = literal(employee.sourceCode);
    lines.push(`DO $$ DECLARE target integer; n integer; BEGIN
  SELECT count(*), min(id) INTO n, target FROM hris.employees
    WHERE source = 'LEGACY' AND lower(name) = lower(${name}) AND (legacy_code IS NULL OR legacy_code = ${code});
  IF n <> 1 THEN RAISE EXCEPTION 'Karyawan bawaan % (%) ditemukan % kali.', ${name}, ${code}, n; END IF;
  UPDATE hris.employees SET legacy_code = ${code},
    national_id = coalesce(national_id, ${literal(employee.person.nationalId)}),
    emergency_contact_relation = coalesce(emergency_contact_relation, ${literal(employee.person.emergencyContactRelation)}),
    updated_at = now()
  WHERE id = target;
  INSERT INTO hris.audit_events (source, job_name, entity, entity_id, action, after)
  VALUES ('JOB', 'legacy-load', 'employee', target, 'legacy_enrich', jsonb_build_object('legacyCode', ${code}));
END $$;`);
  }
  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}
