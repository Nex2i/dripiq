import { CheckCircle, Trash2, X, Loader2 } from 'lucide-react'

interface BulkActionsProps {
  selectedRowCount: number
  onClearSelection: () => void
  onBulkDelete: () => void
  isDeleting: boolean
}

export function BulkActions({
  selectedRowCount,
  onClearSelection,
  onBulkDelete,
  isDeleting,
}: BulkActionsProps) {
  if (selectedRowCount === 0) return null

  return (
    <div className="mb-4 bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center">
        <CheckCircle className="h-5 w-5 text-[var(--color-primary-600)] mr-2" />
        <span className="text-[var(--color-primary-900)] font-medium">
          {selectedRowCount} lead{selectedRowCount === 1 ? '' : 's'} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClearSelection}
          className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] text-sm font-medium"
        >
          Clear selection
        </button>
        <button
          onClick={onBulkDelete}
          disabled={isDeleting}
          className="inline-flex items-center px-3 py-2 border border-red-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </>
          )}
        </button>
      </div>
    </div>
  )
}
