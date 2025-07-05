import React from 'react'
import { X } from 'lucide-react'

interface VendorFitModalProps {
  isOpen: boolean
  onClose: () => void
  data: any
}

const VendorFitModal: React.FC<VendorFitModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-opacity-25 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-lg font-medium text-gray-900">
                Vendor Fit Report
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* JSON Content */}
          <div className="p-6 max-h-[70vh] overflow-auto bg-gray-50 rounded-b-lg">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VendorFitModal
