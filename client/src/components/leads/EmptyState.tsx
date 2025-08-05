import { Users } from 'lucide-react'

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
        <Users className="w-16 h-16" />
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
