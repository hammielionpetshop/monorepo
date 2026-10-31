// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ColumnDef } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataTable } from './data-table'

type Row = { id: number; name: string }
const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Nama' }]
const rows: Row[] = Array.from({ length: 35 }, (_, index) => ({
  id: index + 1,
  name: `Pelanggan ${index + 1}`,
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(data: Row[], resetPageKey?: string, persistKey?: string) {
  await act(async () => {
    root.render(React.createElement(DataTable<Row>, {
      data,
      columns,
      emptyMessage: 'Tidak ada data',
      resetPageKey,
      persistKey,
    }))
  })
}

async function nextPage() {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Next')!
  await act(async () => button.click())
}

describe('pagination DataTable setelah aksi', () => {
  it('tanpa kunci filter tetap di halaman 3 saat popup dirender ulang dan pembayaran diperbarui', async () => {
    await render(rows)
    await nextPage()
    await nextPage()
    await render([...rows])
    expect(container.textContent).toContain('Menampilkan 21-30 dari 35 data')

    const partialPayment = rows.map((row) => row.id === 21 ? { ...row, name: 'Pembayaran sebagian' } : row)
    await render(partialPayment)
    expect(container.textContent).toContain('Pembayaran sebagian')
    expect(container.textContent).toContain('Menampilkan 21-30 dari 35 data')

    await render(rows.filter((row) => row.id !== 21))
    expect(container.textContent).toContain('Menampilkan 21-30 dari 34 data')
  })

  it('berpindah ke halaman sebelumnya saat halaman terakhir kosong dan menangani seluruh data habis', async () => {
    await render(rows.slice(0, 21))
    await nextPage()
    await nextPage()
    expect(container.textContent).toContain('Menampilkan 21-21 dari 21 data')

    await render(rows.slice(0, 20))
    expect(container.textContent).toContain('Menampilkan 11-20 dari 20 data')

    await render([])
    expect(container.textContent).toContain('Menampilkan 0 dari 0 data')
    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true)
  })

  it('kembali ke halaman 1 hanya saat filter diterapkan berubah, termasuk jika jumlah hasil sama', async () => {
    await render(rows, 'semua')
    await nextPage()
    await nextPage()
    await render([...rows], 'semua')
    expect(container.textContent).toContain('Menampilkan 21-30 dari 35 data')

    await render([...rows], 'cabang-2')
    expect(container.textContent).toContain('Menampilkan 1-10 dari 35 data')
  })

  it('memulihkan halaman tersimpan dan menyimpan halaman yang tetap valid setelah aksi', async () => {
    sessionStorage.setItem('dataTablePageIndex:piutang', '2')
    await render(rows, 'belum-lunas', 'piutang')
    expect(container.textContent).toContain('Menampilkan 21-30 dari 35 data')

    await render(rows.filter((row) => row.id !== 21), 'belum-lunas', 'piutang')
    expect(sessionStorage.getItem('dataTablePageIndex:piutang')).toBe('2')

    await render(rows.slice(0, 20), 'belum-lunas', 'piutang')
    expect(sessionStorage.getItem('dataTablePageIndex:piutang')).toBe('1')
  })
})
