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
    CreditCard
} from 'lucide-react';
import { cn } from '../../lib/utils';
import useAuthStore from '../../store/auth';

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [expandSuperadmin, setExpandSuperadmin] = useState(false);
    const logout = useAuthStore(state => state.logout);
    const user = useAuthStore(state => state.user);

    const links = [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Jobs', to: '/jobs', icon: Briefcase },
        { name: 'Patients', to: '/patients', icon: Users },
        { name: 'Clinics', to: '/clinics', icon: Building },
        { name: 'Doctors', to: '/doctors', icon: Stethoscope },
        { name: 'Technicians', to: '/technicians', icon: Wrench },
        { name: 'Finance', to: '/finance', icon: Receipt },
        { name: 'Price List', to: '/price-list', icon: Receipt },
        { name: 'Invoices', to: '/invoices', icon: FileText },
        { name: 'Inventory', to: '/inventory', icon: Package },
        { name: 'Calendar', to: '/calendar', icon: CalendarDays },
        { name: 'Settings', to: '/settings', icon: Settings },
    ];

    const superadminLinks = [
        { name: 'Dashboard', to: '/superadmin/dashboard', icon: LayoutDashboard },
        { name: 'Users', to: '/superadmin/users', icon: Users },
        { name: 'Labs', to: '/superadmin/labs', icon: Building },
        { name: 'Subscriptions', to: '/superadmin/subscriptions', icon: CreditCard },
    ];

    const isSuperadmin = user?.role === 'superadmin';

    return (
        <div className={cn(
            "h-screen bg-card border-r border-border transition-all duration-300 flex flex-col z-20",
            collapsed ? "w-20" : "w-64"
        )}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-border">
                {!collapsed && <span className="font-bold text-xl text-primary">DentalLab</span>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                    {collapsed ? <Menu size={20} /> : <X size={20} />}
                </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                            isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            collapsed && "justify-center"
                        )}
                    >
                        <link.icon size={20} />
                        {!collapsed && <span>{link.name}</span>}
                    </NavLink>
                ))}

                {/* Superadmin Section */}
                {isSuperadmin && (
                    <>
                        <div className="my-4 px-3">
                            <button
                                onClick={() => setExpandSuperadmin(!expandSuperadmin)}
                                className={cn(
                                    "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-red-100 hover:text-red-800",
                                    collapsed && "justify-center"
                                )}
                            >
                                <Shield size={20} />
                                {!collapsed && <span className="font-semibold">Superadmin</span>}
                            </button>
                        </div>

                        {expandSuperadmin && (
                            <div className="space-y-1 ml-2 pl-2 border-l-2 border-red-300">
                                {superadminLinks.map((link) => (
                                    <NavLink
                                        key={link.to}
                                        to={link.to}
                                        className={({ isActive }) => cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                                            isActive
                                                ? "bg-red-100 text-red-700 font-medium"
                                                : "text-muted-foreground hover:bg-red-50 hover:text-red-600",
                                            collapsed && "justify-center"
                                        )}
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

            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        U
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-medium truncate">User</p>
                            <button onClick={logout} className="text-xs text-red-500 hover:underline">Log out</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
