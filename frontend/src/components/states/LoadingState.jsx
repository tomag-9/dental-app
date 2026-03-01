import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const containerClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${containerClasses[size]} text-center`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500 mb-3`} />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
