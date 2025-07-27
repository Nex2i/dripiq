import { useState } from 'react'
import { Package, Plus, X, AlertCircle, Search } from 'lucide-react'
import {
  useLeadProducts,
  useAttachProductsToLead,
  useDetachProductFromLead,
} from '../../hooks/useLeadProductsQuery'
import { useProducts } from '../../hooks/useProductsQuery'
import { useAuth } from '../../contexts/AuthContext'
import type { AttachedProduct } from '../../types/lead.types'

interface ProductsTabProps {
  leadId: string
}

interface AttachProductModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  attachedProductIds: string[]
  onAttach: (productIds: string[]) => void
  isLoading: boolean
}

function AttachProductModal({
  isOpen,
  onClose,
  attachedProductIds,
  onAttach,
  isLoading,
}: AttachProductModalProps) {
  const { user } = useAuth()
  const currentTenantId = user?.tenants?.[0]?.id
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const {
    data: allProducts = [],
    isLoading: isLoadingProducts,
    error: productsError,
  } = useProducts(currentTenantId || '')

  // Filter out already attached products and apply search
  const availableProducts = allProducts.filter(
    (product) =>
      !attachedProductIds.includes(product.id) &&
      (product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        '')
  )

  const handleProductToggle = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const handleAttach = () => {
    if (selectedProductIds.length > 0) {
      onAttach(selectedProductIds)
    }
  }

  const handleClose = () => {
    setSelectedProductIds([])
    setSearchTerm('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 backdrop-blur bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Attach Products to Lead</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
          />
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto mb-4">
          {isLoadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-600)]"></div>
            </div>
          ) : productsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-red-700">Error loading products</span>
              </div>
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No available products</h3>
              <p className="mt-1 text-sm text-gray-500">
                {allProducts.length === 0
                  ? 'No products have been created yet.'
                  : searchTerm
                  ? 'No products match your search.'
                  : 'All products are already attached to this lead.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableProducts.map((product) => (
                <div
                  key={product.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedProductIds.includes(product.id)
                      ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleProductToggle(product.id)}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={() => handleProductToggle(product.id)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{product.title}</h4>
                      {product.description && (
                        <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
          >
            Cancel
          </button>
          <button
            onClick={handleAttach}
            disabled={isLoading || selectedProductIds.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-600)] border border-transparent rounded-md hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? 'Attaching...'
              : `Attach ${selectedProductIds.length} Product${selectedProductIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductCard({
  attachedProduct,
  onDetach,
  isDetaching,
}: {
  attachedProduct: AttachedProduct
  onDetach: (productId: string) => void
  isDetaching: boolean
}) {
  const { product } = attachedProduct

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.title}</h3>
          {product.description && (
            <p className="text-gray-600 mb-3">{product.description}</p>
          )}
          {product.salesVoice && (
            <div className="bg-gray-50 rounded-md p-3 mb-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Sales Voice:</p>
              <p className="text-sm text-gray-600">{product.salesVoice}</p>
            </div>
          )}
          <div className="text-xs text-gray-500">
            Attached: {new Date(attachedProduct.attachedAt).toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={() => onDetach(product.id)}
          disabled={isDetaching}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200 disabled:opacity-50"
          title="Remove product from lead"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function ProductsTab({ leadId }: ProductsTabProps) {
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false)

  const {
    data: attachedProducts = [],
    isLoading,
    error,
  } = useLeadProducts(leadId)

  const attachProductsMutation = useAttachProductsToLead()
  const detachProductMutation = useDetachProductFromLead()

  const attachedProductIds = attachedProducts.map((ap) => ap.product.id)

  const handleAttachProducts = async (productIds: string[]) => {
    try {
      await attachProductsMutation.mutateAsync({
        leadId,
        data: { productIds },
      })
      setIsAttachModalOpen(false)
    } catch (error) {
      console.error('Error attaching products:', error)
    }
  }

  const handleDetachProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to remove this product from the lead?')) return

    try {
      await detachProductMutation.mutateAsync({ leadId, productId })
    } catch (error) {
      console.error('Error detaching product:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-700">Error loading attached products</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Attached Products ({attachedProducts.length})
          </h3>
          <p className="text-sm text-gray-600">
            Products that are relevant to this lead opportunity
          </p>
        </div>
        <button
          onClick={() => setIsAttachModalOpen(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-600)] border border-transparent rounded-md hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Attach Products
        </button>
      </div>

      {/* Products List */}
      {attachedProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No products attached</h3>
          <p className="mt-1 text-sm text-gray-500">
            Attach products to help qualify this lead opportunity.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setIsAttachModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Attach Products
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {attachedProducts.map((attachedProduct) => (
            <ProductCard
              key={attachedProduct.id}
              attachedProduct={attachedProduct}
              onDetach={handleDetachProduct}
              isDetaching={detachProductMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Attach Product Modal */}
      <AttachProductModal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        leadId={leadId}
        attachedProductIds={attachedProductIds}
        onAttach={handleAttachProducts}
        isLoading={attachProductsMutation.isPending}
      />
    </div>
  )
}