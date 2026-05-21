You are an Edge Case Hunter adversarial code reviewer. You receive the diff below and have read access to the project. Your task is to walk every branching path and boundary condition in the code changes, looking for unhandled edge cases, race conditions, type safety issues, validation bypasses, and unexpected inputs.

### DIFF OUTPUT

```diff
diff --git a/apps/backoffice/app/pos/layout.tsx b/apps/backoffice/app/pos/layout.tsx
new file mode 100644
index 0000000..2b042ff
--- /dev/null
+++ b/apps/backoffice/app/pos/layout.tsx
@@ -0,0 +1,47 @@
+import { cookies } from 'next/headers'
+import { redirect } from 'next/navigation'
+import { verifyAccessToken } from '@/lib/auth'
+
+export default async function PosLayout({
+  children,
+}: {
+  children: React.ReactNode
+}) {
+  const cookieStore = await cookies()
+  const token = cookieStore.get('accessToken')?.value
+  const payload = token ? await verifyAccessToken(token) : null
+
+  if (!payload) {
+    redirect('/pos/login')
+  }
+
+  async function logoutAction() {
+    'use server'
+    const cs = await cookies()
+    cs.delete('accessToken')
+    redirect('/pos/login')
+  }
+
+  return (
+    <div className="min-h-screen bg-background flex flex-col">
+      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
+        <div>
+          <p className="text-base font-bold text-foreground leading-tight">{payload.userName}</p>
+          <p className="text-sm text-muted-foreground">{payload.branchName}</p>
+        </div>
+        <form action={logoutAction}>
+          <button
+            type="submit"
+            className="min-h-[44px] min-w-[44px] px-5 py-2 text-sm font-semibold text-muted-foreground border border-border rounded-xl hover:bg-accent hover:text-foreground active:scale-[0.97] transition-all"
+          >
+            Keluar
+          </button>
+        </form>
+      </header>
+
+      <main className="flex-1">
+        {children}
+      </main>
+    </div>
+  )
+}
diff --git a/apps/backoffice/app/pos/login/page.tsx b/apps/backoffice/app/pos/login/page.tsx
new file mode 100644
index 0000000..3d3d72e
--- /dev/null
+++ b/apps/backoffice/app/pos/login/page.tsx
@@ -0,0 +1,135 @@
+'use client'
+
+import { useState, FormEvent } from 'react'
+import { useRouter } from 'next/navigation'
+
+export default function PosLoginPage() {
+  const router = useRouter()
+  const [email, setEmail] = useState('')
+  const [password, setPassword] = useState('')
+  const [error, setError] = useState('')
+  const [loading, setLoading] = useState(false)
+
+  async function handleSubmit(e: FormEvent) {
+    e.preventDefault()
+    setError('')
+    setLoading(true)
+
+    try {
+      const res = await fetch('/api/auth/login', {
+        method: 'POST',
+        headers: { 'Content-Type': 'application/json' },
+        body: JSON.stringify({ mode: 'email_password', email, password }),
+      })
+
+      const data = await res.json()
+
+      if (!res.ok) {
+        setError(data.error || 'Login gagal')
+        return
+      }
+
+      document.cookie = `accessToken=${data.accessToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`
+
+      // Non-KASIR diarahkan ke /dashboard; KASIR ke /pos
+      if (data.user?.role !== 'KASIR') {
+        router.push('/dashboard')
+      } else {
+        router.push('/pos')
+      }
+    } catch {
+      setError('Terjadi kesalahan. Silakan coba lagi.')
+    } finally {
+      setLoading(false)
+    }
+  }
+
+  return (
+    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-5">
+      <div className="w-full max-w-sm">
+        <div className="text-center mb-8">
+          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary shadow-lg shadow-primary/20 mb-4">
+            <span className="text-4xl">🦁</span>
+          </div>
+          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
+            Hammielion
+          </h1>
+          <p className="text-muted-foreground mt-2 text-base font-medium">
+            Web POS
+          </p>
+        </div>
+
+        <div className="bg-card p-7 rounded-2xl border border-border shadow-xl shadow-black/5">
+          <div className="mb-7">
+            <h2 className="text-xl font-bold text-card-foreground">Masuk ke Kasir</h2>
+            <p className="text-base text-muted-foreground mt-1">
+              Gunakan akun kasir Anda untuk melanjutkan.
+            </p>
+          </div>
+
+          {error && (
+            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-base font-semibold flex items-center gap-3">
+              <span className="text-xl">⚠️</span>
+              {error}
+            </div>
+          )}
+
+          <form onSubmit={handleSubmit} className="space-y-5">
+            <div className="space-y-2">
+              <label htmlFor="email" className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">
+                Email
+              </label>
+              <input
+                id="email"
+                type="email"
+                value={email}
+                onChange={e => setEmail(e.target.value)}
+                required
+                autoComplete="email"
+                className="w-full px-4 py-4 bg-background border border-input rounded-xl text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[52px]"
+                placeholder="kasir@hammielion.id"
+              />
+            </div>
+
+            <div className="space-y-2">
+              <label htmlFor="password" className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">
+                Kata Sandi
+              </label>
+              <input
+                id="password"
+                type="password"
+                value={password}
+                onChange={e => setPassword(e.target.value)}
+                required
+                autoComplete="current-password"
+                className="w-full px-4 py-4 bg-background border border-input rounded-xl text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[52px]"
+                placeholder="••••••••"
+              />
+            </div>
+
+            <button
+              type="submit"
+              disabled={loading}
+              className="w-full min-h-[52px] px-4 bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 mt-2"
+            >
+              {loading ? (
+                <div className="flex items-center justify-center gap-2">
+                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
+                  Memproses...
+                </div>
+              ) : (
+                'Masuk'
+              )}
+            </button>
+          </form>
+
+          <div className="mt-7 pt-5 border-t border-border/50 text-center">
+            <p className="text-sm text-muted-foreground">
+              &copy; {new Date().getFullYear()} Hammielion Group
+            </p>
+          </div>
+        </div>
+      </div>
+    </div>
+  )
+}
diff --git a/apps/backoffice/app/pos/page.tsx b/apps/backoffice/app/pos/page.tsx
new file mode 100644
index 0000000..dfe4cc4
--- /dev/null
+++ b/apps/backoffice/app/pos/page.tsx
@@ -0,0 +1,26 @@
+import { cookies } from 'next/headers'
+import { verifyAccessToken } from '@/lib/auth'
+
+export default async function PosHomePage() {
+  const cookieStore = await cookies()
+  const token = cookieStore.get('accessToken')?.value
+  const payload = token ? await verifyAccessToken(token) : null
+
+  return (
+    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-6 text-center">
+      <div className="text-6xl mb-6">🛒</div>
+      <h2 className="text-2xl font-bold text-foreground mb-2">
+        Selamat datang di Web POS
+      </h2>
+      <p className="text-base text-muted-foreground mb-1">
+        {payload?.userName ?? ''}
+      </p>
+      <p className="text-sm text-muted-foreground">
+        {payload?.branchName ?? ''}
+      </p>
+      <p className="mt-8 text-sm text-muted-foreground/60 italic">
+        Fitur transaksi akan tersedia di Story 9.2
+      </p>
+    </div>
+  )
+}
diff --git a/apps/backoffice/middleware.ts b/apps/backoffice/middleware.ts
index 17f141f..ee59f92 100644
--- a/apps/backoffice/middleware.ts
+++ b/apps/backoffice/middleware.ts
@@ -33,6 +33,7 @@ export async function middleware(request: NextRequest) {
     pathname.startsWith('/api/auth') ||
     pathname.startsWith('/api/health') ||
     pathname === '/login' ||
+    pathname === '/pos/login' ||
     pathname.startsWith('/_next') ||
     pathname === '/favicon.ico'
   ) {
@@ -53,6 +54,10 @@ export async function middleware(request: NextRequest) {
       if (isAllowedOrigin && origin) response.headers.set('Access-Control-Allow-Origin', origin);
       return response;
     }
+    // Unauthenticated request ke /pos/* → redirect ke /pos/login
+    if (pathname.startsWith('/pos')) {
+      return NextResponse.redirect(new URL('/pos/login', request.url));
+    }
     return NextResponse.redirect(new URL('/login', request.url));
   }
 
@@ -63,9 +68,24 @@ export async function middleware(request: NextRequest) {
       if (isAllowedOrigin && origin) response.headers.set('Access-Control-Allow-Origin', origin);
       return response;
     }
+    if (pathname.startsWith('/pos')) {
+      return NextResponse.redirect(new URL('/pos/login', request.url));
+    }
     return NextResponse.redirect(new URL('/login', request.url));
   }
 
+  // Role guard: KASIR mencoba akses backoffice → redirect ke /pos
+  const boPathPrefixes = ['/dashboard', '/bo', '/master-data', '/settings', '/reports', '/inventory', '/retur', '/audit-log', '/purchase-orders'];
+  const isBoPath = boPathPrefixes.some((prefix) => pathname.startsWith(prefix));
+  if (payload.role === 'KASIR' && isBoPath) {
+    return NextResponse.redirect(new URL('/pos', request.url));
+  }
+
+  // Role guard: non-KASIR mencoba akses POS UI → redirect ke /dashboard
+  if (payload.role !== 'KASIR' && pathname.startsWith('/pos') && !pathname.startsWith('/api/')) {
+    return NextResponse.redirect(new URL('/dashboard', request.url));
+  }
+
   const response = NextResponse.next();
   if (isAllowedOrigin && origin) {
     response.headers.set('Access-Control-Allow-Origin', origin);
```

Output findings as a Markdown list. Each finding should have a clear title and explanation of the issue.
