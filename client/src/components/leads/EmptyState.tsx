interface EmptyStateProps {
  hasSearchOrFilters: boolean
  onClearSearch?: () => void
  onClearFilters?: () => void
}

export function EmptyState({
  hasSearchOrFilters,
  onClearSearch,
  onClearFilters,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {hasSearchOrFilters ? 'No leads found' : 'No leads yet'}
      </h3>
      <p className="text-gray-500 mb-6">
        {hasSearchOrFilters
          ? 'No leads match your current search and filters. Try adjusting your criteria.'
          : 'Get started by adding your first lead using the + button in the header.'}
      </p>
      {hasSearchOrFilters && (
        <div className="flex justify-center gap-2">
          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Clear Search
            </button>
          )}
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Clear User Filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
