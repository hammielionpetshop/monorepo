import type { PromoListItem, PromoItemOption, PromoLoss } from '@/lib/services/promo-service'

export type { PromoItemOption, PromoLoss }

/** Promo seperti di `listPromos`, dengan waktu sebagai teks ISO supaya aman dikirim ke layar. */
export type PromoView = Omit<PromoListItem, 'startsAt' | 'endsAt' | 'createdAt' | 'deactivatedAt'> & {
  startsAt: string
  endsAt: string
  createdAt: string
  deactivatedAt: string | null
}

export interface BranchOption {
  id: number
  name: string
}

export function toPromoView(p: PromoListItem): PromoView {
  return {
    ...p,
    startsAt: new Date(p.startsAt).toISOString(),
    endsAt: new Date(p.endsAt).toISOString(),
    createdAt: p.createdAt.toISOString(),
    deactivatedAt: p.deactivatedAt ? p.deactivatedAt.toISOString() : null,
  }
}
