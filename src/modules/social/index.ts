// Public surface of the social context: people's public profiles and who follows whom.
export { makeProfiles, type ActorView, type FollowError, type ProfilePageView, type Profiles, type ProfilesDeps, type ProfileView } from "./application/profiles";
export { defaultHandle, editProfile, longDefaultHandle, HANDLE, isHandle, MAX_BIO, MAX_NAME, newProfile, type Follow, type Profile, type ProfileError, type ProfileInput } from "./domain/profile";
export type { FollowCounts, FollowRepository, ProfileRepository } from "./domain/repositories";
