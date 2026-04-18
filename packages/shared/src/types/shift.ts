export interface Shift {
  id: number;
  branchId: number;
  openedById: number;
  closedById: number | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: Date;
  closedAt: Date | null;
}
