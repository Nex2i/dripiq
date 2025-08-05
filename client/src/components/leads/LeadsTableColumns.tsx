import React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { Lead } from '../../types/lead.types'
import { SortableHeader } from '../table/SortableHeader'
import LeadStatusBadges from '../LeadStatusBadges'
import StatusInfoModal from '../StatusInfoModal'

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
            className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
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

interface UseLeadsColumnsProps {
  users: any[]
  usersLoading: boolean
  usersError: any
  assigningOwner: string | null
  onAssignOwner: (leadId: string, userId: string) => void
  formatDate: (dateString: string) => string
}

export function useLeadsColumns({
  users,
  usersLoading,
  usersError,
  assigningOwner,
  onAssignOwner,
  formatDate,
}: UseLeadsColumnsProps) {
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
              onAssignOwner(lead.id, userId)
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

  return React.useMemo<ColumnDef<Lead>[]>(
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
        header: ({ header }) => (
          <SortableHeader header={header}>Name</SortableHeader>
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-gray-900">
            {info.getValue() as string}
          </div>
        ),
        filterFn: 'includesString',
      },
      {
        accessorKey: 'company',
        header: ({ header }) => (
          <SortableHeader header={header}>Company</SortableHeader>
        ),
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {(info.getValue() as string) || '-'}
          </div>
        ),
        filterFn: 'includesString',
      },
      {
        accessorKey: 'email',
        header: ({ header }) => (
          <SortableHeader header={header}>Email</SortableHeader>
        ),
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {info.getValue() as string}
          </div>
        ),
        filterFn: 'includesString',
      },
      {
        accessorKey: 'phone',
        header: ({ header }) => (
          <SortableHeader header={header}>Phone</SortableHeader>
        ),
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {(info.getValue() as string) || '-'}
          </div>
        ),
        filterFn: 'includesString',
      },
      {
        accessorKey: 'statuses',
        header: () => <StatusHeader />,
        cell: (info) => (
          <LeadStatusBadges
            statuses={info.row.original.statuses || []}
            compact
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'ownerId',
        header: ({ header }) => (
          <SortableHeader header={header}>Owner</SortableHeader>
        ),
        cell: (info) => getOwnerDisplay(info.row.original),
        filterFn: 'includesString',
      },
      {
        accessorKey: 'createdAt',
        header: ({ header }) => (
          <SortableHeader header={header}>Created</SortableHeader>
        ),
        cell: (info) => (
          <div className="text-sm text-gray-500">
            {formatDate(info.getValue() as string)}
          </div>
        ),
        sortingFn: 'datetime',
      },
    ],
    [users, usersLoading, usersError, assigningOwner, onAssignOwner, formatDate],
  )
}