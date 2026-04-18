export const generateTrxCode = (branchCode: string): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TRX-${branchCode}-${dateStr}-${timeStr}-${randomStr}`;
};

export const generateStaffCode = (index: number): string => {
  return `STF-${index.toString().padStart(4, '0')}`;
};
