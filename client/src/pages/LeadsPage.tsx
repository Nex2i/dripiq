import React from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  FilterFn,
  RowSelectionState,
} from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import { useNavigate } from '@tanstack/react-router'
import {
  useLeads,
  useInvalidateLeads,
  useBulkDeleteLeads,
  useAssignLeadOwner,
  useUsers,
} from '../hooks/useLeadsQuery'
import type { Lead } from '../types/lead.types'
import LeadStatusBadges from '../components/LeadStatusBadges'
import StatusInfoModal from '../components/StatusInfoModal'

// Define a simple fuzzy filter function (required by global module declaration)
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

// Debounced Input Component
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const [value, setValue] = React.useState(initialValue)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value, debounce, onChange])

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}

// Status Header Component with Info Modal
function StatusHeader() {
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  return (
    <>
      <div className="flex items-center gap-1">
        <span>Status</span>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center"
          title="View status definitions"
        >
          <svg
            className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>
      
      <StatusInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}

const LeadsPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [assigningOwner, setAssigningOwner] = React.useState<string | null>(
    null,
  )
  const { data: leads = [], isLoading, error, refetch } = useLeads(searchQuery)
  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
  } = useUsers()
  const invalidateLeads = useInvalidateLeads()
  const bulkDeleteMutation = useBulkDeleteLeads()
  const assignOwnerMutation = useAssignLeadOwner()

  const users = usersResponse?.data || []

  const handleRefresh = () => {
    invalidateLeads()
    refetch()
  }

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
    )
    if (selectedIds.length === 0) return

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedIds.length} lead(s)? This action cannot be undone.`,
      )
    ) {
      try {
        await bulkDeleteMutation.mutateAsync(selectedIds)
        setRowSelection({}) // Clear selection after successful delete
      } catch (error) {
        console.error('Failed to delete leads:', error)
      }
    }
  }

  const handleAssignOwner = async (leadId: string, userId: string) => {
    try {
      setAssigningOwner(leadId)
      await assignOwnerMutation.mutateAsync({ id: leadId, userId })
    } catch (error) {
      console.error('Failed to assign owner:', error)
    } finally {
      setAssigningOwner(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }



  const getOwnerDisplay = (lead: Lead) => {
    // Find the owner user from the users list
    const ownerUser = users.find((user) => user.id === lead.ownerId)
    const currentOwnerName = ownerUser
      ? ownerUser.firstName && ownerUser.lastName
        ? `${ownerUser.firstName} ${ownerUser.lastName}`
        : ownerUser.email
      : 'Unassigned'

    return (
      <div className="relative group">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-900">{currentOwnerName}</span>
          <button
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation()
              // This will be handled by the dropdown
            }}
            title="Change owner"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        </div>

        <select
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={lead.ownerId || ''}
          onChange={(e) => {
            const userId = e.target.value
            if (userId !== lead.ownerId) {
              handleAssignOwner(lead.id, userId)
            }
          }}
          disabled={assigningOwner === lead.id || usersLoading}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Unassigned</option>
          {usersLoading ? (
            <option value="" disabled>
              Loading users...
            </option>
          ) : usersError ? (
            <option value="" disabled>
              Error loading users
            </option>
          ) : users.length === 0 ? (
            <option value="" disabled>
              No users available
            </option>
          ) : (
            users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email}
              </option>
            ))
          )}
        </select>

        {assigningOwner === lead.id && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-primary-600)]"></div>
          </div>
        )}
      </div>
    )
  }

  // Define table columns
  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="rounded border-gray-300 text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="rounded border-gray-300 text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 40,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => (
          <div className="text-sm font-medium text-gray-900">
            {info.getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'company',
        header: 'Company',
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {(info.getValue() as string) || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {info.getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {(info.getValue() as string) || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'statuses',
        header: () => <StatusHeader />,
        cell: (info) => <LeadStatusBadges statuses={info.row.original.statuses || []} compact />,
      },
      {
        accessorKey: 'ownerId',
        header: 'Owner',
        cell: (info) => getOwnerDisplay(info.row.original),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {formatDate(info.getValue() as string)}
          </div>
        ),
      },
    ],
    [users, usersLoading, usersError, assigningOwner],
  )

  // Create table instance
  const table = useReactTable({
    data: leads,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
  })

  const selectedRowCount = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  ).length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary-600)] mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading leads...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 text-red-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-900 font-medium mb-2">
                Error loading leads
              </p>
              <p className="text-gray-500 mb-4">
                {error?.message || String(error)}
              </p>
              <button
                onClick={handleRefresh}
                className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
            <p className="mt-2 text-gray-600">
              {leads.length === 0 && !searchQuery
                ? 'No leads yet'
                : searchQuery
                  ? `${leads.length} lead${leads.length === 1 ? '' : 's'} found for "${searchQuery}"`
                  : `${leads.length} lead${leads.length === 1 ? '' : 's'} total`}
              {selectedRowCount > 0 && (
                <span className="ml-2 text-[var(--color-primary-600)] font-medium">
                  ({selectedRowCount} selected)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: '/leads/new' })}
              className="inline-flex items-center px-4 py-2 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              New Lead
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh leads"
            >
              <svg
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="ml-2">Refresh</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <DebouncedInput
              value={searchQuery}
              onChange={(value) => setSearchQuery(String(value))}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-white text-gray-900 placeholder-gray-500"
              placeholder="Search leads by name, email, company, or phone..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                title="Clear search"
              >
                <svg
                  className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRowCount > 0 && (
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
                {selectedRowCount} lead{selectedRowCount === 1 ? '' : 's'}{' '}
                selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRowSelection({})}
                className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] text-sm font-medium"
              >
                Clear selection
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="inline-flex items-center px-3 py-2 border border-red-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDeleteMutation.isPending ? (
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
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {leads.length === 0 ? (
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
                {searchQuery ? 'No leads found' : 'No leads yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery
                  ? `No leads match your search for "${searchQuery}". Try a different search term.`
                  : 'Get started by adding your first lead using the + button in the header.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        row.getIsSelected()
                          ? 'bg-[var(--color-primary-50)]'
                          : ''
                      }`}
                      onClick={() =>
                        navigate({ to: `/leads/${row.original.id}` })
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-6 py-4 whitespace-nowrap"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadsPage
