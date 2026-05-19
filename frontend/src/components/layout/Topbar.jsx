import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Briefcase,
    Building,
    CalendarDays,
    ChevronDown,
    Clock,
    FileText,
    Package,
    Plus,
    Search,
    Stethoscope,
    User,
} from 'lucide-react';
import { Button } from '../ui/Button';
import api from '../../lib/api';
import { normalizeListResponse } from '../../lib/utils';
import useAuthStore from '../../store/auth';

const navResults = [
    { id: 'nav-dashboard', kind: 'page', label: 'Prejsť na Nástenku', sub: 'Prehľad laboratória', icon: CalendarDays, to: '/' },
    { id: 'nav-jobs', kind: 'page', label: 'Prejsť na Práce', sub: 'Zákazky a stav výroby', icon: Briefcase, to: '/jobs' },
    { id: 'nav-patients', kind: 'page', label: 'Prejsť na Pacientov', sub: 'Karty pacientov', icon: User, to: '/patients' },
    { id: 'nav-inventory', kind: 'page', label: 'Prejsť na Sklad', sub: 'Materiály a zásoby', icon: Package, to: '/inventory' },
    { id: 'nav-calendar', kind: 'page', label: 'Prejsť na Kalendár', sub: 'Termíny a plánovanie', icon: CalendarDays, to: '/calendar' },
    { id: 'nav-invoices', kind: 'page', label: 'Prejsť na Faktúry', sub: 'Fakturácia kliník', icon: FileText, to: '/invoices', adminOnly: true },
];

const platformNavResults = [
    { id: 'platform-overview', kind: 'page', label: 'Prejsť na Prehľad platformy', sub: 'Stav Molaris SaaS', icon: CalendarDays, to: '/superadmin/dashboard' },
    { id: 'platform-tenants', kind: 'page', label: 'Prejsť na Tenantov', sub: 'Laboratóriá v platforme', icon: Building, to: '/superadmin/labs' },
    { id: 'platform-users', kind: 'page', label: 'Prejsť na Používateľov', sub: 'Účty naprieč tenantmi', icon: User, to: '/superadmin/users' },
    { id: 'platform-billing', kind: 'page', label: 'Prejsť na Platformovú fakturáciu', sub: 'Predplatné a MRR', icon: FileText, to: '/superadmin/subscriptions' },
];

const groupLabels = {
    job: 'Práce',
    patient: 'Pacienti',
    tenant: 'Tenanti',
    platformUser: 'Používatelia',
    invoice: 'Faktúry',
    page: 'Stránky',
    action: 'Akcie',
};

function matches(value, query) {
    return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function patientName(patient) {
    return [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.name || `Pacient #${patient.id}`;
}

function jobPatientName(job) {
    return [job.patient_details?.first_name, job.patient_details?.last_name].filter(Boolean).join(' ') || job.patient_name || 'Neznámy pacient';
}

function formatCurrency(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(number);
}

export default function Topbar() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isSuperadmin = user?.role === 'superadmin';
    const isTenantAdmin = user?.role === 'admin';
    const [searchOpen, setSearchOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [searchState, setSearchState] = useState({ loading: false, results: [] });
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const inputRef = useRef(null);

    const quickActions = useMemo(() => [
        ...(isSuperadmin ? [
            { label: 'Správa tenantov', sub: 'Otvoriť platformové laboratóriá', icon: Building, to: '/superadmin/labs' },
            { label: 'Správa používateľov', sub: 'Otvoriť platformové účty', icon: User, to: '/superadmin/users' },
        ] : [
            { label: 'Nová práca', sub: 'Vytvoriť dentálnu zákazku', icon: Briefcase, to: '/jobs/new' },
            { label: 'Nový pacient', sub: 'Pridať kartu pacienta', icon: User, to: '/patients/new' },
        ]),
        ...(isTenantAdmin ? [
            { label: 'Nová faktúra', sub: 'Vystaviť faktúru klinike', icon: FileText, to: '/invoices/new' },
            { label: 'Nová klinika', sub: 'Pridať klientsku kliniku', icon: Building, to: '/clinics/new' },
            { label: 'Nový lekár', sub: 'Pridať odosielajúceho lekára', icon: Stethoscope, to: '/doctors/new' },
        ] : []),
    ], [isSuperadmin, isTenantAdmin]);

    useEffect(() => {
        const onKey = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen(true);
                setQuery('');
            }
            if (event.key === 'Escape') {
                setSearchOpen(false);
                setAddOpen(false);
                setNotifOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (searchOpen) {
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [searchOpen]);

    useEffect(() => {
        if (!searchOpen) return;
        const handle = window.setTimeout(async () => {
            setSearchState((current) => ({ ...current, loading: true }));
            try {
                const q = query.trim();

                if (isSuperadmin) {
                    const [labsRes, usersRes] = await Promise.all([
                        api.get('/labs/superadmin/all').catch(() => api.get('/labs/')).catch(() => ({ data: [] })),
                        api.get('/users/').catch(() => ({ data: [] })),
                    ]);
                    const labs = normalizeListResponse(labsRes.data);
                    const users = normalizeListResponse(usersRes.data);
                    const tenantItems = labs
                        .filter((lab) => !q || [lab.name, lab.city, lab.email, lab.subscription_plan].some((value) => matches(value, q)))
                        .slice(0, 6)
                        .map((lab) => ({
                            id: `tenant-${lab.id}`,
                            kind: 'tenant',
                            label: lab.name || `Tenant #${lab.id}`,
                            sub: [lab.city, lab.email, lab.subscription_plan].filter(Boolean).join(' · ') || 'Tenant',
                            icon: Building,
                            to: '/superadmin/labs',
                        }));
                    const userItems = users
                        .filter((platformUser) => !q || [platformUser.nickname, platformUser.username, platformUser.email, platformUser.role].some((value) => matches(value, q)))
                        .slice(0, 6)
                        .map((platformUser) => ({
                            id: `platform-user-${platformUser.id}`,
                            kind: 'platformUser',
                            label: platformUser.nickname || platformUser.username || platformUser.email || `Používateľ #${platformUser.id}`,
                            sub: [platformUser.email, platformUser.role].filter(Boolean).join(' · ') || 'Používateľ',
                            icon: User,
                            to: '/superadmin/users',
                        }));
                    const pageItems = platformNavResults
                        .filter((item) => !q || matches(`${item.label} ${item.sub}`, q))
                        .slice(0, 6);
                    const actionItems = quickActions
                        .filter((item) => !q || matches(`${item.label} ${item.sub}`, q))
                        .map((item) => ({ ...item, id: `action-${item.to}`, kind: 'action' }));
                    setSearchState({ loading: false, results: [...tenantItems, ...userItems, ...pageItems, ...actionItems] });
                    return;
                }

                const [jobsRes, patientsRes, invoicesRes] = await Promise.all([
                    api.get('/jobs/jobs/').catch(() => ({ data: [] })),
                    api.get('/crm/patients/').catch(() => ({ data: [] })),
                    isTenantAdmin ? api.get('/invoices/').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
                ]);
                const jobs = normalizeListResponse(jobsRes.data);
                const patients = normalizeListResponse(patientsRes.data);
                const invoices = normalizeListResponse(invoicesRes.data);

                const jobItems = jobs
                    .filter((job) => !q || [
                        job.id,
                        job.description,
                        job.status,
                        jobPatientName(job),
                        job.clinic_details?.name,
                    ].some((value) => matches(value, q)))
                    .slice(0, 5)
                    .map((job) => ({
                        id: `job-${job.id}`,
                        kind: 'job',
                        label: `#${job.id} - ${jobPatientName(job)}`,
                        sub: [job.description, job.status].filter(Boolean).join(' · ') || 'Práca',
                        icon: Briefcase,
                        to: `/jobs/${job.id}`,
                    }));

                const patientItems = patients
                    .filter((patient) => !q || [patientName(patient), patient.birth_number, patient.email, patient.phone].some((value) => matches(value, q)))
                    .slice(0, 5)
                    .map((patient) => ({
                        id: `patient-${patient.id}`,
                        kind: 'patient',
                        label: patientName(patient),
                        sub: [patient.birth_number, patient.email].filter(Boolean).join(' · ') || 'Pacient',
                        icon: User,
                        to: `/patients/${patient.id}/edit`,
                    }));

                const invoiceItems = invoices
                    .filter((invoice) => !q || [invoice.number, invoice.clinic_name, ...(invoice.patient_names || [])].some((value) => matches(value, q)))
                    .slice(0, 5)
                    .map((invoice) => ({
                        id: `invoice-${invoice.id}`,
                        kind: 'invoice',
                        label: invoice.number || `Faktúra #${invoice.id}`,
                        sub: [invoice.clinic_name, formatCurrency(invoice.total_amount || invoice.amount)].filter(Boolean).join(' · '),
                        icon: FileText,
                        to: `/invoices/${invoice.id}`,
                    }));

                const pageItems = navResults
                    .filter((item) => (!item.adminOnly || isTenantAdmin) && (!q || matches(`${item.label} ${item.sub}`, q)))
                    .slice(0, 6);

                const actionItems = quickActions
                    .filter((item) => !q || matches(`${item.label} ${item.sub}`, q))
                    .slice(0, 5)
                    .map((item) => ({ ...item, id: `action-${item.to}`, kind: 'action' }));

                setSearchState({ loading: false, results: [...jobItems, ...patientItems, ...invoiceItems, ...pageItems, ...actionItems] });
            } catch (error) {
                console.error('Command search failed:', error);
                setSearchState({ loading: false, results: [] });
            }
        }, 180);
        return () => window.clearTimeout(handle);
    }, [isSuperadmin, isTenantAdmin, query, quickActions, searchOpen]);

    const openNotifications = async () => {
        setNotifOpen((open) => !open);
        setAddOpen(false);
        if (notifOpen || notifications.length > 0) return;
        setNotificationsLoading(true);
        try {
            const [jobsRes, inventoryRes, invoicesRes] = await Promise.all([
                api.get('/jobs/jobs/').catch(() => ({ data: [] })),
                api.get('/warehouse/').catch(() => ({ data: [] })),
                isTenantAdmin ? api.get('/invoices/').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
            ]);
            const jobs = normalizeListResponse(jobsRes.data);
            const inventory = normalizeListResponse(inventoryRes.data);
            const invoices = normalizeListResponse(invoicesRes.data);
            const dueJobs = jobs
                .filter((job) => job.due_date && !['completed', 'cancelled', 'finished_factured'].includes(job.status))
                .slice(0, 3)
                .map((job) => ({
                    id: `due-${job.id}`,
                    title: 'Blížiaci sa termín',
                    desc: `#${job.id} - ${jobPatientName(job)}`,
                    icon: Clock,
                    tone: 'text-[var(--color-accent-amber-text)] bg-[var(--color-accent-amber-bg)]',
                    to: `/jobs/${job.id}`,
                }));
            const lowStock = inventory
                .filter((item) => {
                    const min = Number(item.min_quantity ?? item.min ?? 0);
                    const stock = Number(item.quantity ?? item.stock ?? 0);
                    return min > 0 && stock <= min;
                })
                .slice(0, 2)
                .map((item) => ({
                    id: `stock-${item.id}`,
                    title: 'Nízky stav skladu',
                    desc: item.name || item.code || 'Skladová položka',
                    icon: Package,
                    tone: 'text-destructive bg-[#fde8e6]',
                    to: '/inventory',
                }));
            const issuedInvoices = invoices
                .filter((invoice) => invoice.status === 'issued')
                .slice(0, 2)
                .map((invoice) => ({
                    id: `invoice-${invoice.id}`,
                    title: 'Faktúra čaká na úhradu',
                    desc: `${invoice.number || invoice.id} · ${formatCurrency(invoice.total_amount || invoice.amount)}`,
                    icon: FileText,
                    tone: 'text-primary bg-[var(--color-primary-subtle)]',
                    to: `/invoices/${invoice.id}`,
                }));
            setNotifications([...dueJobs, ...lowStock, ...issuedInvoices]);
        } catch (error) {
            console.error('Failed to load notifications:', error);
            setNotifications([]);
        } finally {
            setNotificationsLoading(false);
        }
    };

    const go = (to) => {
        setSearchOpen(false);
        setAddOpen(false);
        setNotifOpen(false);
        navigate(to);
    };

    const grouped = Object.entries(groupLabels)
        .map(([kind, label]) => ({ kind, label, items: searchState.results.filter((item) => item.kind === kind) }))
        .filter((group) => group.items.length > 0);

    return (
        <>
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-[rgba(247,246,242,.86)] px-4 backdrop-blur sm:px-6">
                <button
                    type="button"
                    onClick={() => {
                        setSearchOpen(true);
                        setQuery('');
                    }}
                    className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-muted-foreground transition-colors hover:border-[#b0ddd5]"
                >
                    <Search className="h-4 w-4 shrink-0" />
                    <span className="truncate">{isSuperadmin ? 'Hľadať tenantov, používateľov, stránky...' : 'Hľadať pacientov, práce, faktúry...'}</span>
                    <span className="ml-auto hidden rounded border border-border bg-[#fbfaf6] px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Ctrl K</span>
                </button>

                <div className="relative">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                            setAddOpen((open) => !open);
                            setNotifOpen(false);
                        }}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Pridať</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    {addOpen && (
                        <Popover width="w-72">
                            {quickActions.map((action) => (
                                <PopoverAction key={action.to} item={action} onClick={() => go(action.to)} />
                            ))}
                        </Popover>
                    )}
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={openNotifications}
                        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-[var(--color-sidebar-text)] transition-colors hover:border-[#b0ddd5] hover:text-primary"
                        aria-label="Notifikácie"
                    >
                        <Bell className="h-4 w-4" />
                        {notifications.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}
                    </button>
                    {notifOpen && (
                        <Popover width="w-96">
                            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                                <span className="font-semibold text-foreground">Notifikácie</span>
                                <button type="button" className="text-xs font-semibold text-primary" onClick={() => setNotifications([])}>
                                    Označiť ako prečítané
                                </button>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {notificationsLoading ? (
                                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">Načítavam notifikácie...</div>
                                ) : notifications.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">Žiadne nové notifikácie.</div>
                                ) : notifications.map((item) => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        onClick={() => go(item.to)}
                                        className="flex w-full items-start gap-3 border-b border-[#f0ede5] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#fbfaf6]"
                                    >
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                                            <item.icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.desc}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </Popover>
                    )}
                </div>
            </header>

            {searchOpen && (
                <div className="fixed inset-0 z-50 flex justify-center bg-[rgba(26,35,32,.42)] px-4 pt-[12vh]" onClick={() => setSearchOpen(false)}>
                    <div className="h-fit w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={isSuperadmin ? 'Hľadať tenantov, používateľov, stránky...' : 'Hľadať pacientov, práce, faktúry, stránky...'}
                                className="h-9 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus:shadow-none"
                            />
                            <button type="button" className="rounded border border-border bg-[#fbfaf6] px-2 py-1 text-[11px] text-muted-foreground" onClick={() => setSearchOpen(false)}>
                                esc
                            </button>
                        </div>
                        <div className="max-h-[52vh] overflow-y-auto py-2">
                            {searchState.loading ? (
                                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Načítavam výsledky...</div>
                            ) : grouped.length === 0 ? (
                                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Žiadne výsledky.</div>
                            ) : grouped.map((group) => (
                                <div key={group.kind}>
                                    <div className="px-5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{group.label}</div>
                                    {group.items.map((item) => (
                                        <button
                                            type="button"
                                            key={item.id}
                                            onClick={() => go(item.to)}
                                            className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-[#f0ede5]"
                                        >
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-[#fbfaf6] text-primary">
                                                <item.icon className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.sub}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function Popover({ children, width }) {
    return (
        <div className={`absolute right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-xl border border-border bg-card shadow-xl ${width}`}>
            {children}
        </div>
    );
}

function PopoverAction({ item, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#f0ede5]"
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-subtle)] text-primary">
                <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.sub}</span>
            </span>
        </button>
    );
}
