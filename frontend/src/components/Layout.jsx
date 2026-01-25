/* eslint-disable no-unused-vars */
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
  <Link to={to} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", active ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900", collapsed && "justify-center")} title={collapsed ? label : ""}>
    <div className="shrink-0"><Icon size={20} /></div>
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </Link>
);
export default function Layout({ children, handleLogout, userRole }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const items = [
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
  const superItems = [{ icon: ShieldCheck, label: 'Superadmin', to: '/superadmin/dashboard' }];
  const current = userRole === 'superadmin' ? superItems : items;
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className={cn("bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-20", collapsed ? "w-20" : "w-64")}>
        <div className="p-4 flex items-center justify-between border-b border-gray-100 h-16 shrink-0">
          {!collapsed && <span className="text-xl font-black text-primary">Zubná Technika</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">{collapsed ? <Menu size={20} /> : <X size={20} />}</button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">{current.map(i => <SidebarItem key={i.to} {...i} active={location.pathname === i.to} collapsed={collapsed} />)}</nav>
        <div className="p-4 border-t border-gray-100"><button onClick={handleLogout} className={cn("flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-600 hover:bg-red-50", collapsed && "justify-center")}><LogOut size={20} />{!collapsed && <span className="font-bold text-sm">Odhlásiť sa</span>}</button></div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between shrink-0 z-10"><h1 className="text-sm font-black text-gray-400 uppercase tracking-widest">Systém</h1><div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-primary border border-gray-200 shadow-sm uppercase">{userRole?.charAt(0)}</div></header>
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}
