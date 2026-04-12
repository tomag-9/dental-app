import { Outlet } from 'react-router-dom';
import Sidebar from './layout/Sidebar';

export default function Layout() {
    return (
        <div className="flex h-screen bg-sky-200 overflow-hidden text-slate-900">
            <Sidebar />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-sky-100">
                <div className="mx-auto max-w-6xl min-h-full rounded-2xl border border-sky-300 bg-sky-50 p-4 sm:p-6 lg:p-8 shadow-sm">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
