// Repository exports
import { UserRepository } from './user.repository';
import { TenantRepository } from './tenant.repository';
import { RoleRepository } from './role.repository';
import { PermissionRepository } from './permission.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { UserTenantRepository } from './user-tenant.repository';
import { LeadPointOfContactRepository } from './lead-point-of-contact.repository';
import { LeadStatusRepository } from './lead-status.repository';
import { LeadProductRepository } from './lead-product.repository';
import { SiteEmbeddingDomainRepository } from './site-embedding-domain.repository';
import { LeadRepository } from './lead.repository';
import { ProductRepository } from './product.repository';
import { SiteEmbeddingRepository } from './site-embedding.repository';
import { TransactionRepository } from './transaction.repository';

// Base repository exports
export { BaseRepository, IRepository, ITenantScopedRepository } from './base.repository';

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
export const transactionRepository = new TransactionRepository();
