// Public surface of the merchants context: applying to sell, reviews, and who runs which shop.
export { makeOnboarding, type ApplicationView, type Onboarding, type OnboardingDeps, type OnboardingError, type OnboardingScope, type ReviewView, type ShopOpener } from "./application/onboarding";
export {
  checkBusiness,
  documentLabel,
  DOCUMENT_KINDS,
  HANDLE,
  REQUIRED_DOCUMENTS,
  type Application,
  type ApplicationApproved,
  type ApplicationError,
  type ApplicationRejected,
  type ApplicationStatus,
  type ApplicationSubmitted,
  type BusinessDetails,
  type DocumentKind,
  type KycDocument,
} from "./domain/application";
export { INVITE_DAYS, invite, isOpen as isInvitationOpen, MAX_TEAM, type Invitation, type Membership, type MemberRole, type TeamError } from "./domain/membership";
export { makeTeam, type InvitationView, type MemberView, type Team, type TeamDeps } from "./application/team";
export type { ApplicationRepository, InvitationRepository, MembershipRepository } from "./domain/repositories";
