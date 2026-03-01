import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/auth';

export default function ProtectedRoute({ allowedRoles }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles?.length > 0) {
        const role = user?.role;
        if (!role || !allowedRoles.includes(role)) {
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
}
