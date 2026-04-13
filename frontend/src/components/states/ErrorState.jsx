import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ErrorState({
  title = 'Nastala chyba',
  message = 'Nastala chyba pri načítaní dát.',
  onRetry = null,
  details = null
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-8">
      <div className="flex gap-4">
        <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">{title}</h3>
          <p className="text-sm text-red-700 mb-4">{message}</p>
          {details && (
            <div className="bg-white rounded px-3 py-2 text-xs text-gray-600 font-mono mb-4 overflow-auto max-h-24">
              {details}
            </div>
          )}
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="border-red-300 hover:bg-red-100"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Skúsiť znova
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
