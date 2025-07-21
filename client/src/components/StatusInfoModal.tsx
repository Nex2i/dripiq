import React from 'react'
import {
  LEAD_STATUS_DEFINITIONS,
  LEAD_STATUS_ORDERED,
} from '../constants/leadStatusDefinitions'

interface StatusInfoModalProps {
  isOpen: boolean
  onClose: () => void
}

const StatusInfoModal: React.FC<StatusInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null)

  // Close modal when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Close modal on Escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Lead Status Definitions
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <svg
              className="h-5 w-5"
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
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {LEAD_STATUS_ORDERED.map((status) => (
              <div key={status} className="flex flex-col">
                <div className="font-medium text-gray-900 mb-1">{status}:</div>
                <div className="text-gray-600 text-sm leading-relaxed">
                  {LEAD_STATUS_DEFINITIONS[status]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusInfoModal
