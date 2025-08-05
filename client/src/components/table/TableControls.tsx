import React from 'react'
import type { Table } from '@tanstack/react-table'
import { UserFilter } from '../leads/UserFilter'

interface TableControlsProps {
  table: Table<any>
  users?: any[]
  usersLoading?: boolean
  usersError?: any
  selectedUserId?: string
  onUserChange?: (userId: string) => void
  showUserFilter?: boolean
}

export function TableControls({ 
  table, 
  users = [], 
  usersLoading = false, 
  usersError = null,
  selectedUserId = '',
  onUserChange,
  showUserFilter = false
}: TableControlsProps) {
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false)
      }
    }

    if (isColumnDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isColumnDropdownOpen])

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {/* Column Visibility */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
            className="cursor-pointer bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          >
            Columns ▼
          </button>
          {isColumnDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-[200px]">
              <div className="p-3 space-y-2">
                {table.getAllLeafColumns().map(column => (
                  column.id !== 'select' && (
                    <label key={column.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-gray-300 text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
                      />
                      <span className="text-sm text-gray-700 capitalize">
                        {typeof column.columnDef.header === 'string' 
                          ? column.columnDef.header 
                          : column.id}
                      </span>
                    </label>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Filter */}
        {showUserFilter && onUserChange && (
          <UserFilter
            users={users}
            usersLoading={usersLoading}
            usersError={usersError}
            selectedUserId={selectedUserId}
            onUserChange={onUserChange}
          />
        )}
      </div>

      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Show:</span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value))
          }}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-700">entries</span>
      </div>
    </div>
  )
}
