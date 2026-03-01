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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
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
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
            {renderMobileCard(item)}
          </div>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b-2 border-gray-200 text-gray-700">
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
          <tbody className="divide-y divide-gray-200">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                {renderDesktopRow(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
