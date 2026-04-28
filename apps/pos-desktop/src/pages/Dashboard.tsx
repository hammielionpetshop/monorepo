import { POSLayout } from '@/components/layout/POSLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useShiftStore } from '@/store/shift-store';
import {
  BarChart3,
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  PackagePlus,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

const getMenuItems = (isAdmin: boolean) => [
  {
    title: 'Point of Sale',
    description: 'Mulai transaksi penjualan baru',
    icon: ShoppingCart,
    path: '/pos',
    color: 'bg-brand-500',
    allowed: true,
    featured: true
  },
  {
    title: 'Request PO',
    description: 'Buat pengajuan stok ke supplier',
    icon: PackagePlus,
    path: '/po-request',
    color: 'bg-amber-500',
    allowed: isAdmin
  },
  {
    title: 'Penerimaan Barang',
    description: 'Catat barang masuk dari PO',
    icon: Download,
    path: '/receiving',
    color: 'bg-emerald-500',
    allowed: isAdmin
  },
  {
    title: 'Barang Rusak',
    description: 'Lapor barang rusak/expired',
    icon: Trash2,
    path: '/damaged-goods',
    color: 'bg-red-500',
    allowed: isAdmin
  },
  {
    title: 'Riwayat Transaksi',
    description: 'Lihat daftar transaksi hari ini',
    icon: ClipboardList,
    path: '/history',
    color: 'bg-blue-500',
    allowed: true,
  },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeShift } = useShiftStore();

  const userRole = user?.role?.toUpperCase() || 'CASHIER';
  const isAdmin = ['MANAGER', 'OWNER', 'ADMIN'].includes(userRole);

  const menuItems = getMenuItems(isAdmin);

  return (
    <POSLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-12 h-full overflow-y-auto custom-scrollbar">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/5">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-neutral-500 font-bold uppercase tracking-widest text-xs">
              <Calendar className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-tight">
              Selamat datang, <span className="text-brand-400">{user?.name}</span> 👋
            </h1>
            <p className="text-neutral-400 font-medium">Apa yang ingin kamu kerjakan hari ini?</p>
          </div>

          {activeShift && (
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-[32px] p-6 flex items-center space-x-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Shift Aktif</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20">
                    OPEN
                  </Badge>
                  <span className="text-xl font-black text-white">#{activeShift.shiftNumber}</span>
                </div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Dimulai Jam</span>
                <span className="text-xl font-bold text-white">
                  {new Date(activeShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.filter(item => item.allowed).map((item, idx) => (
            <Card 
              key={idx}
              className={cn(
                "group relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]",
                item.featured ? "md:col-span-2 lg:col-span-2 border-brand-500/50 bg-brand-500/10" : "bg-white/5 border-white/5 hover:bg-white/10"
              )}
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-8 flex items-center space-x-6">
                <div className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500",
                  item.color,
                  "text-white shadow-lg"
                )}>
                  <item.icon className={cn(item.featured ? "w-10 h-10" : "w-8 h-8")} />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <h2 className={cn("font-black text-white", item.featured ? "text-3xl" : "text-xl")}>
                      {item.title}
                    </h2>
                    {item.featured && (
                      <Badge className="bg-brand-500 text-white border-none text-[10px] uppercase">
                        Utama
                      </Badge>
                    )}
                  </div>
                  <p className="text-neutral-400 font-medium group-hover:text-neutral-300 transition-colors">
                    {item.description}
                  </p>
                </div>

                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-500 group-hover:bg-white/10 group-hover:text-white transition-all">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </CardContent>
              
              {/* Background Glow for Featured */}
              {item.featured && (
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-500/10 blur-[80px] rounded-full pointer-events-none" />
              )}
            </Card>
          ))}

          {/* Quick Stats / Info Card */}
          <Card className="bg-gradient-to-br from-neutral-900 to-[#0a0a0a] border-white/5 p-8 flex flex-col justify-between overflow-hidden relative">
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-neutral-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Keamanan & Akses</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Kamu masuk sebagai <span className="text-white font-bold">{userRole}</span>. 
                  {isAdmin ? ' Kamu memiliki akses penuh ke fitur inventori.' : ' Beberapa fitur dibatasi sesuai otorisasi.'}
                </p>
              </div>
            </div>
            
            <div className="pt-8 relative z-10">
               <div className="flex items-center space-x-2 text-neutral-500">
                  <Store className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Cabang {user?.branch || 'Utama'}</span>
               </div>
            </div>

            {/* Decoration */}
            <div className="absolute bottom-0 right-0 -mb-8 -mr-8 opacity-5">
              <BarChart3 className="w-40 h-40" />
            </div>
          </Card>
        </div>

        {/* Footer / System Info */}
        <div className="flex items-center justify-center space-x-6 pt-12 pb-4 opacity-30">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Sistem Stabil</span>
          </div>
          <div className="h-3 w-[1px] bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Hammielion POS v1.0.0</span>
        </div>

      </div>
    </POSLayout>
  );
};
