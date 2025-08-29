import React, { useState, useRef, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'

interface MenuProps {
  children: React.ReactNode
  trigger?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}

interface MenuItemProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'danger'
  className?: string
}

interface MenuSeparatorProps {
  className?: string
}

// Menu Context
const MenuContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {},
})

// Main Menu Component
export const Menu: React.FC<MenuProps> = ({
  children,
  trigger,
  className = '',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const defaultTrigger = (
    <button
      className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
      title="More options"
    >
      <MoreVertical className="h-4 w-4 text-gray-600" />
    </button>
  )

  return (
    <MenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={`relative ${className}`} ref={menuRef}>
        <div onClick={() => setIsOpen(!isOpen)}>
          {trigger || defaultTrigger}
        </div>

        {isOpen && (
          <div
            className={`absolute top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {children}
          </div>
        )}
      </div>
    </MenuContext.Provider>
  )
}

// Menu Item Component
export const MenuItem: React.FC<MenuItemProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'default',
  className = '',
}) => {
  const { setIsOpen } = React.useContext(MenuContext)

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
      setIsOpen(false)
    }
  }

  const variantClasses = {
    default: 'text-gray-700 hover:bg-gray-50',
    danger: 'text-red-600 hover:bg-red-50',
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
        variantClasses[variant]
      } ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// Menu Separator Component
export const MenuSeparator: React.FC<MenuSeparatorProps> = ({
  className = '',
}) => {
  return <div className={`h-px bg-gray-200 my-1 ${className}`} />
}
