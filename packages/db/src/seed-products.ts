import * as dotenv from 'dotenv';
import path from 'path';
import { createDb } from './index.js';
import * as schema from './schema/index.js';
import { sql } from 'drizzle-orm';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const db = createDb(connectionString);

async function main() {
  console.log('🌱 Truncating existing product data...');
  await db.execute(sql`TRUNCATE TABLE petshop.product_stock_batches, petshop.product_stocks, petshop.product_prices, petshop.product_uom_conversions, petshop.products, petshop.customers CASCADE`);

  console.log('🌱 Seeding products and initial stock...');

  // 1. Get initial data
  const uoms = await db.select().from(schema.unitsOfMeasure);
  const pcUom = uoms.find(u => u.code === 'PCS');
  const sakUom = uoms.find(u => u.code === 'SAK');
  const boxUom = uoms.find(u => u.code === 'BOX');

  const branches = await db.select().from(schema.branches);
  const mainBranch = branches[0];

  if (!pcUom || !sakUom || !mainBranch) {
    console.error('❌ Missing prerequisite data (UOMs or Branches). Run seed.ts first.');
    process.exit(1);
  }

  // 2. Categories
  console.log('   - Seeding categories...');
  const categoryNames = ['Pakan Kucing', 'Pakan Anjing', 'Pasir Kucing', 'Aksesoris', 'Obat & Vitamin', 'Snack & Treat'];
  const createdCategories = await Promise.all(
    categoryNames.map(name => 
      db.insert(schema.categories).values({ name }).onConflictDoUpdate({ target: schema.categories.name, set: { name } }).returning()
    )
  );
  const catMap = Object.fromEntries(createdCategories.flat().map(c => [c.name, c.id]));

  // 3. Brands
  console.log('   - Seeding brands...');
  const brandNames = ['Royal Canin', 'Whiskas', 'Pedigree', 'Me-O', 'Pro Plan', 'Hammielion Special'];
  const createdBrands = await Promise.all(
    brandNames.map(name => 
      db.insert(schema.brands).values({ name }).onConflictDoUpdate({ target: schema.brands.name, set: { name } }).returning()
    )
  );
  const brandMap = Object.fromEntries(createdBrands.flat().map(b => [b.name, b.id]));

  // 4. Products Data
  const productsToSeed = [
    { name: 'RC Indoor 2kg', cat: 'Pakan Kucing', brand: 'Royal Canin', sku: 'RC001', barcode: '880123456001', baseUom: pcUom.id, bigUom: sakUom.id, ratio: 12, weightGram: 2000, bigWeightGram: 24500 },
    { name: 'Whiskas Tuna 1.2kg', cat: 'Pakan Kucing', brand: 'Whiskas', sku: 'WS001', barcode: '880123456002', baseUom: pcUom.id, bigUom: sakUom.id, ratio: 10, weightGram: 1200, bigWeightGram: 12500 },
    { name: 'Me-O Kitten 1kg', cat: 'Pakan Kucing', brand: 'Me-O', sku: 'ME001', barcode: '880123456003', baseUom: pcUom.id, bigUom: sakUom.id, ratio: 12, weightGram: 1000, bigWeightGram: 12500 },
    { name: 'Pasir Wangi Citrus 25L', cat: 'Pasir Kucing', brand: 'Hammielion Special', sku: 'PS001', barcode: '880123456004', baseUom: pcUom.id, bigUom: sakUom.id, ratio: 5, weightGram: 15000, bigWeightGram: 76000 },
    { name: 'Pro Plan Adult 3kg', cat: 'Pakan Kucing', brand: 'Pro Plan', sku: 'PP001', barcode: '880123456005', baseUom: pcUom.id, bigUom: sakUom.id, ratio: 8, weightGram: 3000, bigWeightGram: 25000 },
    { name: 'Pedigree Adult 10kg', cat: 'Pakan Anjing', brand: 'Pedigree', sku: 'PD001', barcode: '880123456006', baseUom: pcUom.id, bigUom: sakUom.id, ratio: 1, weightGram: 10000, bigWeightGram: 10000 },
    { name: 'Snack Catit Creamy', cat: 'Snack & Treat', brand: 'Me-O', sku: 'SN001', barcode: '880123456007', baseUom: pcUom.id, bigUom: boxUom!.id, ratio: 24, weightGram: 15, bigWeightGram: 400 },
    { name: 'Obat Kutu Frontline', cat: 'Obat & Vitamin', brand: 'Hammielion Special', sku: 'OB001', barcode: '880123456008', baseUom: pcUom.id, bigUom: boxUom!.id, ratio: 12, weightGram: 5, bigWeightGram: 100 },
  ];

  console.log('   - Seeding products, conversions, prices, and stock...');
  for (const p of productsToSeed) {
    // Insert Product
    const [insertedProduct] = await db.insert(schema.products).values({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: catMap[p.cat],
      brandId: brandMap[p.brand],
      baseUomId: p.baseUom,
      weightGram: p.weightGram,
    }).returning();

    // Insert UOM Conversion
    if (p.bigUom && p.ratio > 1) {
      await db.insert(schema.productUomConversions).values({
        productId: insertedProduct.id,
        uomId: p.bigUom,
        ratio: p.ratio,
        weightGram: p.bigWeightGram,
      });
    }

    // Insert Prices (Retail, Grosir, Member)
    const baseRetailPrice = 100000 + (Math.random() * 500000);
    const tiers = [
      { type: 'RETAIL', factor: 1 },
      { type: 'GROSIR', factor: 0.9 },
      { type: 'MEMBER', factor: 0.95 },
      { type: 'DISTRIBUTOR', factor: 0.8 },
      { type: 'RESELLER', factor: 0.85 },
    ];

    for (const tier of tiers) {
      // Price for Base UOM
      await db.insert(schema.productPrices).values({
        productId: insertedProduct.id,
        branchId: mainBranch.id,
        uomId: p.baseUom,
        tierType: tier.type,
        price: Math.round(baseRetailPrice * tier.factor),
      });

      // Price for Big UOM (if exists)
      if (p.bigUom && p.ratio > 1) {
        await db.insert(schema.productPrices).values({
          productId: insertedProduct.id,
          branchId: mainBranch.id,
          uomId: p.bigUom,
          tierType: tier.type,
          price: Math.round(baseRetailPrice * tier.factor * p.ratio * 0.95), // Slightly cheaper per unit in bulk
        });
      }
    }

    // Insert Initial Stock & Batches
    // Base UOM Stock
    await db.insert(schema.productStocks).values({
      productId: insertedProduct.id,
      branchId: mainBranch.id,
      uomId: p.baseUom,
      qty: 50,
    });

    // Big UOM Stock
    if (p.bigUom && p.ratio > 1) {
      await db.insert(schema.productStocks).values({
        productId: insertedProduct.id,
        branchId: mainBranch.id,
        uomId: p.bigUom,
        qty: 10,
      });
    }

    // FIFO Batches (All in Base UOM)
    const costPrice = baseRetailPrice * 0.7;
    // Batch 1 (old)
    await db.insert(schema.productStockBatches).values({
      productId: insertedProduct.id,
      branchId: mainBranch.id,
      uomId: p.baseUom,
      qtyReceived: 100,
      qtyRemaining: 30,
      costPrice: Math.round(costPrice),
      receivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    });

    // Batch 2 (new)
    await db.insert(schema.productStockBatches).values({
      productId: insertedProduct.id,
      branchId: mainBranch.id,
      uomId: p.baseUom,
      qtyReceived: 100,
      qtyRemaining: 50 + (p.ratio || 0) * 10 - 30,
      costPrice: Math.round(costPrice * 1.05),
      receivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });
  }

  // 5. Customers
  console.log('   - Seeding core customers...');
  const customers = [
    { name: 'Budi Santoso', phone: '08123456789', address: 'Jl. Merdeka No. 1' },
    { name: 'Siti Aminah', phone: '08123456780', address: 'Jl. Mawar No. 12' },
    { name: 'Ani Wijaya', phone: '08123456781', address: 'Jl. Melati No. 5' },
  ];
  await db.insert(schema.customers).values(customers);

  console.log('✅ Product seeding completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:');
  console.error(err);
  process.exit(1);
});
