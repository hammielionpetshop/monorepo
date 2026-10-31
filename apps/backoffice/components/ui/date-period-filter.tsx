'use client'

import React, { useId } from 'react'
import { formatWIB } from '@petshop/shared'
import { datePeriodPresets, getDatePeriodRange, type DatePeriodSelection } from '@/lib/date-period'

interface Props {
  value: DatePeriodSelection
  onChange: (value: DatePeriodSelection) => void
  today: string
}

const fieldClass = 'w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

export function DatePeriodFilter({ value, onChange, today }: Props) {
  const id = useId()
  const range = getDatePeriodRange(value)
  const displayDate = (day: string) => formatWIB(`${day}T00:00:00+07:00`, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {datePeriodPresets(today).map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange({ ...value, mode: 'range', ...preset.range })}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-muted/40 hover:bg-accent"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label htmlFor={`${id}-mode`} className={labelClass}>Periode</label>
          <select
            id={`${id}-mode`}
            value={value.mode}
            onChange={e => onChange({ ...value, mode: e.target.value as DatePeriodSelection['mode'], date: value.date || today, month: value.month || today.slice(0, 7) })}
            className={fieldClass}
          >
            <option value="all">Semua Tanggal</option>
            <option value="day">Harian</option>
            <option value="week">Mingguan (Senin–Minggu)</option>
            <option value="month">Bulanan</option>
            <option value="range">Rentang Tanggal</option>
          </select>
        </div>
        {(value.mode === 'day' || value.mode === 'week') && (
          <div>
            <label htmlFor={`${id}-date`} className={labelClass}>{value.mode === 'week' ? 'Pilih tanggal dalam minggu' : 'Tanggal'}</label>
            <input id={`${id}-date`} type="date" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} className={fieldClass} />
          </div>
        )}
        {value.mode === 'month' && (
          <div>
            <label htmlFor={`${id}-month`} className={labelClass}>Bulan dan Tahun</label>
            <input id={`${id}-month`} type="month" value={value.month} onChange={e => onChange({ ...value, month: e.target.value })} className={fieldClass} />
          </div>
        )}
        {value.mode === 'range' && (
          <>
            <div>
              <label htmlFor={`${id}-start`} className={labelClass}>Dari Tanggal</label>
              <input id={`${id}-start`} type="date" value={value.start} max={value.end || undefined} onChange={e => onChange({ ...value, start: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`${id}-end`} className={labelClass}>Sampai Tanggal</label>
              <input id={`${id}-end`} type="date" value={value.end} min={value.start || undefined} onChange={e => onChange({ ...value, end: e.target.value })} className={fieldClass} />
            </div>
          </>
        )}
      </div>
      {!range ? (
        <p role="alert" className="text-xs text-destructive">Lengkapi tanggal yang valid. Tanggal awal tidak boleh melewati tanggal akhir.</p>
      ) : value.mode !== 'all' && (range.start || range.end) ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          Periode WIB: {range.start ? displayDate(range.start) : 'Awal data'} – {range.end ? displayDate(range.end) : 'Akhir data'} (termasuk tanggal akhir).
        </p>
      ) : null}
    </div>
  )
}
