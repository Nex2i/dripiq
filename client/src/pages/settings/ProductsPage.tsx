import { useState, useEffect } from 'react'
import { Package, Plus, Edit, Trash2, AlertCircle } from 'lucide-react'
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '../../hooks/useProductsQuery'
import { useAuth } from '../../contexts/AuthContext'
import type {
  Product,
  CreateProductData,
  UpdateProductData,
} from '../../services/products.service'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  onCreate: (data: CreateProductData) => Promise<void>
  onUpdate: (data: UpdateProductData) => Promise<void>
  isLoading: boolean
}

function ProductModal({
  isOpen,
  onClose,
  product,
  onCreate,
  onUpdate,
  isLoading,
}: ProductModalProps) {
  const [formData, setFormData] = useState({
    title: product?.title || '',
    description: product?.description || '',
    salesVoice: product?.salesVoice || '',
  })

  // Update form data when product prop changes
  useEffect(() => {
    setFormData({
      title: product?.title || '',
      description: product?.description || '',
      salesVoice: product?.salesVoice || '',
    })
  }, [product])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (product) {
      onUpdate(formData as UpdateProductData)
    } else {
      onCreate(formData as CreateProductData)
    }
  }

  const handleClose = () => {
    setFormData({
      title: product?.title || '',
      description: product?.description || '',
      salesVoice: product?.salesVoice || '',
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 backdrop-blur bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-4/5 mx-4 min-h-[50vh] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {product ? 'Edit Product' : 'Create Product'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
                // Auto-resize textarea
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              rows={3}
              style={{ resize: 'none', overflow: 'hidden' }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="salesVoice"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Sales Voice
            </label>
            <textarea
              id="salesVoice"
              value={formData.salesVoice}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, salesVoice: e.target.value }))
                // Auto-resize textarea
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              rows={3}
              style={{ resize: 'none', overflow: 'hidden' }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
              placeholder="How would you describe this product to a potential customer?"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-600)] border border-transparent rounded-md hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : product ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const { user } = useAuth()
  const currentTenantId = user?.tenants?.[0]?.id

  const {
    data: products,
    isLoading,
    error,
  } = useProducts(currentTenantId || '')

  const createProductMutation = useCreateProduct()
  const updateProductMutation = useUpdateProduct()
  const deleteProductMutation = useDeleteProduct()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const handleCreateProduct = async (data: CreateProductData) => {
    if (!currentTenantId) return

    try {
      await createProductMutation.mutateAsync({
        tenantId: currentTenantId,
        data,
      })
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error creating product:', error)
    }
  }

  const handleUpdateProduct = async (data: UpdateProductData) => {
    if (!editingProduct) return

    try {
      await updateProductMutation.mutateAsync({ id: editingProduct.id, data })
      setIsModalOpen(false)
      setEditingProduct(null)
    } catch (error) {
      console.error('Error updating product:', error)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await deleteProductMutation.mutateAsync(productId)
    } catch (error) {
      console.error('Error deleting product:', error)
    }
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  const openCreateModal = () => {
    setEditingProduct(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  if (!currentTenantId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
          <span className="text-yellow-700">
            No tenant found. Please contact support.
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-700">Error loading products</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-primary-400)] to-[var(--color-primary-600)] rounded-lg flex items-center justify-center shadow-md">
              <Package className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          </div>

          {/* Create Button */}
          <button
            onClick={openCreateModal}
            className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white 
                     bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] 
                     rounded-lg shadow-sm hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-800)] 
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]
                     transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Manage your organization's products and their sales messaging
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
        </div>
      )}

      {/* Products List */}
      {!isLoading && products && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No products
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first product.
              </p>
              <div className="mt-6">
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" />
                  Add Product
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {product.title}
                      </h3>
                      {product.description && (
                        <p className="text-gray-600 mb-3">
                          {product.description}
                        </p>
                      )}
                      {product.salesVoice && (
                        <div className="bg-gray-50 rounded-md p-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            Sales Voice:
                          </p>
                          <p className="text-sm text-gray-600">
                            {product.salesVoice}
                          </p>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-gray-500">
                        Created:{' '}
                        {new Date(product.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 text-gray-400 hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] rounded-md transition-colors duration-200"
                        title="Edit product"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200 disabled:opacity-50"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={closeModal}
        product={editingProduct}
        onCreate={handleCreateProduct}
        onUpdate={handleUpdateProduct}
        isLoading={
          createProductMutation.isPending || updateProductMutation.isPending
        }
      />
    </div>
  )
}
