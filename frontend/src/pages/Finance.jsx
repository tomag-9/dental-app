import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DollarSign, TrendingUp, Receipt, BarChart3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Finance() {
    const financeMetrics = [
        { title: 'Total Revenue', value: '$0.00', icon: DollarSign, change: 'awaiting data' },
        { title: 'Pending Invoices', value: '0', icon: Receipt, change: 'in development' },
        { title: 'Monthly Growth', value: '0%', icon: TrendingUp, change: 'in development' },
        { title: 'Analytics', value: 'Coming soon', icon: BarChart3, change: 'in progress' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
                <p className="text-muted-foreground">Manage invoices, pricing, and financial analytics.</p>
            </div>

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
                            <div className="text-2xl font-bold">{metric.value}</div>
                            <p className="text-xs text-muted-foreground">
                                {metric.change}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Price List Management</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Configure dental service pricing and validity periods. Manage all procedures and their associated costs.
                            </p>
                            <Link to="/price-list">
                                <Button className="w-full">
                                    Manage Price List
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Invoicing & Analytics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Invoice management, revenue tracking, and financial analytics are under development. Full features coming soon.
                            </p>
                            <Button disabled className="w-full">
                                Coming Soon
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-base">Finance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Finance module is under development. Currently implemented features:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                            <li>✅ Price list configuration with validity periods</li>
                            <li>Invoice management and tracking (in development)</li>
                            <li>Revenue analytics and reports (in development)</li>
                            <li>Financial forecasting (in development)</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
