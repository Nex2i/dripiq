// Base repositories
export { BaseRepository } from './base/BaseRepository';
export { TenantAwareRepository } from './base/TenantAwareRepository';

// Entity repositories
export { UserRepository } from './entities/UserRepository';
export { TenantRepository } from './entities/TenantRepository';
export { RoleRepository } from './entities/RoleRepository';
export { PermissionRepository } from './entities/PermissionRepository';
export { RolePermissionRepository } from './entities/RolePermissionRepository';
export { LeadRepository } from './entities/LeadRepository';
export { ProductRepository } from './entities/ProductRepository';
export { LeadPointOfContactRepository } from './entities/LeadPointOfContactRepository';
export { LeadStatusRepository } from './entities/LeadStatusRepository';
export { LeadProductRepository } from './entities/LeadProductRepository';
export { UserTenantRepository } from './entities/UserTenantRepository';
export { SiteEmbeddingDomainRepository } from './entities/SiteEmbeddingDomainRepository';
export { SiteEmbeddingRepository } from './entities/SiteEmbeddingRepository';

// Transaction repositories
export { LeadTransactionRepository } from './transactions/LeadTransactionRepository';
export { UserInvitationTransactionRepository } from './transactions/UserInvitationTransactionRepository';
export { TenantSetupTransactionRepository } from './transactions/TenantSetupTransactionRepository';

// Export types from entity repositories
export type { LeadWithOwner, LeadSearchOptions } from './entities/LeadRepository';
export type { UserTenantWithDetails } from './entities/UserTenantRepository';
export type { RoleWithPermissions, PermissionWithRoles } from './entities/RolePermissionRepository';
export type { LeadProductWithDetails } from './entities/LeadProductRepository';
export type {
  EmbeddingSearchOptions,
  EmbeddingWithDomain,
} from './entities/SiteEmbeddingRepository';

// Export types from transaction repositories
export type {
  CreateLeadWithContactsData,
  LeadCreationResult,
  BulkLeadCreationData,
  BulkLeadCreationResult,
} from './transactions/LeadTransactionRepository';

export type {
  InviteUserData,
  InviteUserResult,
  BulkInviteData,
  BulkInviteResult,
} from './transactions/UserInvitationTransactionRepository';

export type {
  CreateTenantWithOwnerData,
  TenantSetupResult,
  TenantWithInitialSetupData,
  CompleteSetupResult,
} from './transactions/TenantSetupTransactionRepository';

// Import all repository classes first
import { UserRepository } from './entities/UserRepository';
import { TenantRepository } from './entities/TenantRepository';
import { RoleRepository } from './entities/RoleRepository';
import { PermissionRepository } from './entities/PermissionRepository';
import { RolePermissionRepository } from './entities/RolePermissionRepository';
import { LeadRepository } from './entities/LeadRepository';
import { ProductRepository } from './entities/ProductRepository';
import { LeadPointOfContactRepository } from './entities/LeadPointOfContactRepository';
import { LeadStatusRepository } from './entities/LeadStatusRepository';
import { LeadProductRepository } from './entities/LeadProductRepository';
import { UserTenantRepository } from './entities/UserTenantRepository';
import { SiteEmbeddingDomainRepository } from './entities/SiteEmbeddingDomainRepository';
import { SiteEmbeddingRepository } from './entities/SiteEmbeddingRepository';
import { LeadTransactionRepository } from './transactions/LeadTransactionRepository';
import { UserInvitationTransactionRepository } from './transactions/UserInvitationTransactionRepository';
import { TenantSetupTransactionRepository } from './transactions/TenantSetupTransactionRepository';

// Repository instances - Singleton pattern for easy access
const userRepository = new UserRepository();
const tenantRepository = new TenantRepository();
const roleRepository = new RoleRepository();
const permissionRepository = new PermissionRepository();
const rolePermissionRepository = new RolePermissionRepository();
const leadRepository = new LeadRepository();
const productRepository = new ProductRepository();
const leadPointOfContactRepository = new LeadPointOfContactRepository();
const leadStatusRepository = new LeadStatusRepository();
const leadProductRepository = new LeadProductRepository();
const userTenantRepository = new UserTenantRepository();
const siteEmbeddingDomainRepository = new SiteEmbeddingDomainRepository();
const siteEmbeddingRepository = new SiteEmbeddingRepository();

// Transaction repository instances
const leadTransactionRepository = new LeadTransactionRepository();
const userInvitationTransactionRepository = new UserInvitationTransactionRepository();
const tenantSetupTransactionRepository = new TenantSetupTransactionRepository();

// Export repository instances
export const repositories = {
  // Entity repositories
  user: userRepository,
  tenant: tenantRepository,
  role: roleRepository,
  permission: permissionRepository,
  rolePermission: rolePermissionRepository,
  lead: leadRepository,
  product: productRepository,
  leadPointOfContact: leadPointOfContactRepository,
  leadStatus: leadStatusRepository,
  leadProduct: leadProductRepository,
  userTenant: userTenantRepository,
  siteEmbeddingDomain: siteEmbeddingDomainRepository,
  siteEmbedding: siteEmbeddingRepository,

  // Transaction repositories
  leadTransaction: leadTransactionRepository,
  userInvitationTransaction: userInvitationTransactionRepository,
  tenantSetupTransaction: tenantSetupTransactionRepository,
};

// Export individual repository instances for direct import
export {
  userRepository,
  tenantRepository,
  roleRepository,
  permissionRepository,
  rolePermissionRepository,
  leadRepository,
  productRepository,
  leadPointOfContactRepository,
  leadStatusRepository,
  leadProductRepository,
  userTenantRepository,
  siteEmbeddingDomainRepository,
  siteEmbeddingRepository,
  leadTransactionRepository,
  userInvitationTransactionRepository,
  tenantSetupTransactionRepository,
};

// Default export
export default repositories;
