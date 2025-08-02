import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsService, productQueryKeys } from '../services/products.service'
import type {
  Product,
  CreateProductData,
  UpdateProductData,
} from '../services/products.service'

// Hook to get all products for a tenant
export function useProducts(tenantId: string) {
  return useQuery({
    queryKey: productQueryKeys.list(tenantId),
    queryFn: () => productsService.getProducts(),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Hook to get a single product
export function useProduct(id: string) {
  return useQuery({
    queryKey: productQueryKeys.detail(id),
    queryFn: () => productsService.getProduct(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Hook to create a product
export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      tenantId,
      data,
    }: {
      tenantId: string
      data: CreateProductData
    }) => productsService.createProduct(tenantId, data),
    onSuccess: (newProduct: Product) => {
      // Add the new product to the list cache
      queryClient.setQueryData(
        productQueryKeys.list(newProduct.tenantId),
        (oldData: Product[] | undefined) => {
          return oldData ? [...oldData, newProduct] : [newProduct]
        },
      )

      // Invalidate products cache to ensure consistency
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      })
    },
    onError: (error) => {
      console.error('Error creating product:', error)
    },
  })
}

// Hook to update a product
export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) =>
      productsService.updateProduct(id, data),
    onSuccess: (updatedProduct: Product) => {
      // Update the product detail cache
      queryClient.setQueryData(
        productQueryKeys.detail(updatedProduct.id),
        updatedProduct,
      )

      // Update the product in the list cache
      queryClient.setQueryData(
        productQueryKeys.list(updatedProduct.tenantId),
        (oldData: Product[] | undefined) => {
          if (!oldData) return [updatedProduct]
          return oldData.map((product) =>
            product.id === updatedProduct.id ? updatedProduct : product,
          )
        },
      )

      // Invalidate products cache to ensure consistency
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      })
    },
    onError: (error) => {
      console.error('Error updating product:', error)
    },
  })
}

// Hook to delete a product
export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => productsService.deleteProduct(id),
    onSuccess: (_, deletedProductId) => {
      // Remove the product from all list caches
      queryClient.setQueriesData(
        { queryKey: productQueryKeys.lists() },
        (oldData: Product[] | undefined) => {
          if (!oldData) return []
          return oldData.filter((product) => product.id !== deletedProductId)
        },
      )

      // Remove the product detail cache
      queryClient.removeQueries({
        queryKey: productQueryKeys.detail(deletedProductId),
      })

      // Invalidate products cache to ensure consistency
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      })
    },
    onError: (error) => {
      console.error('Error deleting product:', error)
    },
  })
}

// Hook to invalidate products data (useful for manual refresh)
export function useInvalidateProducts() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({
      queryKey: productQueryKeys.all,
    })
  }
}
