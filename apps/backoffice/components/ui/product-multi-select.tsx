'use client'

import { useState, useRef, useEffect, useId } from 'react'
import type { ProductOption } from './product-select'

interface ProductMultiSelectProps {
  products: ProductOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ProductMultiSelect({
  products,
  value,
  onChange,
  placeholder = '-- Pilih produk --',
  disabled = false,
  className = '',
}: ProductMultiSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const selectedSet = new Set(value)
  const byId = new Map(products.map((p) => [String(p.id), p]))
  const selected = value.map((id) => byId.get(id)).filter((p): p is ProductOption => !!p)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? products.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
      )
    : products

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        className={`flex flex-wrap items-center gap-1 border rounded-md bg-background px-1.5 py-1 min-h-[38px] transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed border-input' : 'border-input focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent'}`}
      >
        {selected.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 max-w-full rounded bg-primary/10 text-primary text-xs font-medium pl-2 pr-1 py-0.5"
          >
            <span className="truncate">{p.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(String(p.id)) }}
              className="shrink-0 rounded hover:bg-primary/20"
              tabIndex={-1}
              aria-label={`Hapus ${p.name}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selected.length === 0 ? placeholder : 'Tambah produk...'}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="flex-1 min-w-[8rem] px-1.5 py-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {selected.length > 0 && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange([]) }}
            className="px-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
            tabIndex={-1}
          >
            Hapus semua
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md text-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground text-center">Produk tidak ditemukan</li>
          ) : (
            filtered.map((p) => {
              const id = String(p.id)
              const isSelected = selectedSet.has(id)
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    toggle(id)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer
                    ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent hover:text-accent-foreground'}`}
                >
                  <span
                    className={`flex items-center justify-center w-4 h-4 shrink-0 rounded border
                      ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span>
                    <span>{p.name}</span>
                    {p.sku && <span className="ml-1.5 text-xs text-muted-foreground">{p.sku}</span>}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
