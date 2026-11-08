// Domain types mirroring the Supabase schema (supabase/migrations).
import type { CompatibilityBreakdown } from "../supabase/functions/_shared/compatibility";

export type Role = "owner" | "verifier" | "admin";
export type Sex = "male" | "female";
export type Size = "small" | "medium" | "large";
export type DocType = "vaccination" | "health_clearance" | "pedigree" | "dna";
export type SubmissionStatus = "owner_submitted" | "vet_verified" | "verification_failed";
export type RequestStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";
export type VerifierRole = "Licensed Veterinarian" | "Certified Breeder";

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  location: string;
  role: Role;
  /** False until the user picks a location (Google sign-ups skip the sign-up form). */
  profile_completed: boolean;
  /** Set while an administrator has suspended the account. */
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
}

export interface OwnerProfile {
  id: number;
  user_id: string;
  display_name: string;
  location: string;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  completed_matches: number;
  verified_at: string | null;
  created_at: string;
}

export type OwnerSummary = Pick<
  OwnerProfile,
  "user_id" | "display_name" | "location" | "avatar_url" | "rating" | "review_count" | "completed_matches" | "verified_at"
>;

export interface VerifierProfile {
  id: string;
  user_id: string;
  name: string;
  role: VerifierRole;
  clinic: string;
  license_number: string;
  rating: number;
  available: boolean;
  approved: boolean;
  /** Set when an admin approved or rejected the application; null while pending. */
  reviewed_at: string | null;
  review_notes: string | null;
  avatar: string | null;
  created_at: string;
}

/** A verifier account as seen by admins (admin_list_verifiers). */
export interface VerifierApplication {
  id: string;
  user_id: string;
  name: string;
  role: VerifierRole;
  clinic: string;
  license_number: string;
  approved: boolean;
  reviewed_at: string | null;
  review_notes: string | null;
  reviewer_name: string | null;
  created_at: string;
  email: string;
  phone: string | null;
  location: string;
  documents_reviewed: number;
}

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface Dog {
  id: string;
  owner_id: string;
  name: string;
  breed: string;
  age: number;
  sex: Sex;
  size: Size;
  color: string;
  temperament: string[];
  description: string;
  /** Trust score 0–100 from verified documents. */
  score: number;
  verified: boolean;
  tier: number;
  verified_docs: DocType[];
  img: string | null;
  photos: string[];
  rating: number;
  reviews: number;
  created_at: string;
  /** Set while an administrator has hidden the listing; only its owner can then read it. */
  hidden_at?: string | null;
  hidden_reason?: string | null;
  /** Set once an administrator confirmed this dog and listing photo are genuine. */
  photo_verified_at?: string | null;
  owner?: OwnerSummary | null;
}

export interface DogInput {
  name: string;
  breed: string;
  age: number;
  sex: Sex;
  size: Size;
  color: string;
  temperament: string[];
  description: string;
  img: string | null;
  photos: string[];
}

export interface MatchRequest {
  id: number;
  dog_id: string;
  requester_dog_id: string | null;
  requester_name: string;
  requester_email: string;
  requester_user_id: string;
  recipient_user_id: string;
  message: string;
  compatibility_score: number | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  dog?: Dog | null;
  requester_dog?: Dog | null;
}

export interface Message {
  id: number;
  match_request_id: number;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Submission {
  id: string;
  dog_id: string;
  owner_id: string;
  verifier_user_id: string;
  verifier_name: string;
  submission_type: DocType;
  document_url: string;
  notes: string | null;
  status: SubmissionStatus;
  reviewed_at: string | null;
  created_at: string;
  dog?: Dog | null;
}

export interface Review {
  id: number;
  match_request_id: number;
  reviewer_id: string;
  reviewee_id: string;
  dog_id: string | null;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: { display_name: string } | null;
  dog?: { name: string } | null;
}

export type NotificationType =
  | "match_request"
  | "request_update"
  | "message"
  | "verification_request"
  | "verification_result"
  | "review"
  | "match_alert"
  | "verifier_application"
  | "verifier_review"
  | "user_report"
  | "photo_verification"
  | "system";

export interface AppNotification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  dog_id: string | null;
  submission_id: string | null;
  actor_id: string | null;
  actor_name: string;
  action: "submitted" | "approved" | "rejected" | "tier_changed";
  details: string;
  created_at: string;
}

export type ReportReason = "scam" | "harassment" | "fake_profile" | "fake_documents" | "animal_welfare" | "spam" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";

/** Someone the signed-in user has blocked (list_my_blocks). */
export interface BlockedUser {
  blocked_id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

/** A report as seen by admins (admin_list_reports). */
export interface UserReport {
  id: number;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
  reporter_id: string;
  reporter_name: string;
  reporter_email: string;
  reported_id: string;
  reported_name: string;
  reported_email: string;
  reported_phone: string | null;
  reported_report_count: number;
  match_request_id: number | null;
  dog_id: string | null;
  dog_name: string | null;
}

export type PhotoVerificationStatus = "awaiting_photo" | "pending" | "approved" | "rejected";

export interface PhotoVerification {
  id: string;
  dog_id: string;
  owner_id: string;
  code: string;
  code_issued_at: string;
  photo_path: string | null;
  status: PhotoVerificationStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

/** A submitted photo as seen by admins (admin_list_photo_verifications). */
export interface AdminPhotoVerification {
  id: string;
  status: Exclude<PhotoVerificationStatus, "awaiting_photo">;
  code: string;
  /** Null once the photo has been deleted after review. */
  photo_path: string | null;
  review_notes: string | null;
  reviewer_name: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  dog_id: string;
  dog_name: string;
  dog_breed: string;
  dog_img: string | null;
  owner_id: string;
  owner_name: string;
}

/** A reported user's account status and dogs (admin_user_moderation). */
export interface UserModeration {
  role: Role;
  suspended_at: string | null;
  suspended_reason: string | null;
  dogs: { id: string; name: string; breed: string; img: string | null; hidden_at: string | null; hidden_reason: string | null }[];
}

/** A hidden listing or suspended account (admin_list_restricted). */
export interface RestrictedItem {
  kind: "dog" | "user";
  target_id: string;
  title: string;
  subtitle: string;
  reason: string | null;
  restricted_at: string;
  restricted_by: string | null;
}

export interface RankedMatch {
  dog: Dog;
  compatibility: CompatibilityBreakdown;
  reasons: string[];
}

export interface Session {
  user: UserProfile;
  owner: OwnerProfile | null;
  verifier: VerifierProfile | null;
}

export type Screen =
  | "boot"
  | "setup-required"
  | "landing"
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email"
  | "home"
  | "match"
  | "filter"
  | "match-profile"
  | "send-request"
  | "conversation"
  | "requests"
  | "dog-profile"
  | "add-dog"
  | "edit-dog"
  | "owner-profile"
  | "verify-upload"
  | "verify-choose"
  | "verify-status"
  | "audit-trail"
  | "reputation"
  | "notifications"
  | "settings"
  | "owner-settings"
  | "edit-profile"
  | "change-password"
  | "vet-dashboard"
  | "vet-requests"
  | "vet-request-detail"
  | "vet-records"
  | "vet-profile"
  | "vet-settings"
  | "vet-professional"
  | "admin-verifiers"
  | "admin-verifier-detail"
  | "admin-reports"
  | "admin-report-detail"
  | "admin-restricted"
  | "admin-photos"
  | "admin-photo-detail"
  | "photo-verification"
  | "blocked-users";
