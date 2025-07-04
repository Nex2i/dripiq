import React from 'react'
import { Image, Palette } from 'lucide-react'

interface BrandIdentityProps {
  logo?: string | null
  brandColors?: string[]
  entityName?: string
  entityType?: 'lead' | 'organization'
}

const BrandIdentity: React.FC<BrandIdentityProps> = ({
  logo,
  brandColors,
  entityName,
  entityType = 'organization',
}) => {
  const hasLogo = logo && logo.trim() !== ''
  const hasColors = brandColors && brandColors.length > 0

  // Don't render if no brand identity data
  if (!hasLogo && !hasColors) {
    return null
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
      <div className="px-6 py-6">
        <div className="flex items-center mb-4">
          <Palette className="h-5 w-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Brand Identity
          </h2>
        </div>

        <div className="space-y-5">
          {/* Logo */}
          {hasLogo && (
            <div className="group">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Logo
              </label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
                  <Image className="h-4 w-4 text-gray-400" />
                </div>
                <div className="block w-full pl-10 pr-3 py-4 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm">
                  <div className="flex items-center justify-center min-h-[80px]">
                    <img
                      src={logo}
                      alt={`${entityName || entityType} logo`}
                      className="max-h-16 max-w-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                    <div className="hidden text-gray-500 text-sm">
                      Logo could not be loaded
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Primary {entityType} logo
              </p>
            </div>
          )}

          {/* Brand Colors */}
          {hasColors && (
            <div className="group">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Brand Colors
              </label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
                  <Palette className="h-4 w-4 text-gray-400" />
                </div>
                <div className="block w-full pl-10 pr-3 py-4 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm">
                  <div className="flex flex-wrap gap-3">
                    {brandColors.map((color, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div
                          className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                        <span className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded border">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Primary brand color palette
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BrandIdentity
