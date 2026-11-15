import * as dotenv from 'dotenv';
import path from 'path';
import { eq, and, inArray, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { createDb } from '../index';
import * as schema from '../schema/index';

/**
 * Data uji untuk database LOKAL, dibangun DI ATAS katalog master hasil `clone-master.ts`.
 *
 * Yang dibuat di sini justru yang sengaja TIDAK diklon dari produksi:
 * - user uji dengan PIN yang diketahui (hash produksi tak terpakai karena PIN-nya rahasia)
 * - stok bersih (stok produksi minus hampir menyeluruh — titik mula yang salah untuk menguji)
 * - shift terbuka + sesi kasir aktif
 * - transaksi contoh yang sengaja "salah input", termasuk kasus satuan non-dasar dan hutang
 *
 * Idempotent & hanya untuk host lokal.
 */
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not defined');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const targetHost = new URL(connectionString).hostname;
if (!LOCAL_HOSTS.has(targetHost)) {
  console.error(`❌ Dibatalkan: DATABASE_URL menunjuk ke "${targetHost}", bukan database lokal.`);
  process.exit(1);
}

const db = createDb(connectionString);

const TEST_USERS = [
  { staffNumber: 'ADM001', email: 'admin@example.com', name: 'Owner Uji', role: 'OWNER', pin: '0000', canEdit: true },
  { staffNumber: 'MGR001', email: 'manager@example.com', name: 'Manager Uji', role: 'MANAGER', pin: '1234', canEdit: true },
  { staffNumber: 'KSR001', email: 'kasir1@example.com', name: 'Ani Kasir', role: 'KASIR', pin: '1111', canEdit: false },
  { staffNumber: 'KSR002', email: 'kasir2@example.com', name: 'Budi Kasir', role: 'KASIR', pin: '2222', canEdit: false },
];

const STOCK_PER_PRODUCT = 40;

async function main() {
  console.log('🌱 Menyiapkan data uji lokal di atas katalog hasil klon...\n');

  const productCount = await db.select({ n: sql<number>`count(*)::int` }).from(schema.products);
  if ((productCount[0]?.n ?? 0) === 0) {
    console.error('❌ Katalog produk kosong. Jalankan klon master lebih dulu: pnpm db:local:clone');
    process.exit(1);
  }

  // 1. Cabang & role dari hasil klon
  const branchRows = await db.select().from(schema.branches).orderBy(schema.branches.id);
  const branch = branchRows.find((b) => /pusat/i.test(b.name)) ?? branchRows[0];
  if (!branch) throw new Error('Tidak ada cabang. Klon master belum jalan?');

  const roleRows = await db.select().from(schema.roles);
  const roleByName = new Map(roleRows.map((r) => [r.name, r.id]));

  // 2. User uji — PIN produksi tidak diketahui, jadi akun lokal dibuat sendiri
  console.log('   - User uji...');
  const passwordHash = await argon2.hash('admin123');
  const userIdByStaff = new Map<string, number>();

  for (const seed of TEST_USERS) {
    const roleId = roleByName.get(seed.role);
    if (!roleId) {
      console.warn(`     ⚠ role ${seed.role} tidak ada, user ${seed.staffNumber} dilewati`);
      continue;
    }
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.staffNumber, seed.staffNumber))
      .limit(1);

    if (existing) {
      userIdByStaff.set(seed.staffNumber, existing.id);
      continue;
    }

    const [created] = await db
      .insert(schema.users)
      .values({
        staffNumber: seed.staffNumber,
        email: seed.email,
        passwordHash,
        pinHash: await argon2.hash(seed.pin),
        name: seed.name,
        roleId,
        branchId: branch.id,
        isActive: true,
        // Tanpa ini middleware melempar setiap request ke /onboarding
        mustChangeCredentials: false,
        credentialsSetAt: new Date(),
      })
      .returning();
    userIdByStaff.set(seed.staffNumber, created.id);
  }

  const ownerId = userIdByStaff.get('ADM001')!;
  const managerId = userIdByStaff.get('MGR001')!;
  const cashierId = userIdByStaff.get('KSR001')!;

  // 3. Izin koreksi transaksi — tanpa ini alur PIN tidak bisa diuji
  console.log('   - Izin transaction.edit...');
  const [editPermission] = await db
    .select()
    .from(schema.permissions)
    .where(eq(schema.permissions.code, 'transaction.edit'))
    .limit(1);

  if (editPermission) {
    await db
      .insert(schema.userPermissions)
      .values(
        TEST_USERS.filter((u) => u.canEdit && userIdByStaff.has(u.staffNumber)).map((u) => ({
          userId: userIdByStaff.get(u.staffNumber)!,
          permissionId: editPermission.id,
          grantedBy: ownerId,
        })),
      )
      .onConflictDoNothing();
  } else {
    console.warn('     ⚠ permission transaction.edit belum ada di katalog');
  }

  // 4. Pilih produk uji dari katalog sungguhan.
  //    Diutamakan yang punya konversi satuan (mis. DUS berisi N PCS): jalur konversi rasio
  //    inilah yang paling rawan di koreksi stok, dan tidak akan terlihat kalau semua
  //    produk uji bersatuan dasar.
  console.log('   - Memilih produk uji dari katalog...');
  const withConversion = await db
    .select({
      productId: schema.productUomConversions.productId,
      uomId: schema.productUomConversions.uomId,
      ratio: schema.productUomConversions.ratio,
    })
    .from(schema.productUomConversions)
    .innerJoin(schema.products, eq(schema.products.id, schema.productUomConversions.productId))
    .innerJoin(
      schema.productPrices,
      and(
        eq(schema.productPrices.productId, schema.productUomConversions.productId),
        eq(schema.productPrices.uomId, schema.productUomConversions.uomId),
        eq(schema.productPrices.branchId, branch.id),
      ),
    )
    .where(eq(schema.products.isActive, true))
    .limit(3);

  const basePriced = await db
    .select({ productId: schema.productPrices.productId, uomId: schema.productPrices.uomId })
    .from(schema.productPrices)
    .innerJoin(schema.products, eq(schema.products.id, schema.productPrices.productId))
    .where(
      and(
        eq(schema.productPrices.branchId, branch.id),
        eq(schema.products.isActive, true),
        eq(schema.productPrices.uomId, schema.products.baseUomId),
      ),
    )
    .limit(12);

  const targetProductIds = Array.from(
    new Set([...withConversion.map((c) => c.productId), ...basePriced.map((p) => p.productId)]),
  ).slice(0, 12);

  const productRows = await db
    .select()
    .from(schema.products)
    .where(inArray(schema.products.id, targetProductIds));
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const priceRows = await db
    .select()
    .from(schema.productPrices)
    .where(
      and(
        inArray(schema.productPrices.productId, targetProductIds),
        eq(schema.productPrices.branchId, branch.id),
      ),
    );
  const priceFor = (productId: number, uomId: number) =>
    priceRows.find((p) => p.productId === productId && p.uomId === uomId && p.tierType === 'RETAIL') ??
    priceRows.find((p) => p.productId === productId && p.uomId === uomId);

  // 5. Stok bersih: dua batch FIFO bermodal beda supaya urutan FIFO benar-benar teruji
  console.log('   - Stok bersih (2 batch FIFO per produk)...');
  for (const product of productRows) {
    const existing = await db
      .select({ id: schema.productStocks.id })
      .from(schema.productStocks)
      .where(
        and(
          eq(schema.productStocks.productId, product.id),
          eq(schema.productStocks.branchId, branch.id),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    const baseCost = product.defaultCostPrice && product.defaultCostPrice > 0
      ? product.defaultCostPrice
      : Math.max(1000, Math.round((priceFor(product.id, product.baseUomId)?.price ?? 10_000) * 0.7));

    const half = STOCK_PER_PRODUCT / 2;
    await db.insert(schema.productStockBatches).values([
      {
        productId: product.id,
        branchId: branch.id,
        uomId: product.baseUomId,
        qtyReceived: half,
        qtyRemaining: half,
        costPrice: baseCost,
        receivedAt: new Date(Date.now() - 14 * 86_400_000),
      },
      {
        productId: product.id,
        branchId: branch.id,
        uomId: product.baseUomId,
        qtyReceived: half,
        qtyRemaining: half,
        costPrice: Math.round(baseCost * 1.1),
        receivedAt: new Date(Date.now() - 3 * 86_400_000),
      },
    ]);
    await db.insert(schema.productStocks).values({
      productId: product.id,
      branchId: branch.id,
      uomId: product.baseUomId,
      qty: STOCK_PER_PRODUCT,
    });
    await db
      .insert(schema.productUomCosts)
      .values({ productId: product.id, branchId: branch.id, uomId: product.baseUomId, costPrice: baseCost })
      .onConflictDoNothing();
  }

  // 6. Shift terbuka + sesi kasir aktif
  console.log('   - Shift terbuka...');
  let [shift] = await db
    .select()
    .from(schema.shifts)
    .where(and(eq(schema.shifts.branchId, branch.id), eq(schema.shifts.status, 'OPEN')))
    .limit(1);

  if (!shift) {
    [shift] = await db
      .insert(schema.shifts)
      .values({
        branchId: branch.id,
        openedById: managerId,
        shiftNumber: 1,
        assignedCashiers: [cashierId, ownerId, managerId],
        openingCash: 500_000,
        status: 'OPEN',
      })
      .returning();
  }

  for (const userId of [cashierId, ownerId, managerId]) {
    const existing = await db
      .select({ id: schema.shiftCashierSessions.id })
      .from(schema.shiftCashierSessions)
      .where(
        and(
          eq(schema.shiftCashierSessions.shiftId, shift.id),
          eq(schema.shiftCashierSessions.cashierId, userId),
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      await db
        .insert(schema.shiftCashierSessions)
        .values({ shiftId: shift.id, cashierId: userId, status: 'ACTIVE' });
    }
  }

  // 7. Transaksi contoh — tiap baris mewakili satu kasus koreksi yang ingin diuji
  console.log('   - Transaksi contoh...');
  const existingTrx = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(eq(schema.transactions.shiftId, shift.id))
    .limit(1);

  const methods = await db.select().from(schema.paymentMethods);
  const cashMethod = methods.find((m) => m.type === 'CASH');
  const debtMethod = methods.find((m) => m.type === 'DEBT');

  const summary: string[] = [];

  if (existingTrx.length === 0 && cashMethod) {
    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.isActive, true))
      .limit(1);

    interface Sample {
      label: string;
      productId: number;
      uomId: number;
      qty: number;
      debt: boolean;
    }

    const samples: Sample[] = [];

    // Kasus A — satuan dasar, qty kebanyakan (kasus paling sering: salah ketik qty)
    const baseProduct = productRows.find((p) => priceFor(p.id, p.baseUomId));
    if (baseProduct) {
      samples.push({ label: 'qty kebanyakan (satuan dasar)', productId: baseProduct.id, uomId: baseProduct.baseUomId, qty: 5, debt: false });
    }

    // Kasus B — SATUAN NON-DASAR: menguji konversi rasio saat stok dikembalikan/dipotong
    const conv = withConversion.find((c) => productById.has(c.productId) && priceFor(c.productId, c.uomId));
    if (conv) {
      samples.push({ label: `satuan non-dasar (rasio ${conv.ratio}× ke satuan dasar)`, productId: conv.productId, uomId: conv.uomId, qty: 3, debt: false });
    }

    // Kasus C — pembayaran HUTANG: menguji penyesuaian customer_debts saat dikoreksi
    const debtProduct = productRows.find((p) => p.id !== baseProduct?.id && priceFor(p.id, p.baseUomId));
    if (debtProduct && debtMethod && customer) {
      samples.push({ label: 'pembayaran hutang (uji penyesuaian piutang)', productId: debtProduct.id, uomId: debtProduct.baseUomId, qty: 4, debt: true });
    }

    let counter = 1;
    for (const sample of samples) {
      const price = priceFor(sample.productId, sample.uomId);
      if (!price) continue;
      const product = productById.get(sample.productId)!;
      const gross = price.price * sample.qty;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const tendered = sample.debt ? gross : Math.ceil((gross * 1.4) / 10_000) * 10_000;

      const [trx] = await db
        .insert(schema.transactions)
        .values({
          trxNumber: `TRX-${dateStr}-${String(counter).padStart(4, '0')}`,
          branchId: branch.id,
          shiftId: shift.id,
          cashierId,
          customerId: sample.debt ? customer!.id : null,
          totalAmount: gross,
          discountAmount: 0,
          taxAmount: 0,
          payableAmount: gross,
          paidAmount: tendered,
          changeAmount: Math.max(0, tendered - gross),
          status: 'COMPLETED',
          saleType: 'RETAIL',
        })
        .returning();

      // Rasio ke satuan dasar untuk memotong stok & menghitung HPP
      let ratio = 1;
      if (sample.uomId !== product.baseUomId) {
        const [c] = await db
          .select({ ratio: schema.productUomConversions.ratio })
          .from(schema.productUomConversions)
          .where(
            and(
              eq(schema.productUomConversions.productId, sample.productId),
              eq(schema.productUomConversions.uomId, sample.uomId),
            ),
          )
          .limit(1);
        ratio = c?.ratio ?? 1;
      }
      const baseQty = sample.qty * ratio;

      const [batch] = await db
        .select()
        .from(schema.productStockBatches)
        .where(
          and(
            eq(schema.productStockBatches.productId, sample.productId),
            eq(schema.productStockBatches.branchId, branch.id),
          ),
        )
        .orderBy(schema.productStockBatches.receivedAt)
        .limit(1);
      const unitCost = batch?.costPrice ?? product.defaultCostPrice ?? 0;

      await db.insert(schema.transactionItems).values({
        transactionId: trx.id,
        productId: sample.productId,
        productName: product.name,
        productSku: product.sku,
        uomId: sample.uomId,
        qty: sample.qty,
        unitPrice: price.price,
        totalPrice: gross,
        discountAmount: 0,
        priceTier: price.tierType,
        cogs: unitCost * baseQty,
      });

      await db.insert(schema.transactionPayments).values({
        transactionId: trx.id,
        paymentMethodId: sample.debt ? debtMethod!.id : cashMethod.id,
        amount: tendered,
      });

      if (sample.debt) {
        await db.insert(schema.customerDebts).values({
          customerId: customer!.id,
          transactionId: trx.id,
          branchId: branch.id,
          totalAmount: gross,
          paidAmount: 0,
          remainingAmount: gross,
          status: 'UNPAID',
          createdBy: cashierId,
        });
      }

      // Stok & batch ikut dipotong supaya angkanya konsisten dengan transaksinya
      await db
        .update(schema.productStocks)
        .set({ qty: sql`${schema.productStocks.qty} - ${baseQty}` })
        .where(
          and(
            eq(schema.productStocks.productId, sample.productId),
            eq(schema.productStocks.branchId, branch.id),
          ),
        );
      if (batch) {
        await db
          .update(schema.productStockBatches)
          .set({ qtyRemaining: Math.max(0, batch.qtyRemaining - baseQty) })
          .where(eq(schema.productStockBatches.id, batch.id));
      }

      summary.push(`TRX-${dateStr}-${String(counter).padStart(4, '0')}  ${product.name} × ${sample.qty} — ${sample.label}`);
      counter += 1;
    }
  }

  const finalCounts = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM petshop.products)   AS produk,
      (SELECT count(*)::int FROM petshop.customers)  AS pelanggan,
      (SELECT count(*)::int FROM petshop.branches)   AS cabang,
      (SELECT count(*)::int FROM petshop.product_prices) AS harga
  `);
  const c = (finalCounts as unknown as Record<string, number>[])[0];

  console.log('\n✅ Data uji lokal siap.\n');
  console.log(`   Katalog   : ${c.produk} produk · ${c.harga} baris harga · ${c.pelanggan} pelanggan · ${c.cabang} cabang (klon prod)`);
  console.log(`   Cabang uji: ${branch.name}`);
  console.log(`   Shift     : #${shift.shiftNumber} OPEN · stok bersih ${STOCK_PER_PRODUCT}/produk untuk ${productRows.length} produk uji`);
  if (summary.length > 0) {
    console.log('\n   Transaksi siap dikoreksi:');
    summary.forEach((s) => console.log(`     ${s}`));
  }
  console.log('\n   Login POS (PIN):');
  TEST_USERS.forEach((u) =>
    console.log(`     ${u.staffNumber}  ${u.name.padEnd(14)} PIN ${u.pin}${u.canEdit ? '   ← boleh menyetujui koreksi' : ''}`),
  );
  console.log('\n   Login backoffice: admin@example.com / admin123\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed data uji lokal gagal:');
  console.error(err);
  process.exit(1);
});
