import React from 'react'
import type { Header } from '@tanstack/react-table'

interface SortableHeaderProps {
  header: Header<any, unknown>
  children: React.ReactNode
}

export function SortableHeader({ header, children }: SortableHeaderProps) {
  return (
    <button
      className="flex items-center space-x-1 hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1"
      onClick={() => header.column.toggleSorting(header.column.getIsSorted() === 'asc')}
    >
      <span>{children}</span>
      <span className="ml-1">
        {header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : '↕'}
      </span>
    </button>
  )
}