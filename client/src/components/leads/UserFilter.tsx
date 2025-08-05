import React from 'react'

interface UserFilterProps {
  users: any[]
  usersLoading: boolean
  usersError: any
  selectedUserId: string
  onUserChange: (userId: string) => void
}

export function UserFilter({ 
  users, 
  usersLoading, 
  usersError, 
  selectedUserId, 
  onUserChange 
}: UserFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">Assigned to:</span>
      <select
        value={selectedUserId}
        onChange={(e) => onUserChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[150px]"
        disabled={usersLoading}
      >
        <option value="">All Users</option>
        <option value="unassigned">Unassigned</option>
        {usersLoading ? (
          <option disabled>Loading users...</option>
        ) : usersError ? (
          <option disabled>Error loading users</option>
        ) : users.length === 0 ? (
          <option disabled>No users available</option>
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
    </div>
  )
}