import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { hasPermission } from '@/lib/authz';
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  branches,
  products,
  unitsOfMeasure,
  poReceivingLogs,
  poReceivingItems,
  supplierPayables,
  users,
  paymentMethods,
  eq,
  ne,
  asc,
  desc,
} from '@/lib/db';
import { notFound } from 'next/navigation';
import { PODetailClient } from './_components/po-detail-client';
import { supplierDueDate } from '@/lib/supplier-due-date';
import { todayWibDate } from '@/lib/payment-date';
import { loadLastCosts, lastCostKey } from '@/lib/po-last-cost';
import { loadPendingPriceEstimates } from '@/lib/po-pending-estimate';
import { supplierCreditBalance } from '@/lib/services/supplier-return-service';

export const dynamic = 'force-dynamic';

export default async function PODetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baru?: string }>;
}) {
  const { id } = await params;
  const { baru } = await searchParams;
  const poId = parseInt(id);

  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const currentUserId = (payload as any)?.userId ?? (payload as any)?.id ?? 1;
  const role = (payload as any)?.role ?? 'OWNER';
  const canEditInvoice = payload ? hasPermission(payload, 'po.financial') : false;
  const canPay = payload ? hasPermission(payload, 'payable.pay') : false;
  const today = todayWibDate();
  let methods: { id: number; name: string }[] = [];
  let creditBalance = 0;

  let po: any = null;
  let error: string | null = null;

  try {
    const [poRows, itemRows, logRows, logItemRows, payableRows] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          rejectionNote: purchaseOrders.rejectionNote,
          invoiceNumber: purchaseOrders.invoiceNumber,
          targetDeliveryDate: purchaseOrders.targetDeliveryDate,
          approvedAt: purchaseOrders.approvedAt,
          createdAt: purchaseOrders.createdAt,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          supplierPhone: suppliers.phone,
          supplierPaymentTermDays: suppliers.paymentTermDays,
          branchId: purchaseOrders.branchId,
          branchName: branches.name,
          createdByName: users.name,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
        .leftJoin(users, eq(purchaseOrders.createdById, users.id))
        .where(eq(purchaseOrders.id, poId))
        .limit(1),
      db
        .select({
          id: purchaseOrderItems.id,
          productId: purchaseOrderItems.productId,
          productName: products.name,
          productSku: products.sku,
          uomId: purchaseOrderItems.uomId,
          uomCode: unitsOfMeasure.code,
          qtyOrdered: purchaseOrderItems.qtyOrdered,
          qtyReceived: purchaseOrderItems.qtyReceived,
          qtyDamaged: purchaseOrderItems.qtyDamaged,
          unitCost: purchaseOrderItems.unitCost,
          invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
        })
        .from(purchaseOrderItems)
        .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(purchaseOrderItems.uomId, unitsOfMeasure.id))
        .where(eq(purchaseOrderItems.poId, poId)),
      db
        .select({
          id: poReceivingLogs.id,
          receivedAt: poReceivingLogs.receivedAt,
          receivedByName: users.name,
          invoiceReceived: poReceivingLogs.invoiceReceived,
          note: poReceivingLogs.note,
        })
        .from(poReceivingLogs)
        .leftJoin(users, eq(poReceivingLogs.receivedById, users.id))
        .where(eq(poReceivingLogs.poId, poId))
        .orderBy(desc(poReceivingLogs.receivedAt)),
      db
        .select({
          id: poReceivingItems.id,
          logId: poReceivingItems.logId,
          qtyReceived: poReceivingItems.qtyReceived,
          qtyDamaged: poReceivingItems.qtyDamaged,
          expiryDate: poReceivingItems.expiryDate,
          note: poReceivingItems.note,
          productName: products.name,
          productSku: products.sku,
          uomCode: unitsOfMeasure.code,
        })
        .from(poReceivingItems)
        .innerJoin(purchaseOrderItems, eq(poReceivingItems.poItemId, purchaseOrderItems.id))
        .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(purchaseOrderItems.uomId, unitsOfMeasure.id))
        .where(eq(purchaseOrderItems.poId, poId)),
      db
        .select({
          id: supplierPayables.id,
          totalAmount: supplierPayables.totalAmount,
          paidAmount: supplierPayables.paidAmount,
          status: supplierPayables.status,
          createdAt: supplierPayables.createdAt,
          dueAt: supplierPayables.dueAt,
        })
        .from(supplierPayables)
        .where(eq(supplierPayables.poId, poId))
        .limit(1),
    ]);

    if (!poRows[0]) return notFound();

    const row = poRows[0];
    const [lastCosts, pendingByPo, methodRows] = await Promise.all([
      loadLastCosts(row.branchId, itemRows),
      loadPendingPriceEstimates([poId]),
      db
        .select({ id: paymentMethods.id, name: paymentMethods.name })
        .from(paymentMethods)
        .where(ne(paymentMethods.type, 'DEBT'))
        .orderBy(asc(paymentMethods.id)),
    ]);
    methods = methodRows;
    if (row.supplierId) creditBalance = await supplierCreditBalance(db, row.supplierId);
    const pending = pendingByPo.get(poId);
    po = {
      ...row,
      supplier: { id: row.supplierId, name: row.supplierName ?? '-', phone: row.supplierPhone },
      branch: { id: row.branchId, name: row.branchName ?? '-' },
      items: itemRows.map((item) => ({
        ...item,
        lastCost: lastCosts.get(lastCostKey(item.productId, item.uomId)) ?? null,
      })),
      pricePendingReceived: pending?.pendingItems ?? 0,
      receivingLogs: logRows.map((log) => ({
        ...log,
        items: logItemRows.filter((item) => item.logId === log.id),
      })),
      payable: payableRows[0]
        ? {
            id: payableRows[0].id,
            estimatedTotal: payableRows[0].totalAmount + (pending?.extraEstimate ?? 0),
            paymentTermDays: row.supplierPaymentTermDays,
            totalAmount: payableRows[0].totalAmount,
            paidAmount: payableRows[0].paidAmount,
            status: payableRows[0].status,
            dueDate: supplierDueDate(payableRows[0].createdAt, row.supplierPaymentTermDays, payableRows[0].dueAt),
            today,
          }
        : null,
    };
  } catch (e) {
    console.error('PODetailPage error:', e);
    error = 'Terjadi kesalahan saat mengambil data';
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <PODetailClient
        po={po}
        currentUserId={currentUserId}
        role={role}
        canEditInvoice={canEditInvoice}
        isNew={baru === '1'}
        canPay={canPay}
        paymentMethods={methods}
        supplierCreditBalance={creditBalance}
        today={today}
      />
    </div>
  );
}
