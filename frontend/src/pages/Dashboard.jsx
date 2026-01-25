import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Users, Briefcase, Activity, DollarSign } from 'lucide-react';

export default function Dashboard() {
    const stats = [
        { title: 'Total Patients', value: '1,234', icon: Users, change: '+12% from last month' },
        { title: 'Active Jobs', value: '45', icon: Briefcase, change: '+5 new today' },
        { title: 'Revenue', value: '$12,345', icon: DollarSign, change: '+8% from last month' },
        { title: 'Completed Jobs', value: '89', icon: Activity, change: '+23 this week' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back to your dental lab overview.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">
                                {stat.change}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Activity or Charts would go here */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Jobs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No recent jobs found.</p>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No recent sales found.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
