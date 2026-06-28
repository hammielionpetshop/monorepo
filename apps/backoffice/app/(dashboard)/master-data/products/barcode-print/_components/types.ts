export interface BarcodeProduct {
  id: number
  sku: string | null
  name: string
  categoryName: string | null
  brandName: string | null
  barcode?: string | null
}

export interface LabelPreset {
  id: string
  label: string
  columns: number
  rows: number
  labelWidthMm: number
  labelHeightMm: number
  gapMm: number
}

export const LABEL_PRESETS: LabelPreset[] = [
  { id: 'a4-3x8', label: 'A4 — 3×8 (24 label, 64×33,9mm)', columns: 3, rows: 8, labelWidthMm: 64, labelHeightMm: 33.9, gapMm: 2 },
  { id: 'a4-3x11', label: 'A4 — 3×11 (33 label, 64×25,4mm)', columns: 3, rows: 11, labelWidthMm: 64, labelHeightMm: 25.4, gapMm: 2 },
  { id: 'a4-4x10', label: 'A4 — 4×10 (40 label, 48×25,4mm)', columns: 4, rows: 10, labelWidthMm: 48, labelHeightMm: 25.4, gapMm: 2 },
  { id: 'a4-5x13', label: 'A4 — 5×13 (65 label, 38×21,2mm)', columns: 5, rows: 13, labelWidthMm: 38, labelHeightMm: 21.2, gapMm: 1.5 },
]
