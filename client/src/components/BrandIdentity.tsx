import React, { useState, useRef } from 'react'
import { Image, Palette, Upload, Check, AlertCircle } from 'lucide-react'
import { logoService } from '../services/logo.service'

interface BrandIdentityProps {
  logo?: string | null
  brandColors?: string[]
  entityName?: string
  entityType?: 'lead' | 'organization'
  entityWebsite?: string // Add website URL for domain extraction
  onLogoUpdate?: (newLogoUrl: string) => void // Callback for logo updates
}

const BrandIdentity: React.FC<BrandIdentityProps> = ({
  logo,
  brandColors,
  entityName,
  entityType = 'organization',
  entityWebsite,
  onLogoUpdate,
}) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [currentLogo, setCurrentLogo] = useState<string | null>(logo || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasLogo = currentLogo && currentLogo.trim() !== ''
  const hasColors = brandColors && brandColors.length > 0

  // Extract domain from entity website
  const extractDomain = (website: string | undefined): string | null => {
    if (!website) return null
    try {
      const url = new URL(
        website.startsWith('http') ? website : `https://${website}`,
      )
      return url.hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const domain = extractDomain(entityWebsite)

    if (!domain) {
      setUploadError('No website URL available for this entity')
      return
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setUploadError('File size must be less than 5MB')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)

    try {
      const publicUrl = await logoService.uploadLogoComplete(domain, file)
      setCurrentLogo(publicUrl)
      setUploadSuccess(true)

      // Call the callback if provided
      if (onLogoUpdate) {
        onLogoUpdate(publicUrl)
      }

      // Clear success message after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (error) {
      console.error('Error uploading logo:', error)
      setUploadError(
        error instanceof Error ? error.message : 'Failed to upload logo',
      )
    } finally {
      setUploading(false)
    }
  }

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileUpload(files[0])
    }
  }

  // File input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFileUpload(files[0])
    }
  }

  // Handle click to open file picker
  const handleClick = () => {
    fileInputRef.current?.click()
  }

  // Don't render if no brand identity data and no website for uploads
  if (!hasLogo && !hasColors && !entityWebsite) {
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
          <div className="group">
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Logo
            </label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
                <Image className="h-4 w-4 text-gray-400" />
              </div>
              <div
                className={`block w-full pl-10 pr-3 py-4 text-sm border-2 rounded-xl bg-gray-50 backdrop-blur-sm cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : uploading
                      ? 'border-orange-300 bg-orange-50'
                      : uploadSuccess
                        ? 'border-green-300 bg-green-50'
                        : uploadError
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleInputChange}
                  className="hidden"
                />

                <div className="flex items-center justify-center min-h-[80px]">
                  {uploading ? (
                    <div className="flex items-center text-orange-600">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mr-2"></div>
                      <span className="text-sm">Uploading...</span>
                    </div>
                  ) : uploadSuccess ? (
                    <div className="flex items-center text-green-600">
                      <Check className="h-5 w-5 mr-2" />
                      <span className="text-sm">
                        Logo uploaded successfully!
                      </span>
                    </div>
                  ) : uploadError ? (
                    <div className="flex items-center text-red-600">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      <span className="text-sm">{uploadError}</span>
                    </div>
                  ) : hasLogo ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={currentLogo}
                        alt={`${entityName || entityType} logo`}
                        className="max-h-16 max-w-full object-contain mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                      <div className="hidden text-gray-500 text-sm mb-2">
                        Logo could not be loaded
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        Drop a new image here or click to replace
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <Upload className="h-8 w-8 mb-2" />
                      <span className="text-sm text-center">
                        {dragActive
                          ? 'Drop your logo here'
                          : 'Drop an image here or click to upload'}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        PNG, JPG, GIF up to 5MB
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {hasLogo
                ? `Current ${entityType} logo`
                : `Upload a logo for ${entityName || entityType}`}
            </p>
          </div>

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
