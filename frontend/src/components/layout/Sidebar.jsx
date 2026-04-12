import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    CalendarDays,
    Receipt,
    Package,
    Settings,
    Menu,
    Stethoscope,
    Building,
    Wrench,
    FileText,
    X,
    Shield,
    CreditCard,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import useAuthStore from '../../store/auth';

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [expandSuperadmin, setExpandSuperadmin] = useState(false);
    const [expandFinance, setExpandFinance] = useState(true);
    const [expandMasterData, setExpandMasterData] = useState(true);
    const logout = useAuthStore(state => state.logout);
    const user = useAuthStore(state => state.user);

    const roleLabels = {
        superadmin: 'Superadmin',
        admin: 'Administrátor',
        user: 'Používateľ',
    };

    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Používateľ';
    const roleLabel = roleLabels[user?.role] || 'Používateľ';
    const initials = (displayName || 'P')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || 'P';

    const isAdminOrSuperadmin = ['admin', 'superadmin'].includes(user?.role);
    const mainLinks = [
        { name: 'Nástenka', to: '/', icon: LayoutDashboard },
        { name: 'Práce', to: '/jobs', icon: Briefcase },
        { name: 'Pacienti', to: '/patients', icon: Users },
        { name: 'Sklad', to: '/inventory', icon: Package },
        { name: 'Kalendár', to: '/calendar', icon: CalendarDays },
        { name: 'Nastavenia', to: '/settings', icon: Settings },
    ];

    const masterDataLinks = [
        { name: 'Kliniky', to: '/clinics', icon: Building },
        { name: 'Lekári', to: '/doctors', icon: Stethoscope },
        { name: 'Technici', to: '/technicians', icon: Wrench },
        { name: 'Cenník', to: '/price-list', icon: Receipt },
    ];

    const superadminLinks = [
        { name: 'Nástenka', to: '/superadmin/dashboard', icon: LayoutDashboard },
        { name: 'Používatelia', to: '/superadmin/users', icon: Users },
        { name: 'Laboratóriá', to: '/superadmin/labs', icon: Building },
        { name: 'Predplatné', to: '/superadmin/subscriptions', icon: CreditCard },
    ];

    const isSuperadmin = user?.role === 'superadmin';

    const navBase = "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm";
    const navActive = "bg-blue-400/25 text-blue-100 font-medium";
    const navInactive = "text-slate-200 hover:bg-slate-500/40 hover:text-white";

    return (
        <div className={cn(
            "h-screen border-r border-slate-500/50 bg-slate-600 text-slate-100 shadow-md transition-all duration-300 flex flex-col z-20",
            collapsed ? "w-20" : "w-64"
        )}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-500/50 bg-slate-600/90">
                {!collapsed && <span className="font-bold text-xl text-blue-200">DentalLab</span>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 rounded-md text-slate-300 hover:bg-slate-500/50 hover:text-white"
                >
                    {collapsed ? <Menu size={20} /> : <X size={20} />}
                </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
                {mainLinks.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => cn(
                            navBase,
                            isActive ? navActive : navInactive,
                            collapsed && "justify-center"
                        )}
                    >
                        <link.icon size={20} />
                        {!collapsed && <span>{link.name}</span>}
                    </NavLink>
                ))}

                {isAdminOrSuperadmin && (
                    <div>
                        <button
                            type="button"
                            onClick={() => setExpandFinance((prev) => !prev)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-slate-200 hover:bg-slate-500/40 hover:text-white text-sm',
                                collapsed && 'justify-center'
                            )}
                        >
                            <Receipt size={20} />
                            {!collapsed && (
                                <>
                                    <span className="flex-1 text-left">Financie</span>
                                    {expandFinance ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </>
                            )}
                        </button>

                        {!collapsed && expandFinance && (
                            <div className="mt-1 ml-2 pl-2 border-l border-slate-500 space-y-1">
                                <NavLink
                                    to="/finance"
                                    className={({ isActive }) => cn(navBase, isActive ? navActive : navInactive)}
                                >
                                    <Receipt size={16} />
                                    <span>Prehľad</span>
                                </NavLink>
                                <NavLink
                                    to="/invoices"
                                    className={({ isActive }) => cn(navBase, isActive ? navActive : navInactive)}
                                >
                                    <FileText size={16} />
                                    <span>Faktúry</span>
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}

                {isAdminOrSuperadmin && (
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setExpandMasterData((prev) => !prev)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-slate-200 hover:bg-slate-500/40 hover:text-white text-sm',
                                collapsed && 'justify-center'
                            )}
                        >
                            <Settings size={20} />
                            {!collapsed && (
                                <>
                                    <span className="flex-1 text-left">Konfigurácia</span>
                                    {expandMasterData ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </>
                            )}
                        </button>

                        {!collapsed && expandMasterData && (
                            <div className="mt-1 ml-2 pl-2 border-l border-slate-500 space-y-1">
                                {masterDataLinks.map((link) => (
                                    <NavLink
                                        key={link.to}
                                        to={link.to}
                                        className={({ isActive }) => cn(navBase, isActive ? navActive : navInactive)}
                                    >
                                        <link.icon size={16} />
                                        <span>{link.name}</span>
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isSuperadmin && (
                    <>
                        <div className="my-4 px-3">
                            <button
                                onClick={() => setExpandSuperadmin(!expandSuperadmin)}
                                className={cn(
                                    "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-slate-200 hover:bg-slate-500/40 hover:text-white text-sm",
                                    collapsed && "justify-center"
                                )}
                            >
                                <Shield size={20} />
                                {!collapsed && <span className="font-semibold">Superadmin</span>}
                            </button>
                        </div>

                        {expandSuperadmin && (
                            <div className="space-y-1 ml-2 pl-2 border-l border-slate-500">
                                {superadminLinks.map((link) => (
                                    <NavLink
                                        key={link.to}
                                        to={link.to}
                                        className={({ isActive }) => cn(navBase, isActive ? navActive : navInactive, collapsed && "justify-center")}
                                    >
                                        <link.icon size={18} />
                                        {!collapsed && <span>{link.name}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-slate-500/50 bg-slate-600/90">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-400/30 border border-blue-300/50 flex items-center justify-center text-blue-100 font-bold">
                        {initials}
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-medium truncate text-slate-100">{displayName}</p>
                            <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
                            <button onClick={logout} className="text-xs text-blue-200 hover:underline">Odhlásiť sa</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
