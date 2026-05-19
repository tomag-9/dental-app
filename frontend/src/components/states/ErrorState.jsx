import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ErrorState({
  title = 'Nastala chyba',
  message = 'Nastala chyba pri načítaní dát.',
  onRetry = null,
  details = null
}) {
  return (
    <div className="rounded-lg border border-[#f5c0bb] bg-[#fde8e6] p-8">
      <div className="flex gap-4">
        <AlertCircle className="w-8 h-8 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-destructive mb-4">{message}</p>
          {details && (
            <div className="bg-white rounded px-3 py-2 text-xs text-muted-foreground font-mono mb-4 overflow-auto max-h-24">
              {details}
            </div>
          )}
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="border-[#f5c0bb] hover:bg-[#fff4f2]"
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
