import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { User, Users, Building, Lock } from 'lucide-react';
import UsersSettings from './UsersSettings';
import ProfileSettings from './ProfileSettings';
import LabSettings from './LabSettings';

export default function Settings() {
    const { tab = 'profile' } = useParams();
    const navigate = useNavigate();

    const settings = [
        { id: 'profile', label: 'Profile', icon: User, component: ProfileSettings },
        { id: 'users', label: 'Team Members', icon: Users, component: UsersSettings },
        { id: 'lab', label: 'Lab Settings', icon: Building, component: LabSettings },
    ];

    const currentSection = settings.find(s => s.id === tab) || settings[0];
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
