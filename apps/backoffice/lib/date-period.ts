import { todayWibDate } from './payment-date'

export interface DatePeriodSelection {
  mode: 'all' | 'day' | 'week' | 'month' | 'range'
  date: string
  month: string
  start: string
  end: string
}

export interface DatePeriodRange { start: string; end: string }

export const EMPTY_DATE_PERIOD: DatePeriodSelection = {
  mode: 'all', date: '', month: '', start: '', end: '',
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export function getDatePeriodRange(selection: DatePeriodSelection): DatePeriodRange | null {
  const { mode, date, month, start, end } = selection
  if (mode === 'all') return { start: '', end: '' }
  if (mode === 'range') {
    if ((start && !parseDate(start)) || (end && !parseDate(end)) || (start && end && start > end)) return null
    return { start, end }
  }
  if (mode === 'month') {
    if (!/^\d{4}-\d{2}$/.test(month)) return null
    const first = parseDate(`${month}-01`)
    if (!first) return null
    const last = new Date(first)
    last.setUTCMonth(last.getUTCMonth() + 1)
    last.setUTCDate(0)
    return { start: `${month}-01`, end: last.toISOString().slice(0, 10) }
  }
  const selected = parseDate(date)
  if (!selected) return null
  if (mode === 'day') return { start: date, end: date }
  if (mode !== 'week') return null
  selected.setUTCDate(selected.getUTCDate() - (selected.getUTCDay() + 6) % 7)
  const monday = selected.toISOString().slice(0, 10)
  selected.setUTCDate(selected.getUTCDate() + 6)
  return { start: monday, end: selected.toISOString().slice(0, 10) }
}

export function matchesDatePeriod(value: Date | string, range: DatePeriodRange | null): boolean {
  if (!range) return false
  if (!range.start && !range.end) return true
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const day = todayWibDate(date)
  return (!range.start || day >= range.start) && (!range.end || day <= range.end)
}

export function datePeriodPresets(today: string): { label: string; range: DatePeriodRange }[] {
  const yesterday = new Date(`${today}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const week = getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'week', date: today })!
  return [
    { label: 'Hari Ini', range: { start: today, end: today } },
    { label: 'Kemarin', range: { start: yesterday.toISOString().slice(0, 10), end: yesterday.toISOString().slice(0, 10) } },
    { label: 'Minggu Ini', range: { start: week.start, end: today } },
    { label: 'Bulan Ini', range: { start: `${today.slice(0, 7)}-01`, end: today } },
  ]
}
