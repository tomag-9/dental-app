import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { User, Users, Building } from 'lucide-react';
import UsersSettings from './UsersSettings';
import ProfileSettings from './ProfileSettings';
import LabSettings from './LabSettings';
import useAuthStore from '../store/auth';

export default function Settings() {
    const { tab = 'profile' } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);

    const isAdminOrSuperadmin = ['admin', 'superadmin'].includes(user?.role);

    const allSettings = [
        { id: 'profile', label: 'Profile', icon: User, component: ProfileSettings },
        { id: 'users', label: 'Team Members', icon: Users, component: UsersSettings },
        { id: 'lab', label: 'Lab Settings', icon: Building, component: LabSettings },
    ];

    const settings = allSettings.filter((section) => {
        if (section.id === 'users') {
            return isAdminOrSuperadmin;
        }
        return true;
    });

    const currentSection = settings.find(s => s.id === tab) || settings[0];
    if (!currentSection) {
        return <Navigate to="/" replace />;
    }
    if (tab !== currentSection.id) {
        return <Navigate to={`/settings/${currentSection.id}`} replace />;
    }
    const CurrentComponent = currentSection.component;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your account, lab, and team settings.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex gap-2 sm:flex-col overflow-x-auto sm:overflow-x-visible">
                    {settings.map(section => (
                        <Button
                            key={section.id}
                            variant={tab === section.id ? 'default' : 'outline'}
                            onClick={() => navigate(`/settings/${section.id}`)}
                            className="gap-2 whitespace-nowrap sm:w-full sm:justify-start"
                        >
                            <section.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{section.label}</span>
                        </Button>
                    ))}
                </div>
                <div className="flex-1">
                    <CurrentComponent />
                </div>
            </div>
        </div>
    );
}
