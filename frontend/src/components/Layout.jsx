import { Outlet } from 'react-router-dom';
import Sidebar from './layout/Sidebar';

export default function Layout() {
    return (
        <div className="flex h-screen overflow-hidden text-foreground">
            <Sidebar />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl min-h-full rounded-xl border border-border bg-card p-4 sm:p-6 lg:p-8 shadow-sm">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
