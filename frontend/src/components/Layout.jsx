import { Outlet } from 'react-router-dom';
import Sidebar from './layout/Sidebar';

export default function Layout() {
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8">
                <Outlet />
            </main>
        </div>
    );
}
