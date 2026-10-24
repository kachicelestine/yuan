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
export type { Membership, MemberRole } from "./domain/membership";
export type { ApplicationRepository, MembershipRepository } from "./domain/repositories";
