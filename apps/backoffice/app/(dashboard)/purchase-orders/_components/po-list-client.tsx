'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreatePODialog } from './create-po-dialog';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-purple-100 text-purple-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-orange-100 text-orange-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-600' },
  COMPLETED: { label: 'Selesai', color: 'bg-green-100 text-green-800' },
};

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'PENDING_APPROVAL', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'IN_TRANSIT', label: 'Transit' },
  { key: 'PARTIALLY_RECEIVED,FULLY_RECEIVED', label: 'Diterima' },
];

interface PO {
  id: number;
  poNumber: string;
  status: string;
  totalAmount: string;
  notes: string | null;
  createdAt: string;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
}

interface Supplier { id: number; name: string }
interface Branch { id: number; name: string }

interface POListClientProps {
  pos: PO[];
  suppliers: Supplier[];
  branches: Branch[];
  currentUserId: number;
  role: string;
}

export function POListClient({ pos, suppliers, branches, currentUserId, role }: POListClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canCreate = ['OWNER', 'MANAGER', 'GM'].includes(role);

  const filtered = activeTab === 'all'
    ? pos
    : pos.filter(p => activeTab.split(',').includes(p.status));

  return (
    <div className="space-y-4">
      {/* Tabs + Create Button */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                {tab.key === 'all'
                  ? pos.length
                  : pos.filter(p => tab.key.split(',').includes(p.status)).length}
              </span>
            </button>
          ))}
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mb-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            + Buat PO
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Tidak ada Purchase Order untuk filter ini.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. PO</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(po => {
                const statusInfo = STATUS_LABELS[po.status] ?? { label: po.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{po.poNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{po.branch.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{po.supplier.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      Rp {parseFloat(po.totalAmount).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(po.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create PO Dialog */}
      {showCreateDialog && (
        <CreatePODialog
          suppliers={suppliers}
          branches={branches}
          currentUserId={currentUserId}
          role={role}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
