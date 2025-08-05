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
        <svg
          className="h-5 w-5 text-[var(--color-primary-600)] mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
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
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Deleting...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete Selected
            </>
          )}
        </button>
      </div>
    </div>
  )
}
