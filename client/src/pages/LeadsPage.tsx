import React from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
} from '@tanstack/react-table'
import type {
  RowSelectionState,
  SortingState,
  VisibilityState,
  PaginationState,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import {
  useLeads,
  useInvalidateLeads,
  useBulkDeleteLeads,
  useAssignLeadOwner,
  useUsers,
} from '../hooks/useLeadsQuery'
import { DebouncedInput } from '../components/table/DebouncedInput'
import { TableControls } from '../components/table/TableControls'
import { TablePagination } from '../components/table/TablePagination'
import { BulkActions } from '../components/leads/BulkActions'
import { EmptyState } from '../components/leads/EmptyState'
import { useLeadsColumns } from '../components/leads/LeadsTableColumns'
import { fuzzyFilter } from '../utils/tableFilters'
import { formatDate } from '../utils/dateUtils'
import { Plus, RefreshCw, AlertCircle, Search, X } from 'lucide-react'

const LeadsPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [assigningOwner, setAssigningOwner] = React.useState<string | null>(
    null,
  )
  const [selectedUserId, setSelectedUserId] = React.useState<string>('')

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

  // Get columns using the extracted hook
  const columns = useLeadsColumns({
    users,
    usersLoading,
    usersError,
    assigningOwner,
    onAssignOwner: handleAssignOwner,
    formatDate,
  })

  // Filter leads by selected user
  const filteredLeads = React.useMemo(() => {
    if (!selectedUserId) return leads
    if (selectedUserId === 'unassigned') {
      return leads.filter((lead) => !lead.ownerId)
    }
    return leads.filter((lead) => lead.ownerId === selectedUserId)
  }, [leads, selectedUserId])

  // Create table instance
  const table = useReactTable({
    data: filteredLeads,
    columns,
    state: {
      rowSelection,
      sorting,
      columnVisibility,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getRowId: (row) => row.id,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    globalFilterFn: fuzzyFilter,
  })

  const selectedRowCount = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  ).length

  const hasSearchOrFilters = Boolean(searchQuery || selectedUserId)

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
                <AlertCircle className="w-12 h-12" />
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
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
            <p className="mt-2 text-gray-600">
              {table.getFilteredRowModel().rows.length === 0 &&
              !hasSearchOrFilters
                ? 'No leads yet'
                : hasSearchOrFilters
                  ? `${table.getFilteredRowModel().rows.length} lead${table.getFilteredRowModel().rows.length === 1 ? '' : 's'} found`
                  : `${table.getFilteredRowModel().rows.length} lead${table.getFilteredRowModel().rows.length === 1 ? '' : 's'} total`}
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
              <Plus className="h-4 w-4 mr-2" />
              New Lead
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh leads"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span className="ml-2">Refresh</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <DebouncedInput
              value={searchQuery}
              onChange={(value) => setSearchQuery(String(value))}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-white text-gray-900 placeholder-gray-500"
              placeholder="Search leads by name or website..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                title="Clear search"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Table Controls */}
        <TableControls
          table={table}
          users={users}
          usersLoading={usersLoading}
          usersError={usersError}
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
          showUserFilter={true}
        />

        {/* Bulk Actions */}
        <BulkActions
          selectedRowCount={selectedRowCount}
          onClearSelection={() => setRowSelection({})}
          onBulkDelete={handleBulkDelete}
          isDeleting={bulkDeleteMutation.isPending}
        />

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {table.getFilteredRowModel().rows.length === 0 ? (
            <EmptyState
              hasSearchOrFilters={hasSearchOrFilters}
              onClearSearch={searchQuery ? () => setSearchQuery('') : undefined}
              onClearFilters={
                selectedUserId ? () => setSelectedUserId('') : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider"
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

              {/* Pagination */}
              <TablePagination table={table} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadsPage
