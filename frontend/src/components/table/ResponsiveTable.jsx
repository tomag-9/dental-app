import { Loader2 } from 'lucide-react';
import { EmptyState } from '../states';

export default function ResponsiveTable({
  columns,
  data,
  isLoading,
  isEmpty = false,
  emptyTitle = 'No data found',
  emptyDescription = 'No items to display.',
  renderMobileCard,
  renderDesktopRow
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isEmpty || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="space-y-4 md:hidden">
        {data.map((item, idx) => (
          <div key={idx} className="space-y-3 rounded-md border border-[var(--color-card-border)] bg-card p-4 shadow-sm">
            {renderMobileCard(item)}
          </div>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden overflow-x-auto rounded-md border border-[var(--color-table-border)] bg-card md:block">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-[var(--color-table-border)] bg-[var(--color-table-header)] text-[var(--color-sidebar-text)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-table-border)]">
            {data.map((item, idx) => (
              <tr key={idx} className="transition-colors hover:bg-[var(--color-table-hover)]">
                {renderDesktopRow(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
