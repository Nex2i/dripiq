import React from 'react'
import { Info, Edit } from 'lucide-react'
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
          <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
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
    // Only show verified users in options
    const verifiedUsers = Array.isArray(users)
      ? users.filter((u) => u.hasConnectedPrimaryMailAccount)
      : []

    // Find the owner user from the verified users list first, fallback to all users for name display
    const ownerUser = (verifiedUsers.length > 0 ? verifiedUsers : users).find(
      (user: any) => user.id === lead.ownerId,
    )
    const currentOwnerName = ownerUser
      ? ownerUser.firstName && ownerUser.lastName
        ? `${ownerUser.firstName} ${ownerUser.lastName}`
        : ownerUser.email
      : 'Unassigned'

    const placeholderValue = '__placeholder__'
    const selectValue = lead.ownerId || placeholderValue

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
            title="Change owner (verified users only)"
          >
            <Edit className="h-4 w-4" />
          </button>
        </div>

        <select
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={selectValue}
          onChange={(e) => {
            const userId = e.target.value
            if (userId === placeholderValue) return
            if (userId !== lead.ownerId) {
              onAssignOwner(lead.id, userId)
            }
          }}
          disabled={assigningOwner === lead.id || usersLoading}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Placeholder only shown when unassigned; cannot be selected for assignment */}
          {!lead.ownerId && (
            <option value={placeholderValue} disabled>
              Select verified owner
            </option>
          )}
          {usersLoading ? (
            <option value={placeholderValue} disabled>
              Loading users...
            </option>
          ) : usersError ? (
            <option value={placeholderValue} disabled>
              Error loading users
            </option>
          ) : verifiedUsers.length === 0 ? (
            <option value={placeholderValue} disabled>
              No verified users available
            </option>
          ) : (
            verifiedUsers.map((user) => (
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
        enableColumnFilter: false,
      },
      {
        accessorKey: 'url',
        header: ({ header }) => (
          <SortableHeader header={header}>Website</SortableHeader>
        ),
        cell: (info) => {
          const url = info.getValue() as string
          return url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
            </a>
          ) : (
            <span className="text-sm text-gray-500">-</span>
          )
        },
        enableColumnFilter: false,
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
          <SortableHeader header={header}>Assigned To</SortableHeader>
        ),
        cell: (info) => getOwnerDisplay(info.row.original),
        enableColumnFilter: false,
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
        enableColumnFilter: false,
      },
    ],
    [
      users,
      usersLoading,
      usersError,
      assigningOwner,
      onAssignOwner,
      formatDate,
    ],
  )
}
