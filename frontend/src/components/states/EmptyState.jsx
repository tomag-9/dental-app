import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'Žiadne záznamy',
  description = 'Začnite vytvorením prvej položky.',
  icon = Inbox,
  action = null
}) {
  const IconComponent = icon;
  
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
      <IconComponent className="w-16 h-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-6 max-w-sm">{description}</p>
      {action && (
        <div className="flex gap-3">
          {action}
        </div>
      )}
    </div>
  );
}
