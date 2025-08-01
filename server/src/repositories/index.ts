// Base repository exports
export { BaseRepository, IRepository, ITenantScopedRepository } from './base.repository';

// Repository exports
export { UserRepository } from './user.repository';
export { TenantRepository, TenantWithUsers } from './tenant.repository';
export { ProductRepository } from './product.repository';
export { RoleRepository } from './role.repository';
export { PermissionRepository } from './permission.repository';
export { RolePermissionRepository, RoleWithPermissions } from './role-permission.repository';
export { UserTenantRepository, UserTenantWithDetails } from './user-tenant.repository';
export { LeadRepository, LeadWithOwner, LeadWithDetails } from './lead.repository';
export { LeadPointOfContactRepository } from './lead-point-of-contact.repository';
export { LeadStatusRepository } from './lead-status.repository';
export { LeadProductRepository, LeadProductWithDetails } from './lead-product.repository';
export { SiteEmbeddingDomainRepository } from './site-embedding-domain.repository';
export { SiteEmbeddingRepository, SiteEmbeddingWithDomain } from './site-embedding.repository';

// Repository instances for dependency injection
export const userRepository = new UserRepository();
export const tenantRepository = new TenantRepository();
export const productRepository = new ProductRepository();
export const roleRepository = new RoleRepository();
export const permissionRepository = new PermissionRepository();
export const rolePermissionRepository = new RolePermissionRepository();
export const userTenantRepository = new UserTenantRepository();
export const leadRepository = new LeadRepository();
export const leadPointOfContactRepository = new LeadPointOfContactRepository();
export const leadStatusRepository = new LeadStatusRepository();
export const leadProductRepository = new LeadProductRepository();
export const siteEmbeddingDomainRepository = new SiteEmbeddingDomainRepository();
export const siteEmbeddingRepository = new SiteEmbeddingRepository();