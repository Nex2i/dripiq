import React from 'react'
import BrandIdentity from '../BrandIdentity'

interface BrandingTabProps {
  logo?: string | null
  brandColors?: string[]
  entityName: string
  entityType?: 'lead' | 'organization'
  entityWebsite?: string
  onBrandColorsUpdate?: (newBrandColors: string[]) => void
}

const BrandingTab: React.FC<BrandingTabProps> = ({
  logo,
  brandColors,
  entityName,
  entityType = 'lead',
  entityWebsite,
  onBrandColorsUpdate,
}) => {
  return (
    <BrandIdentity
      logo={logo}
      brandColors={brandColors}
      entityName={entityName}
      entityType={entityType}
      entityWebsite={entityWebsite}
      onBrandColorsUpdate={onBrandColorsUpdate}
    />
  )
}

export default BrandingTab