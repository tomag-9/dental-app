import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, UserRound, Hospital,
  Stethoscope, FileText, Settings, LogOut, Menu, X, Calendar, Database, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const SidebarItem = ({ icon: Icon, label, to, active, collapsed }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group",
      active
        ? "bg-primary text-white shadow-lg shadow-primary/30"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    )}
  >
    <div className={cn("shrink-0 transition-transform duration-200", !active && "group-hover:scale-110")}>
        <Icon size={22} />
    </div>
    {!collapsed && <span className="font-bold text-sm tracking-tight">{label}</span>}
  </Link>
);

export default function Layout({ children, handleLogout, userRole }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Calendar, label: 'Kalendár', to: '/calendar' },
    { icon: Users, label: 'Pacienti', to: '/patients' },
    { icon: Briefcase, label: 'Práce', to: '/jobs' },
    { icon: Stethoscope, label: 'Lekári', to: '/doctors' },
    { icon: Hospital, label: 'Kliniky', to: '/clinics' },
    { icon: UserRound, label: 'Technici', to: '/technicians' },
    { icon: FileText, label: 'Faktúry', to: '/finance/invoices' },
    { icon: Database, label: 'Sklad', to: '/storage/items' },
    { icon: Settings, label: 'Nastavenia', to: '/settings/users' },
  ];

  const superItems = [
    { icon: ShieldCheck, label: 'Superadmin', to: '/superadmin/dashboard' },
    { icon: Hospital, label: 'Laboratóriá', to: '/superadmin/labs' },
  ];

  const current = userRole === 'superadmin' ? superItems : menuItems;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-gray-100 transition-all duration-300 flex flex-col z-30 shadow-xl shadow-gray-200/50",
          collapsed ? "w-24" : "w-72"
        )}
      >
        <div className="p-6 flex items-center justify-between h-20 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-black italic">D</div>
                <span className="text-xl font-black text-gray-900 tracking-tighter">Dental<span className="text-primary">Lab</span></span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors mx-auto"
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
          {current.map(i => (
            <SidebarItem
                key={i.to}
                {...i}
                active={location.pathname === i.to || (i.to !== '/' && location.pathname.startsWith(i.to))}
                collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-gray-50 mt-auto">
            <button
                onClick={handleLogout}
                className={cn(
                    "flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-red-500 hover:bg-red-50 transition-all font-bold text-sm",
                    collapsed && "justify-center"
                )}
            >
                <LogOut size={22} />
                {!collapsed && <span>Odhlásiť sa</span>}
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-8 justify-between shrink-0 z-20 sticky top-0">
          <div className="flex flex-col">
              <h1 className="text-lg font-black text-gray-900 tracking-tight">
                {menuItems.find(i => i.to === location.pathname || (i.to !== '/' && location.pathname.startsWith(i.to)))?.label || 'Prehľad'}
              </h1>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vitajte v systéme</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-black text-gray-900">{userRole === 'admin' ? 'Administrátor' : userRole === 'superadmin' ? 'Superadmin' : 'Používateľ'}</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Laboratórium aktívne</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center font-black text-primary border border-gray-200 shadow-inner uppercase text-xl">
              {userRole?.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 pb-24 bg-[#fafafa] custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>

        {/* Footer info */}
        <div className="absolute bottom-4 right-8 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] pointer-events-none">
            Dental Lab System v2.0
        </div>
      </main>
    </div>
  );
}
