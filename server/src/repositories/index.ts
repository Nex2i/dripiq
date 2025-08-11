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
export { EmailSenderIdentityRepository } from './entities/EmailSenderIdentityRepository';
export { ContactCampaignRepository } from './entities/ContactCampaignRepository';
export { CampaignPlanVersionRepository } from './entities/CampaignPlanVersionRepository';
export { ScheduledActionRepository } from './entities/ScheduledActionRepository';
export { OutboundMessageRepository } from './entities/OutboundMessageRepository';
export { MessageEventRepository } from './entities/MessageEventRepository';
export { WebhookDeliveryRepository } from './entities/WebhookDeliveryRepository';
export { InboundMessageRepository } from './entities/InboundMessageRepository';
export { CommunicationSuppressionRepository } from './entities/CommunicationSuppressionRepository';
export { SendRateLimitRepository } from './entities/SendRateLimitRepository';
export { EmailValidationResultRepository } from './entities/EmailValidationResultRepository';
export { ContactChannelRepository } from './entities/ContactChannelRepository';
export { CampaignTransitionRepository } from './entities/CampaignTransitionRepository';

// Transaction repositories
export { LeadTransactionRepository } from './transactions/LeadTransactionRepository';
export { UserInvitationTransactionRepository } from './transactions/UserInvitationTransactionRepository';
export { TenantSetupTransactionRepository } from './transactions/TenantSetupTransactionRepository';
export { SiteEmbeddingTransactionRepository } from './transactions/SiteEmbeddingTransactionRepository';

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
import { EmailSenderIdentityRepository } from './entities/EmailSenderIdentityRepository';
import { ContactCampaignRepository } from './entities/ContactCampaignRepository';
import { CampaignPlanVersionRepository } from './entities/CampaignPlanVersionRepository';
import { ScheduledActionRepository } from './entities/ScheduledActionRepository';
import { OutboundMessageRepository } from './entities/OutboundMessageRepository';
import { MessageEventRepository } from './entities/MessageEventRepository';
import { WebhookDeliveryRepository } from './entities/WebhookDeliveryRepository';
import { InboundMessageRepository } from './entities/InboundMessageRepository';
import { CommunicationSuppressionRepository } from './entities/CommunicationSuppressionRepository';
import { SendRateLimitRepository } from './entities/SendRateLimitRepository';
import { EmailValidationResultRepository } from './entities/EmailValidationResultRepository';
import { ContactChannelRepository } from './entities/ContactChannelRepository';
import { CampaignTransitionRepository } from './entities/CampaignTransitionRepository';
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
const emailSenderIdentityRepository = new EmailSenderIdentityRepository();
const contactCampaignRepository = new ContactCampaignRepository();
const campaignPlanVersionRepository = new CampaignPlanVersionRepository();
const scheduledActionRepository = new ScheduledActionRepository();
const outboundMessageRepository = new OutboundMessageRepository();
const messageEventRepository = new MessageEventRepository();
const webhookDeliveryRepository = new WebhookDeliveryRepository();
const inboundMessageRepository = new InboundMessageRepository();
const communicationSuppressionRepository = new CommunicationSuppressionRepository();
const sendRateLimitRepository = new SendRateLimitRepository();
const emailValidationResultRepository = new EmailValidationResultRepository();
const contactChannelRepository = new ContactChannelRepository();
const campaignTransitionRepository = new CampaignTransitionRepository();

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
  emailSenderIdentity: emailSenderIdentityRepository,
  contactCampaign: contactCampaignRepository,
  campaignPlanVersion: campaignPlanVersionRepository,
  scheduledAction: scheduledActionRepository,
  outboundMessage: outboundMessageRepository,
  messageEvent: messageEventRepository,
  webhookDelivery: webhookDeliveryRepository,
  inboundMessage: inboundMessageRepository,
  communicationSuppression: communicationSuppressionRepository,
  sendRateLimit: sendRateLimitRepository,
  emailValidationResult: emailValidationResultRepository,
  contactChannel: contactChannelRepository,
  campaignTransition: campaignTransitionRepository,

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
  emailSenderIdentityRepository,
  contactCampaignRepository,
  campaignPlanVersionRepository,
  scheduledActionRepository,
  outboundMessageRepository,
  messageEventRepository,
  webhookDeliveryRepository,
  inboundMessageRepository,
  communicationSuppressionRepository,
  sendRateLimitRepository,
  emailValidationResultRepository,
  contactChannelRepository,
  campaignTransitionRepository,
  leadTransactionRepository,
  userInvitationTransactionRepository,
  tenantSetupTransactionRepository,
};

// Default export
export default repositories;
