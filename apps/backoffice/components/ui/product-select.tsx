'use client'

import { useState, useRef, useEffect, useId } from 'react'

export interface ProductOption {
  id: number
  name: string
  sku?: string | null
  currentQty?: string | number | null
}

interface ProductSelectProps {
  products: ProductOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  showStock?: boolean
  className?: string
}

export function ProductSelect({
  products,
  value,
  onChange,
  placeholder = '-- Pilih produk --',
  disabled = false,
  loading = false,
  showStock = false,
  className = '',
}: ProductSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const selected = products.find((p) => String(p.id) === value) ?? null

  const filtered = query.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.sku ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : products

  // Close on outside click
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

  function handleSelect(product: ProductOption) {
    onChange(String(product.id))
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!open) setOpen(true)
    if (e.target.value === '') onChange('')
  }

  function handleFocus() {
    setOpen(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  const displayValue = open ? query : (selected ? selected.name : '')

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center border rounded-md bg-background transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed border-input' : 'border-input focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent'}`}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={loading ? 'Memuat produk...' : placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="w-full px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {/* Clear button */}
        {selected && !open && !disabled && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery('') }}
            className="pr-2 text-muted-foreground hover:text-foreground shrink-0"
            tabIndex={-1}
            aria-label="Hapus pilihan"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}

        {/* Chevron */}
        <span className="pr-2 text-muted-foreground shrink-0 pointer-events-none">
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>

      {open && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md text-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground text-center">
              Produk tidak ditemukan
            </li>
          ) : (
            filtered.map((p) => {
              const isSelected = String(p.id) === value
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    handleSelect(p)
                  }}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer
                    ${isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  <span>
                    <span>{p.name}</span>
                    {p.sku && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{p.sku}</span>
                    )}
                  </span>
                  {showStock && p.currentQty != null && (
                    <span className="ml-3 text-xs text-muted-foreground shrink-0">
                      Stok: {p.currentQty}
                    </span>
                  )}
                  {isSelected && (
                    <svg className="ml-2 w-4 h-4 shrink-0 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
