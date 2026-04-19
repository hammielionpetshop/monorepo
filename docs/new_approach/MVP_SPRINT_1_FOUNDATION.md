# 📘 MVP SPRINT 1 - FOUNDATION & AUTHENTICATION

**Sprint Duration**: 2 weeks (Week 1-2)  
**Sprint Goal**: Setup project foundation + Login working di POS & Backoffice  
**Story Points**: 25 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 1, system harus bisa:
1. ✅ User login di POS (email + password)
2. ✅ User login di Backoffice (email + password)
3. ✅ 4 roles working dengan permission basic
4. ✅ Database schema foundation ready (15-20 tables)
5. ✅ Project structure & routing setup

---

## 📋 USER STORIES

### **Story 1.1: Setup Project Structure**

**As a** Developer  
**I want to** setup Next.js 15 project dengan proper structure  
**So that** development bisa dimulai dengan foundation yang solid

**Story Points**: 3

#### Acceptance Criteria
```
✅ Next.js 15 installed dengan App Router
✅ Project structure:
   /app
     /pos         (POS routes)
     /backoffice  (Backoffice routes)
     /api         (API routes)
   /components
     /pos         (POS components)
     /backoffice  (BO components)
     /shared      (Shared components)
   /lib
     /db          (Database utilities)
     /auth        (Authentication utilities)
   /types         (TypeScript types)

✅ TypeScript configured
✅ Tailwind CSS installed & configured
✅ ESLint & Prettier configured
✅ Git repository initialized
✅ Environment variables (.env.local) setup:
   - DATABASE_URL
   - JWT_SECRET
   - NEXT_PUBLIC_API_URL
```

#### Technical Tasks
- [ ] `npx create-next-app@latest` dengan TypeScript
- [ ] Setup folder structure
- [ ] Install dependencies: `prisma`, `bcryptjs`, `jsonwebtoken`, `zod`
- [ ] Configure Tailwind CSS
- [ ] Setup ESLint & Prettier
- [ ] Create `.env.local` template
- [ ] Initialize Git repository
- [ ] Create README.md dengan setup instructions

#### PRD Reference
- Not applicable (technical setup)

---

### **Story 1.2: Database Schema Design**

**As a** Developer  
**I want to** design & create database schema untuk MVP  
**So that** semua tables ready untuk development

**Story Points**: 5

#### Acceptance Criteria
```
✅ PostgreSQL database created
✅ Prisma ORM configured
✅ 20+ tables created dengan relationships:
   Core Tables (8):
   - users
   - branches
   - categories
   - products
   - product_uoms
   - product_pricing
   - suppliers
   - customers

   Transaction Tables (6):
   - shifts
   - transactions
   - transaction_items
   - settlements
   - settlement_kasir_breakdown
   - daily_expenses

   Inventory Tables (5):
   - inventory_stock
   - inventory_batches (FIFO)
   - stock_opname_headers
   - stock_opname_details
   - damaged_goods

   Purchasing Tables (4):
   - purchase_orders
   - purchase_order_items
   - supplier_payables
   - supplier_payments

   Operational Tables (1):
   - delivery_orders

✅ Seed data inserted:
   - 1 Owner user
   - 3 branches (Sudirman, Kelapa, Gatsu)
   - 5 UOM master (Pcs, Sak, Dus, Box, Pack)
   - 3 categories (Makanan, Obat, Aksesoris)
   - 10 sample products

✅ Database migrations working
✅ Prisma Client generated
```

#### Database Schema Detail

**users table:**
```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- Owner/Manager_BO/Manager_Toko/Kasir/Gudang
  branch_id INT REFERENCES branches(branch_id),
  status VARCHAR(20) DEFAULT 'active', -- active/inactive
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**branches table:**
```sql
CREATE TABLE branches (
  branch_id SERIAL PRIMARY KEY,
  branch_name VARCHAR(200) NOT NULL,
  branch_code VARCHAR(10) UNIQUE NOT NULL, -- SDM, KLP, GTS
  address TEXT,
  phone VARCHAR(20),
  manager_id INT REFERENCES users(user_id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**categories table:**
```sql
CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**products table:**
```sql
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(50) UNIQUE,
  product_name VARCHAR(200) NOT NULL,
  category_id INT REFERENCES categories(category_id),
  brand VARCHAR(100),
  weight_grams INT, -- Berat dalam gram
  has_expiry BOOLEAN DEFAULT false,
  photo_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
```

**product_uoms table:**
```sql
CREATE TABLE product_uoms (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  uom_name VARCHAR(20) NOT NULL, -- Pcs/Sak/Dus/Box/Pack
  conversion_to_pcs DECIMAL(10,2) NOT NULL, -- 1 Sak = 30 Pcs
  is_base_uom BOOLEAN DEFAULT false, -- TRUE untuk Pcs
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, uom_name)
);

CREATE INDEX idx_product_uoms_product ON product_uoms(product_id);
```

**product_pricing table:**
```sql
CREATE TABLE product_pricing (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  uom_id INT NOT NULL REFERENCES product_uoms(id) ON DELETE CASCADE,
  tier_name VARCHAR(20) NOT NULL, -- Retail/Grosir/Member/Owner_Manual
  price DECIMAL(15,2), -- NULL untuk Owner_Manual (input di POS)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, uom_id, tier_name)
);

CREATE INDEX idx_pricing_product_uom ON product_pricing(product_id, uom_id);
```

**inventory_batches table (FIFO):**
```sql
CREATE TABLE inventory_batches (
  batch_id SERIAL PRIMARY KEY,
  batch_number VARCHAR(50) UNIQUE NOT NULL,
  product_id INT NOT NULL REFERENCES products(product_id),
  uom_id INT NOT NULL REFERENCES product_uoms(id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  qty_in DECIMAL(15,2) NOT NULL, -- Qty masuk saat PO received
  qty_balance DECIMAL(15,2) NOT NULL, -- Qty tersisa
  cogs_per_unit DECIMAL(15,2) NOT NULL, -- COGS per unit
  received_date DATE NOT NULL,
  parent_batch_id INT REFERENCES inventory_batches(batch_id), -- For auto-break
  po_id INT REFERENCES purchase_orders(po_id),
  status VARCHAR(20) DEFAULT 'active', -- active/depleted
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_batches_product_branch ON inventory_batches(product_id, branch_id);
CREATE INDEX idx_batches_received_date ON inventory_batches(received_date);
CREATE INDEX idx_batches_status ON inventory_batches(status);
```

**shifts table:**
```sql
CREATE TABLE shifts (
  shift_id SERIAL PRIMARY KEY,
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  shift_date DATE NOT NULL,
  opened_by INT NOT NULL REFERENCES users(user_id),
  opened_at TIMESTAMP NOT NULL,
  closed_by INT REFERENCES users(user_id),
  closed_at TIMESTAMP,
  modal_awal DECIMAL(15,2) DEFAULT 200000, -- Rp 200k
  status VARCHAR(20) DEFAULT 'open', -- open/closed
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shifts_branch_date ON shifts(branch_id, shift_date);
CREATE INDEX idx_shifts_status ON shifts(status);
```

**transactions table:**
```sql
CREATE TABLE transactions (
  transaction_id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  shift_id INT NOT NULL REFERENCES shifts(shift_id),
  kasir_id INT NOT NULL REFERENCES users(user_id),
  customer_id INT REFERENCES customers(customer_id),
  transaction_date TIMESTAMP DEFAULT NOW(),
  gross_amount DECIMAL(15,2) NOT NULL,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL, -- gross - discount
  total_cogs DECIMAL(15,2) NOT NULL, -- FIFO COGS
  payment_method VARCHAR(20) NOT NULL, -- cash/qris
  payment_amount DECIMAL(15,2) NOT NULL,
  change_amount DECIMAL(15,2) DEFAULT 0,
  total_weight_kg DECIMAL(10,2), -- Total berat pesanan
  status VARCHAR(20) DEFAULT 'completed', -- pending/completed/void
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_branch_date ON transactions(branch_id, transaction_date);
CREATE INDEX idx_transactions_kasir ON transactions(kasir_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

**settlements table:**
```sql
CREATE TABLE settlements (
  settlement_id SERIAL PRIMARY KEY,
  shift_id INT NOT NULL REFERENCES shifts(shift_id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  settlement_date TIMESTAMP DEFAULT NOW(),
  modal_awal DECIMAL(15,2) NOT NULL,
  total_sales_cash DECIMAL(15,2) NOT NULL,
  total_sales_noncash DECIMAL(15,2) NOT NULL,
  total_daily_expenses DECIMAL(15,2) NOT NULL,
  expected_cash DECIMAL(15,2) NOT NULL, -- modal + sales_cash - expenses
  real_cash DECIMAL(15,2) NOT NULL,
  variance DECIMAL(15,2) NOT NULL, -- real - expected
  settled_by INT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_settlements_shift ON settlements(shift_id);
```

**settlement_kasir_breakdown table:**
```sql
CREATE TABLE settlement_kasir_breakdown (
  id SERIAL PRIMARY KEY,
  settlement_id INT NOT NULL REFERENCES settlements(settlement_id) ON DELETE CASCADE,
  kasir_id INT NOT NULL REFERENCES users(user_id),
  sales_cash DECIMAL(15,2) NOT NULL,
  sales_noncash DECIMAL(15,2) NOT NULL,
  daily_expenses DECIMAL(15,2) NOT NULL,
  expected_cash DECIMAL(15,2) NOT NULL,
  real_cash DECIMAL(15,2) NOT NULL,
  variance DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_settlement_breakdown_settlement ON settlement_kasir_breakdown(settlement_id);
```

#### Technical Tasks
- [ ] Create Prisma schema file (`prisma/schema.prisma`)
- [ ] Define all 24 tables dengan relationships
- [ ] Define indexes untuk performance
- [ ] Run `npx prisma migrate dev` untuk create migrations
- [ ] Create seed script (`prisma/seed.ts`) untuk initial data
- [ ] Run seed: `npx prisma db seed`
- [ ] Generate Prisma Client: `npx prisma generate`
- [ ] Test database connection
- [ ] Document database schema di README

#### PRD Reference
- **All PRD parts** (database schema mentioned in each part)
- Primary: `BACKOFFICE_PRD_1_FOUNDATION.md` Section 3.4

---

### **Story 1.3: POS Login User**

**As a** Kasir  
**I want to** login ke POS dengan email & password  
**So that** saya bisa mulai checkout customer

**Story Points**: 5

#### Acceptance Criteria
```
✅ POS login page accessible di `/pos/login`
✅ Login form:
   - Email field (required, email validation)
   - Password field (required, min 6 chars)
   - "Login" button
   - Error message display

✅ Login flow:
   1. User input email + password
   2. Click "Login"
   3. System validate credentials
   4. IF valid:
      - Create JWT token (30 min expiry)
      - Redirect to POS dashboard
   5. IF invalid:
      - Show error: "Email atau password salah"

✅ Session management:
   - JWT token stored in httpOnly cookie
   - Auto-logout after 30 min idle
   - Logout button working

✅ Role validation:
   - Only Kasir, Manager, Owner bisa login ke POS
   - Gudang/Manager BO tidak bisa akses POS

✅ Protected routes:
   - All POS routes (except /pos/login) require authentication
   - Redirect to login jika belum login
```

#### Technical Tasks
- [ ] Create `/app/pos/login/page.tsx` (login page)
- [ ] Create login form component
- [ ] Create `/app/api/auth/login/route.ts` (login API)
- [ ] Implement password hashing verification (bcryptjs)
- [ ] Implement JWT token generation (jsonwebtoken)
- [ ] Create authentication middleware untuk protected routes
- [ ] Implement auto-logout on idle (30 min)
- [ ] Create logout API endpoint
- [ ] Handle error states (invalid credentials, network error)
- [ ] Add loading states
- [ ] Test dengan seed users

#### Component Structure
```tsx
// app/pos/login/page.tsx
export default function POSLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-600">
      <LoginForm />
    </div>
  )
}

// components/pos/LoginForm.tsx
export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, system: 'pos' })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Login failed')
      }

      // Redirect ke POS dashboard
      window.location.href = '/pos'
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-lg w-96">
      <h1 className="text-2xl font-bold mb-6">POS Login</h1>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Loading...' : 'Login'}
      </button>
    </form>
  )
}
```

#### API Implementation
```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function POST(req: NextRequest) {
  try {
    const { email, password, system } = await req.json()

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
      include: { branch: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Check status
    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'User tidak aktif' },
        { status: 403 }
      )
    }

    // Check role for POS access
    if (system === 'pos') {
      const allowedRoles = ['Owner', 'Manager_Toko', 'Kasir']
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses ke POS' },
          { status: 403 }
        )
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        branchId: user.branch_id
      },
      process.env.JWT_SECRET!,
      { expiresIn: '30m' }
    )

    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch
      }
    })

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 // 30 minutes
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.9 User Authentication
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.2.1

---

### **Story 1.4: Backoffice Login & Role**

**As a** Manager/Owner  
**I want to** login ke Backoffice dengan email & password  
**So that** saya bisa manage master data & monitor operasional

**Story Points**: 5

#### Acceptance Criteria
```
✅ Backoffice login page accessible di `/backoffice/login`
✅ Login form sama seperti POS (email + password)
✅ Login flow sama seperti POS
✅ Role validation:
   - Owner, Manager BO, Manager Toko bisa akses Backoffice
   - Kasir & Gudang tidak bisa akses Backoffice

✅ Role-based permission enforcement:
   Owner:
   - ✅ All features
   - ✅ Delete master data
   - ✅ View all branches

   Manager Backoffice:
   - ✅ View/Edit master data
   - ❌ Delete master data
   - ✅ View all branches

   Manager Toko:
   - ✅ View stock untuk branch sendiri
   - ✅ View reports untuk branch sendiri
   - ❌ Edit master data
   - ❌ View other branches

✅ Protected routes dengan role check
```

#### Technical Tasks
- [ ] Create `/app/backoffice/login/page.tsx`
- [ ] Reuse LoginForm component (atau buat variant untuk BO)
- [ ] Update login API untuk support system: 'backoffice'
- [ ] Create permission middleware untuk role-based access
- [ ] Create role constants (`/lib/constants/roles.ts`)
- [ ] Implement role check helper functions
- [ ] Test dengan different roles

#### Role Constants
```typescript
// lib/constants/roles.ts
export const ROLES = {
  OWNER: 'Owner',
  MANAGER_BO: 'Manager_BO',
  MANAGER_TOKO: 'Manager_Toko',
  KASIR: 'Kasir',
  GUDANG: 'Gudang'
} as const

export const PERMISSIONS = {
  // Backoffice access
  ACCESS_BACKOFFICE: ['Owner', 'Manager_BO', 'Manager_Toko'],
  
  // POS access
  ACCESS_POS: ['Owner', 'Manager_Toko', 'Kasir'],
  
  // Master data
  CREATE_MASTER_DATA: ['Owner', 'Manager_BO'],
  EDIT_MASTER_DATA: ['Owner', 'Manager_BO'],
  DELETE_MASTER_DATA: ['Owner'],
  
  // View all branches
  VIEW_ALL_BRANCHES: ['Owner', 'Manager_BO'],
  
  // PO approval
  APPROVE_PO: ['Owner', 'Manager_BO'],
  
  // Receiving
  PO_RECEIVING: ['Owner', 'Manager_Toko', 'Gudang']
}

export function hasPermission(userRole: string, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission].includes(userRole)
}
```

#### PRD Reference
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.2 Authentication & Authorization

---

### **Story 1.5: JWT Authentication & Session Management**

**As a** System  
**I want to** implement secure JWT authentication  
**So that** user sessions are protected & auto-logout works

**Story Points**: 5

#### Acceptance Criteria
```
✅ JWT token generation:
   - Payload: userId, email, role, branchId
   - Expiry: 30 minutes
   - Secret: from environment variable

✅ JWT verification middleware:
   - Verify token on every protected route
   - Decode user info from token
   - Attach user to request context

✅ Auto-logout on idle:
   - Track last activity
   - Auto-logout after 30 min no activity
   - Redirect to login page

✅ Token refresh (optional untuk MVP):
   - Skip di MVP (user re-login every 30 min)

✅ Logout functionality:
   - Clear auth cookie
   - Clear client-side storage
   - Redirect to login

✅ Security:
   - httpOnly cookie (prevent XSS)
   - Secure flag in production
   - CSRF protection
```

#### Technical Tasks
- [ ] Create authentication middleware (`/lib/middleware/auth.ts`)
- [ ] Implement JWT verification
- [ ] Create protected route wrapper
- [ ] Implement auto-logout timer (client-side)
- [ ] Create logout API endpoint
- [ ] Add activity tracking (update last activity on API calls)
- [ ] Test token expiry scenario
- [ ] Test auto-logout functionality

#### Middleware Implementation
```typescript
// lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function authMiddleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
      email: string
      role: string
      branchId: number | null
    }

    // Attach user to request (extend NextRequest jika perlu)
    // For now, return decoded user
    return { user: decoded }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }
}
```

#### PRD Reference
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.2.2 Session Management

---

### **Story 1.6: Basic Routing & Layout**

**As a** Developer  
**I want to** setup basic routing & layout untuk POS & Backoffice  
**So that** navigation structure ready untuk development

**Story Points**: 2

#### Acceptance Criteria
```
✅ POS Layout:
   /pos
     /login        (login page)
     /             (POS dashboard - placeholder)
     /checkout     (checkout page - placeholder)
     /settlement   (settlement page - placeholder)

✅ Backoffice Layout:
   /backoffice
     /login                (login page)
     /                     (BO dashboard - placeholder)
     /master/products      (products page - placeholder)
     /master/categories    (categories page - placeholder)
     /inventory            (inventory page - placeholder)

✅ Layout components:
   - POS Layout: Header dengan logout button, branch name, kasir name
   - BO Layout: Sidebar navigation, header dengan logout

✅ Navigation working:
   - Login → Dashboard
   - Dashboard → other pages
   - Logout → Login page
```

#### Technical Tasks
- [ ] Create POS layout component (`/app/pos/layout.tsx`)
- [ ] Create BO layout component (`/app/backoffice/layout.tsx`)
- [ ] Create placeholder pages untuk main routes
- [ ] Implement navigation menu untuk BO sidebar
- [ ] Test routing flow
- [ ] Add loading states untuk page transitions

#### Layout Structure
```tsx
// app/pos/layout.tsx
export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">POS System</h1>
          <p className="text-sm">Cabang Sudirman - Kasir: Ahmad</p>
        </div>
        <button className="bg-blue-700 px-4 py-2 rounded">
          Logout
        </button>
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}

// app/backoffice/layout.tsx
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-800 text-white p-6">
        <h1 className="text-xl font-bold mb-6">Backoffice</h1>
        <nav>
          <ul className="space-y-2">
            <li><a href="/backoffice" className="block py-2 px-4 hover:bg-gray-700 rounded">Dashboard</a></li>
            <li><a href="/backoffice/master/products" className="block py-2 px-4 hover:bg-gray-700 rounded">Products</a></li>
            <li><a href="/backoffice/inventory" className="block py-2 px-4 hover:bg-gray-700 rounded">Inventory</a></li>
          </ul>
        </nav>
      </aside>
      <div className="flex-1">
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Welcome, Owner</h2>
          <button className="bg-red-600 text-white px-4 py-2 rounded">
            Logout
          </button>
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.0 (POS UI overview)
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.1 (Dashboard layout)

---

## 📊 SPRINT 1 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 1.1 Project Setup | 3 | Dev 1 |
| 1.2 Database Schema | 5 | Dev 1 + Dev 2 |
| 1.3 POS Login | 5 | Dev 2 |
| 1.4 BO Login & Role | 5 | Dev 2 |
| 1.5 JWT & Session | 5 | Dev 2 |
| 1.6 Routing & Layout | 2 | Dev 1 |
| **TOTAL** | **25** | |

### Definition of Done
```
✅ All acceptance criteria met
✅ Code reviewed & merged to main branch
✅ Database migrations applied
✅ Seed data working
✅ Unit tests written (basic tests minimal)
✅ Manual testing completed
✅ No critical bugs
✅ Documentation updated (README, API docs)
```

### Sprint Deliverables
1. ✅ Next.js 15 project fully setup
2. ✅ Database dengan 24 tables + seed data
3. ✅ POS login working
4. ✅ Backoffice login working
5. ✅ 4-5 roles dengan permission basic
6. ✅ JWT authentication & auto-logout
7. ✅ Basic routing & layout POS + Backoffice

---

## 🧪 TESTING CHECKLIST

### Manual Testing
- [ ] Login POS dengan role Kasir → Success
- [ ] Login POS dengan role Gudang → Error "Tidak ada akses"
- [ ] Login Backoffice dengan role Owner → Success
- [ ] Login Backoffice dengan role Kasir → Error "Tidak ada akses"
- [ ] Invalid email → Error message
- [ ] Invalid password → Error message
- [ ] Auto-logout after 30 min idle → Redirect to login
- [ ] Logout button → Clear session, redirect to login
- [ ] Access protected route tanpa login → Redirect to login

### Database Testing
- [ ] All migrations run successfully
- [ ] Seed data inserted
- [ ] Query users → 5+ users exist (Owner, Manager BO, Manager Toko, Kasir, Gudang)
- [ ] Query branches → 3 branches exist
- [ ] Query products → 10 products exist
- [ ] Foreign key constraints working
- [ ] Indexes created

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database schema changes mid-sprint | HIGH | Lock schema after Story 1.2, changes must be approved |
| JWT secret exposed | HIGH | Use strong secret, never commit to git, use .env |
| Team unfamiliar dengan Next.js 15 | MEDIUM | Allocate time untuk learning, pair programming |
| Prisma migration conflicts | MEDIUM | Coordinate migrations, use migration naming convention |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 2 Dependencies:**
- Database schema dari Sprint 1 harus 100% stable
- Authentication & session dari Sprint 1 harus working
- Role-based permission dari Sprint 1 akan digunakan di semua Sprint berikutnya

**Carryover:**
- Jika Story 1.2 (Database Schema) terlambat → Sprint 2 akan delay
- Minimal Sprint 1 harus deliver: Login working + Database ready

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Next Sprint**: MVP_SPRINT_2_MASTER_DATA.md
