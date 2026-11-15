# 📘 MVP SPRINT 2 - MASTER DATA FOUNDATION

**Sprint Duration**: 2 weeks (Week 3-4)  
**Sprint Goal**: Master Data CRUD complete (Produk, Kategori, Cabang, User, Supplier, UOM, Multi-Harga)  
**Story Points**: 26 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 2, system harus bisa:
1. ✅ CRUD Kategori (1 level flat)
2. ✅ CRUD Cabang (Toko)
3. ✅ CRUD User & Role assignment
4. ✅ View 5 UOM Master (fixed, tidak bisa edit)
5. ✅ CRUD Produk dengan basic fields + photo upload
6. ✅ Multi-UOM setup per produk (5 UOM, conversion ratio)
7. ✅ CRUD Supplier

---

## 📋 USER STORIES

### **Story 2.1: CRUD Kategori (1 Level Flat)**

**As a** Manager Backoffice  
**I want to** manage kategori produk  
**So that** produk bisa dikelompokkan dengan baik

**Story Points**: 3

#### Acceptance Criteria
```
✅ Category list page accessible di `/backoffice/master/categories`
✅ Display kategori dalam table:
   - Nama Kategori
   - Status (Active/Inactive)
   - Action buttons (Edit, Delete)

✅ Create kategori:
   - Button "Tambah Kategori"
   - Form modal/page:
     * Nama Kategori (required)
     * Status (Active/Inactive, default: Active)
   - Save → Kategori created
   - Success message displayed

✅ Edit kategori:
   - Click "Edit" button
   - Form pre-filled dengan data existing
   - Update kategori
   - Success message displayed

✅ Delete kategori:
   - Click "Delete" button
   - Confirmation dialog: "Yakin hapus kategori [nama]?"
   - IF kategori punya produk → Error: "Tidak bisa hapus, masih ada produk"
   - IF kategori kosong → Delete success

✅ Validation:
   - Nama kategori required (min 2 chars)
   - Nama kategori unique (case-insensitive)
   - Cannot delete kategori with products

✅ Permission check:
   - Owner & Manager BO: Create, Edit, Delete
   - Manager Toko: View only
```

#### Technical Tasks
- [ ] Create `/app/backoffice/master/categories/page.tsx` (list page)
- [ ] Create CategoryList component
- [ ] Create CategoryForm component (for create & edit)
- [ ] Create API endpoints:
  - `GET /api/categories` (list all)
  - `POST /api/categories` (create)
  - `PUT /api/categories/:id` (update)
  - `DELETE /api/categories/:id` (delete)
- [ ] Implement validation (server-side & client-side)
- [ ] Add loading states & error handling
- [ ] Test CRUD operations
- [ ] Test delete validation (kategori dengan produk)

#### Component Example
```tsx
// app/backoffice/master/categories/page.tsx
'use client'
import { useState, useEffect } from 'react'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    const res = await fetch('/api/categories')
    const data = await res.json()
    setCategories(data)
    setLoading(false)
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Yakin hapus kategori "${name}"?`)) return

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      
      if (!res.ok) {
        const error = await res.json()
        alert(error.message)
        return
      }

      alert('Kategori berhasil dihapus')
      fetchCategories()
    } catch (error) {
      alert('Gagal menghapus kategori')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Master Kategori</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Tambah Kategori
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full bg-white shadow rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Nama Kategori</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.category_id} className="border-t">
                <td className="p-3">{cat.category_name}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    cat.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                  }`}>
                    {cat.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button
                    onClick={() => {
                      setEditingCategory(cat)
                      setShowForm(true)
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cat.category_id, cat.category_name)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => {
            setShowForm(false)
            setEditingCategory(null)
          }}
          onSuccess={() => {
            fetchCategories()
            setShowForm(false)
            setEditingCategory(null)
          }}
        />
      )}
    </div>
  )
}
```

#### API Example
```typescript
// app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET all categories
export async function GET() {
  const categories = await prisma.categories.findMany({
    orderBy: { category_name: 'asc' }
  })
  return NextResponse.json(categories)
}

// POST create category
export async function POST(req: NextRequest) {
  try {
    const { category_name, status } = await req.json()

    // Validation
    if (!category_name || category_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nama kategori minimal 2 karakter' },
        { status: 400 }
      )
    }

    // Check duplicate (case-insensitive)
    const existing = await prisma.categories.findFirst({
      where: {
        category_name: {
          equals: category_name.trim(),
          mode: 'insensitive'
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Nama kategori sudah ada' },
        { status: 400 }
      )
    }

    const category = await prisma.categories.create({
      data: {
        category_name: category_name.trim(),
        status: status || 'active'
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// app/api/categories/[id]/route.ts
// DELETE category
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const categoryId = parseInt(params.id)

  // Check if category has products
  const productCount = await prisma.products.count({
    where: { category_id: categoryId }
  })

  if (productCount > 0) {
    return NextResponse.json(
      { error: `Tidak bisa hapus kategori. Masih ada ${productCount} produk di kategori ini.` },
      { status: 400 }
    )
  }

  await prisma.categories.delete({
    where: { category_id: categoryId }
  })

  return NextResponse.json({ success: true })
}
```

#### PRD Reference
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.1.3 Category Management

---

### **Story 2.2: CRUD Cabang (Toko)**

**As a** Owner  
**I want to** manage cabang/toko  
**So that** system bisa support multi-cabang

**Story Points**: 3

#### Acceptance Criteria
```
✅ Branch list page accessible di `/backoffice/master/branches`
✅ Display cabang dalam table:
   - Nama Cabang
   - Kode Cabang (SDM, KLP, GTS)
   - Alamat
   - Phone
   - Manager
   - Status
   - Action buttons

✅ Create cabang:
   - Form fields:
     * Nama Cabang (required)
     * Kode Cabang (required, 3-10 chars, uppercase auto)
     * Alamat (optional)
     * Phone (optional)
     * Manager (dropdown dari users dengan role Manager Toko)
     * Status (Active/Inactive)

✅ Edit & Delete cabang working
✅ Validation:
   - Kode cabang unique
   - Nama cabang required
```

#### Technical Tasks
- [ ] Create branches list page
- [ ] Create BranchForm component
- [ ] Create API endpoints (GET, POST, PUT, DELETE)
- [ ] Fetch users untuk manager dropdown
- [ ] Implement validation
- [ ] Test CRUD operations

#### PRD Reference
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.3 Branch Management

---

### **Story 2.3: CRUD User & Role**

**As an** Owner  
**I want to** manage users & assign roles  
**So that** karyawan bisa akses sistem sesuai role mereka

**Story Points**: 5

#### Acceptance Criteria
```
✅ User list page accessible di `/backoffice/master/users`
✅ Display users dalam table:
   - Name
   - Email
   - Role
   - Branch (jika applicable)
   - Status
   - Action buttons

✅ Create user:
   - Form fields:
     * Name (required)
     * Email (required, email format, unique)
     * Password (required, min 6 chars)
     * Confirm Password (must match)
     * Role (dropdown):
       - Owner
       - Manager Backoffice
       - Manager Toko
       - Kasir
       - Gudang
     * Branch (dropdown, required untuk Manager Toko/Kasir/Gudang)
     * Status (Active/Inactive)

✅ Edit user:
   - Cannot edit password (separate feature untuk change password)
   - Can change role, branch, status
   - Email cannot be changed (primary identifier)

✅ Delete user:
   - Confirmation required
   - Cannot delete if user punya transactions
   - Cannot delete self (logged-in user)

✅ Password hashing:
   - Password hashed dengan bcrypt
   - Never store plain password

✅ Validation:
   - Email unique
   - Password min 6 chars
   - Branch required untuk Manager Toko/Kasir/Gudang
   - Branch optional untuk Owner/Manager BO
```

#### Technical Tasks
- [ ] Create users list page
- [ ] Create UserForm component
- [ ] Implement password hashing (bcryptjs)
- [ ] Create API endpoints
- [ ] Implement role-based branch requirement validation
- [ ] Test CRUD operations
- [ ] Test cannot delete user with transactions

#### Security Notes
```typescript
// Password hashing
import bcrypt from 'bcryptjs'

const hashedPassword = await bcrypt.hash(password, 10)

// Validation example
const requiresBranch = ['Manager_Toko', 'Kasir', 'Gudang']
if (requiresBranch.includes(role) && !branch_id) {
  throw new Error('Branch required untuk role ini')
}
```

#### PRD Reference
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.2.3 User Management

---

### **Story 2.4: Master UOM (5 UOM Fixed)**

**As a** Manager Backoffice  
**I want to** view 5 UOM master  
**So that** saya tahu UOM mana yang available untuk produk

**Story Points**: 2

#### Acceptance Criteria
```
✅ UOM list page accessible di `/backoffice/master/uoms`
✅ Display 5 UOM fixed:
   1. Pcs (pieces - unit terkecil)
   2. Sak (karung)
   3. Dus (box besar)
   4. Box (box sedang)
   5. Pack (kemasan)

✅ View only (tidak bisa create, edit, delete)
✅ Display informasi:
   - UOM Name
   - Description
   - Note: "UOM ini fixed, tidak bisa ditambah atau dihapus"
```

#### Technical Tasks
- [ ] Create UOM master seed data (di Sprint 1.2 atau di sini)
- [ ] Create UOM list page (view only)
- [ ] No API POST/PUT/DELETE needed

#### Seed Data
```typescript
// prisma/seed.ts (update)
const uoms = [
  { name: 'Pcs', description: 'Pieces - unit terkecil' },
  { name: 'Sak', description: 'Karung' },
  { name: 'Dus', description: 'Box besar' },
  { name: 'Box', description: 'Box sedang' },
  { name: 'Pack', description: 'Kemasan' }
]

for (const uom of uoms) {
  await prisma.uom_master.upsert({
    where: { name: uom.name },
    update: {},
    create: uom
  })
}
```

#### PRD Reference
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.1.4 UOM Management

---

### **Story 2.5: CRUD Produk (Basic Fields)**

**As a** Manager Backoffice  
**I want to** manage produk  
**So that** produk bisa dijual di POS

**Story Points**: 8

#### Acceptance Criteria
```
✅ Product list page accessible di `/backoffice/master/products`
✅ Display products dalam table dengan pagination:
   - Photo (thumbnail)
   - SKU (auto-generated)
   - Barcode
   - Nama Produk
   - Kategori
   - Brand
   - Status
   - Action buttons

✅ Search & Filter:
   - Search by nama produk, SKU, barcode
   - Filter by kategori
   - Filter by status

✅ Create product:
   - Form fields:
     * SKU (auto-generated, format: PRD-YYYYMMDD-XXX)
     * Barcode (required, unique, manual input)
     * Nama Produk (required)
     * Kategori (dropdown)
     * Brand (text input)
     * Berat (gram, required, numeric)
     * Has Expiry? (checkbox)
     * Photo Upload (1 photo, jpg/png, max 2MB)
     * Status (Active/Inactive)

✅ Photo upload:
   - Upload to /public/uploads/products/
   - File validation (type, size)
   - Preview before upload
   - Default placeholder if no photo

✅ Edit product:
   - All fields editable except SKU
   - Can replace photo
   - Can delete photo (revert to placeholder)

✅ Delete product:
   - Cannot delete if product punya stock
   - Cannot delete if product punya transactions
   - Confirmation required

✅ Validation:
   - Barcode unique
   - Nama produk required (min 3 chars)
   - Berat must be positive number
   - Photo format validation (jpg, jpeg, png only)
   - Photo size max 2MB
```

#### Technical Tasks
- [ ] Create products list page dengan pagination
- [ ] Create ProductForm component
- [ ] Implement SKU auto-generation (PRD-YYYYMMDD-XXX)
- [ ] Implement photo upload:
  - Client-side: FormData upload
  - Server-side: File handling, save to /public/uploads/products/
  - Image optimization (optional, using sharp)
- [ ] Create API endpoints (GET, POST, PUT, DELETE)
- [ ] Implement search & filter
- [ ] Test CRUD operations
- [ ] Test delete validation (product dengan stock/transactions)

#### SKU Auto-Generation
```typescript
// lib/utils/generateSKU.ts
export async function generateSKU(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD
  
  // Find last SKU for today
  const lastProduct = await prisma.products.findFirst({
    where: {
      sku: {
        startsWith: `PRD-${dateStr}`
      }
    },
    orderBy: { sku: 'desc' }
  })

  let sequence = 1
  if (lastProduct) {
    const lastSeq = parseInt(lastProduct.sku.split('-')[2])
    sequence = lastSeq + 1
  }

  return `PRD-${dateStr}-${sequence.toString().padStart(3, '0')}`
}

// Example: PRD-20260418-001, PRD-20260418-002, ...
```

#### Photo Upload Implementation
```typescript
// app/api/products/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('photo') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG and PNG allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Max 2MB.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const ext = path.extname(file.name)
    const filename = `product-${timestamp}${ext}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save to public/uploads/products/
    const uploadDir = path.join(process.cwd(), 'public/uploads/products')
    const filepath = path.join(uploadDir, filename)
    
    await writeFile(filepath, buffer)

    // Return URL
    const url = `/uploads/products/${filename}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.1.1 Product Master

---

### **Story 2.6: Multi-UOM per Produk**

**As a** Manager Backoffice  
**I want to** setup UOM per produk dengan conversion ratio  
**So that** produk bisa dijual dalam berbagai satuan (Sak, Pcs, dll)

**Story Points**: 5

#### Acceptance Criteria
```
✅ Product detail page include UOM section
✅ Display UOM list untuk produk:
   - UOM Name
   - Conversion to Pcs
   - Is Base UOM? (Pcs always base)
   - Action (Edit, Delete)

✅ Add UOM to product:
   - Select UOM (dari 5 UOM master, yang belum ada)
   - Input conversion ratio (numeric, > 0)
   - Example: 1 Sak = 30 Pcs
   - Mark as base UOM (only Pcs can be base)

✅ Edit UOM conversion:
   - Update conversion ratio
   - Cannot change UOM name (delete & re-add instead)

✅ Delete UOM:
   - Cannot delete base UOM (Pcs)
   - Cannot delete if UOM punya pricing
   - Confirmation required

✅ Auto-break logic validation:
   - Setiap produk HARUS punya Pcs (base UOM)
   - Conversion to Pcs must be defined untuk semua UOM
   - Example conversions:
     * 1 Pcs = 1 Pcs (base)
     * 1 Sak = 30 Pcs
     * 1 Dus = 12 Box
     * 1 Box = 6 Pack
     * 1 Pack = 10 Pcs

✅ Validation:
   - Produk harus punya minimal 1 UOM (Pcs)
   - Conversion ratio must be positive number
   - Cannot have duplicate UOM untuk 1 produk
```

#### Technical Tasks
- [ ] Create ProductUOMList component (di product detail page)
- [ ] Create ProductUOMForm component
- [ ] Create API endpoints:
  - `POST /api/products/:id/uoms` (add UOM)
  - `PUT /api/products/:id/uoms/:uom_id` (update)
  - `DELETE /api/products/:id/uoms/:uom_id` (delete)
- [ ] Implement validation
- [ ] Auto-create Pcs UOM saat create product
- [ ] Test UOM operations

#### Component Example
```tsx
// components/backoffice/ProductUOMList.tsx
export default function ProductUOMList({ productId }: { productId: number }) {
  const [uoms, setUoms] = useState([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchUOMs()
  }, [productId])

  const fetchUOMs = async () => {
    const res = await fetch(`/api/products/${productId}/uoms`)
    const data = await res.json()
    setUoms(data)
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Unit of Measure (UOM)</h3>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          + Tambah UOM
        </button>
      </div>

      <table className="w-full bg-white border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">UOM</th>
            <th className="p-2 text-left">Conversion to Pcs</th>
            <th className="p-2 text-left">Base UOM?</th>
            <th className="p-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {uoms.map((uom) => (
            <tr key={uom.id} className="border-t">
              <td className="p-2">{uom.uom_name}</td>
              <td className="p-2">
                {uom.is_base_uom ? '1 Pcs' : `1 ${uom.uom_name} = ${uom.conversion_to_pcs} Pcs`}
              </td>
              <td className="p-2">
                {uom.is_base_uom ? '✅ Yes' : 'No'}
              </td>
              <td className="p-2 text-right">
                {!uom.is_base_uom && (
                  <>
                    <button className="text-blue-600 hover:underline mr-2">Edit</button>
                    <button className="text-red-600 hover:underline">Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <ProductUOMFormModal
          productId={productId}
          existingUOMs={uoms.map(u => u.uom_name)}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            fetchUOMs()
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}
```

#### API Example
```typescript
// app/api/products/[id]/uoms/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    const { uom_name, conversion_to_pcs } = await req.json()

    // Validation
    if (conversion_to_pcs <= 0) {
      return NextResponse.json(
        { error: 'Conversion ratio must be positive' },
        { status: 400 }
      )
    }

    // Check duplicate
    const existing = await prisma.product_uoms.findFirst({
      where: {
        product_id: productId,
        uom_name
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'UOM already exists for this product' },
        { status: 400 }
      )
    }

    const uom = await prisma.product_uoms.create({
      data: {
        product_id: productId,
        uom_name,
        conversion_to_pcs,
        is_base_uom: uom_name === 'Pcs'
      }
    })

    return NextResponse.json(uom, { status: 201 })
  } catch (error) {
    console.error('Add UOM error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Auto-Create Pcs UOM
```typescript
// When creating product, auto-create Pcs UOM
const product = await prisma.products.create({
  data: { /* product fields */ }
})

// Auto-create Pcs as base UOM
await prisma.product_uoms.create({
  data: {
    product_id: product.product_id,
    uom_name: 'Pcs',
    conversion_to_pcs: 1,
    is_base_uom: true
  }
})
```

#### PRD Reference
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.1.2 Multi-UOM Configuration
- **POS_PRD.md** Section 5.1.3 Auto-Break Logic

---

### **Story 2.7: CRUD Supplier**

**As a** Manager Backoffice  
**I want to** manage supplier  
**So that** saya bisa buat PO ke supplier

**Story Points**: 3 (moved from original plan, simple CRUD)

#### Acceptance Criteria
```
✅ Supplier list page accessible di `/backoffice/master/suppliers`
✅ Display suppliers dalam table:
   - Nama Supplier
   - Contact Person
   - Phone
   - Payment Term (COD/NET 7/NET 14/NET 30)
   - Status
   - Action buttons

✅ Create supplier:
   - Form fields:
     * Nama Supplier (required)
     * Contact Person (required)
     * Phone (required, numeric)
     * Address (optional, textarea)
     * Payment Term (dropdown: COD, NET 7, NET 14, NET 30)
     * Status (Active/Inactive)

✅ Edit & Delete supplier working
✅ Validation:
   - Nama supplier required
   - Phone numeric only
```

#### Technical Tasks
- [ ] Create suppliers list page
- [ ] Create SupplierForm component
- [ ] Create API endpoints
- [ ] Test CRUD operations

#### PRD Reference
- **BACKOFFICE_PRD_4_PURCHASING.md** Section 3.3 Supplier Management

---

## 📊 SPRINT 2 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 2.1 CRUD Kategori | 3 | Dev 1 |
| 2.2 CRUD Cabang | 3 | Dev 1 |
| 2.3 CRUD User & Role | 5 | Dev 2 |
| 2.4 Master UOM | 2 | Dev 1 |
| 2.5 CRUD Produk | 8 | Dev 1 + Dev 2 |
| 2.6 Multi-UOM per Produk | 5 | Dev 2 |
| 2.7 CRUD Supplier | 3 (bonus) | Dev 1 |
| **TOTAL** | **26 (29)** | |

**Note:** Story 2.7 (Supplier) bisa dikerjakan jika Sprint 2 ahead of schedule, atau pindah ke Sprint 3.

### Definition of Done
```
✅ All CRUD operations working
✅ Validations implemented (client & server)
✅ Permission checks working
✅ Photo upload working (untuk produk)
✅ SKU auto-generation working
✅ Multi-UOM setup working
✅ Code reviewed & merged
✅ Manual testing completed
✅ No critical bugs
```

### Sprint Deliverables
1. ✅ Master Kategori complete
2. ✅ Master Cabang complete
3. ✅ Master User & Role complete
4. ✅ Master UOM view-only
5. ✅ Master Produk complete (CRUD + photo upload + SKU auto)
6. ✅ Multi-UOM per produk working
7. ✅ Master Supplier complete (bonus)

---

## 🧪 TESTING CHECKLIST

### Functional Testing
- [ ] Create kategori → Success
- [ ] Delete kategori dengan produk → Error message
- [ ] Create user dengan role Kasir tanpa branch → Error
- [ ] Upload photo > 2MB → Error
- [ ] Upload photo non-JPG/PNG → Error
- [ ] Create produk → SKU auto-generated (PRD-YYYYMMDD-XXX)
- [ ] Add UOM "Sak" dengan conversion 30 → Success
- [ ] Delete base UOM (Pcs) → Error
- [ ] Create duplicate barcode → Error

### Permission Testing
- [ ] Login as Manager Toko → Cannot delete kategori
- [ ] Login as Manager BO → Can create/edit master data
- [ ] Login as Owner → Can delete master data

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Photo upload fails in production | MEDIUM | Test upload in staging, add error handling |
| SKU generation conflicts (concurrent requests) | LOW | Use database transaction, add unique constraint |
| UOM conversion logic complex | MEDIUM | Thorough testing dengan multiple scenarios |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 3 Dependencies:**
- Master data dari Sprint 2 harus complete
- Multi-UOM & conversion ratio dari Sprint 2 akan digunakan di Sprint 3 (Multi-Harga)
- Products dari Sprint 2 akan digunakan di Sprint 3 (Inventory)

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_1_FOUNDATION.md  
**Next Sprint**: MVP_SPRINT_3_MULTI_HARGA_INVENTORY.md
