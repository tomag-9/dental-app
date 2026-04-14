import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DollarSign, TrendingUp, Receipt, BarChart3, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function Finance() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/finance/stats/');
            setStats(response.data);
        } catch (err) {
            console.error('Failed to fetch finance stats:', err);
            setError('Nepodarilo sa načítať finančné štatistiky.');
        } finally {
            setLoading(false);
        }
    };

    const formatEur = (value) => {
        const n = Number(value || 0);
        return Number.isFinite(n) ? n.toFixed(2) : '0.00';
    };

    const financeMetrics = [
        {
            title: 'Celkové tržby',
            value: loading ? null : `${formatEur(stats?.total_revenue)} €`,
            icon: DollarSign,
            change: 'zaplatené faktúry',
        },
        {
            title: 'Čakajúce faktúry',
            value: loading ? null : String(stats?.pending_invoices ?? 0),
            icon: Receipt,
            change: 'vystavené, čakajú na platbu',
        },
        {
            title: 'Mesačný rast',
            value: loading ? null : `${stats?.monthly_growth_pct ?? 0} %`,
            icon: TrendingUp,
            change: 'oproti minulému mesiacu',
        },
        {
            title: 'História tržieb',
            value: loading ? null : '6 mesiacov',
            icon: BarChart3,
            change: 'mesačný prehľad',
        },
    ];

    const maxRevenue = stats?.monthly_revenue
        ? Math.max(...stats.monthly_revenue.map((m) => Number(m.revenue)), 1)
        : 1;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Financie</h1>
                <p className="text-muted-foreground">Správa faktúr, cenníka a finančnej analytiky.</p>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md flex gap-2 items-start">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {financeMetrics.map((metric) => (
                    <Card key={metric.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {metric.title}
                            </CardTitle>
                            <metric.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {metric.value === null ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                ) : (
                                    metric.value
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {metric.change}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {stats?.monthly_revenue && stats.monthly_revenue.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tržby za posledných 6 mesiacov</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2 h-44 pt-4">
                            {stats.monthly_revenue.map((item) => {
                                const rev = Number(item.revenue);
                                return (
                                <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-muted-foreground">
                                        {rev > 0 ? `${rev.toFixed(0)} €` : ''}
                                    </span>
                                    <div
                                        className="w-full bg-primary rounded-t-sm min-h-[4px]"
                                        style={{
                                            height: `${Math.max(4, (rev / maxRevenue) * 140)}px`,
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground text-center leading-tight">
                                        {item.month}
                                    </span>
                                </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Správa cenníka</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Konfigurácia cien dentálnych výkonov a platnosti cenníka.
                            </p>
                            <Link to="/price-list">
                                <Button className="w-full">
                                    Spravovať cenník
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Faktúry</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Správa a prehľad faktúr vystavených klinikám.
                            </p>
                            <Link to="/invoices">
                                <Button className="w-full">
                                    Zobraziť faktúry
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
