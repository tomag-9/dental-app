import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import useAuthStore from '../store/auth';
import { LogoBadge } from '../components/brand/Logo';

export default function Login() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ username: '', password: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const success = await login(formData.username, formData.password);

        if (success) {
            navigate('/');
        } else {
            setError('Neplatné prihlasovacie údaje');
        }
        setIsLoading(false);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-card rounded-2xl border border-border shadow-lg p-8 space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="text-center">
                    <div className="mb-4 flex justify-center">
                        <LogoBadge size={56} radius={14} />
                    </div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Molaris</div>
                    <h1 className="text-3xl font-bold text-foreground">Vitajte späť</h1>
                    <p className="text-muted-foreground mt-2">Prihláste sa do svojho účtu</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-[#fde8e6] border border-[#f5c0bb] text-destructive text-sm p-3 rounded-md text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Používateľské meno</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <input
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={handleChange}
                                className="block w-full pl-10 pr-3 py-2 border border-input bg-card rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                                placeholder="meno"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Heslo</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <input
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="block w-full pl-10 pr-3 py-2 border border-input bg-card rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-[var(--color-primary-light)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? 'Prihlasujem...' : 'Prihlásiť sa'}
                    </button>
                </form>
            </div>
        </div>
    );
}
