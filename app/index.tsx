import { Fragment, type ReactNode } from "react";
import { AdminVerifierDetail, AdminVerifiers } from "../components/Admin";
import { BootScreen, ForgotPassword, Landing, Login, Register, ResetPassword, SetupRequired, VerifyEmail } from "../components/Auth";
import {
  ChangePasswordScreen,
  EditProfileScreen,
  NotificationsScreen,
  ReputationScreen,
  SettingsScreen,
} from "../components/Community";
import { ConversationScreen, RequestsScreen } from "../components/Conversation";
import { FilterScreen, HomeScreen, MatchScreen } from "../components/Home";
import { AddDog, DogProfile, EditDog, MatchProfileScreen, OwnerProfile, OwnerSettings, SendRequest } from "../components/Profile";
import { Loading } from "../components/ui";
import { AuditTrailScreen, VerifyChoose, VerifyStatus, VerifyUpload } from "../components/Verify";
import {
  VetDashboard,
  VetProfessionalDetails,
  VetProfile,
  VetRequestDetail,
  VetRequests,
  VetRecords,
  VetSettings,
} from "../components/Veterinarian";
import { isVetPortal, useApp } from "../contexts/AppContext";
import { useThemePreference } from "../contexts/ThemeContext";
import { Shell } from "../navigation/Shell";
import type { Screen } from "../types";

const PUBLIC_SCREENS: Partial<Record<Screen, () => ReactNode>> = {
  boot: () => <BootScreen />,
  "setup-required": () => <SetupRequired />,
  landing: () => <Landing />,
  login: () => <Login />,
  register: () => <Register />,
  "forgot-password": () => <ForgotPassword />,
  "reset-password": () => <ResetPassword />,
  "verify-email": () => <VerifyEmail />,
};

const OWNER_SCREENS: Partial<Record<Screen, () => ReactNode>> = {
  home: () => <HomeScreen />,
  match: () => <MatchScreen />,
  filter: () => <FilterScreen />,
  "match-profile": () => <MatchProfileScreen />,
  "send-request": () => <SendRequest />,
  conversation: () => <ConversationScreen />,
  requests: () => <RequestsScreen />,
  "dog-profile": () => <DogProfile />,
  "add-dog": () => <AddDog />,
  "edit-dog": () => <EditDog />,
  "owner-profile": () => <OwnerProfile />,
  "owner-settings": () => <OwnerSettings />,
  "verify-upload": () => <VerifyUpload />,
  "verify-choose": () => <VerifyChoose />,
  "verify-status": () => <VerifyStatus />,
  reputation: () => <ReputationScreen />,
};

const VET_SCREENS: Partial<Record<Screen, () => ReactNode>> = {
  "vet-dashboard": () => <VetDashboard />,
  "vet-requests": () => <VetRequests />,
  "vet-request-detail": () => <VetRequestDetail />,
  "vet-records": () => <VetRecords />,
  "vet-profile": () => <VetProfile />,
  "vet-settings": () => <VetSettings />,
  "vet-professional": () => <VetProfessionalDetails />,
};

const ADMIN_SCREENS: Partial<Record<Screen, () => ReactNode>> = {
  "admin-verifiers": () => <AdminVerifiers />,
  "admin-verifier-detail": () => <AdminVerifierDetail />,
};

const SHARED_SCREENS: Partial<Record<Screen, () => ReactNode>> = {
  notifications: () => <NotificationsScreen />,
  settings: () => <SettingsScreen />,
  "edit-profile": () => <EditProfileScreen />,
  "change-password": () => <ChangePasswordScreen />,
  "audit-trail": () => <AuditTrailScreen />,
};

function PageRenderer() {
  const { screen, params, session, portal } = useApp();

  const publicPage = PUBLIC_SCREENS[screen];
  if (publicPage) return <>{publicPage()}</>;

  // Signed-in screens never render without a session (e.g. mid sign-out).
  if (!session) return <Loading />;

  const isOwner = !!session.owner;
  const isVerifier = !!session.verifier;
  const isAdmin = session.user.role === "admin";
  const page =
    SHARED_SCREENS[screen] ??
    (isOwner ? OWNER_SCREENS[screen] : undefined) ??
    (isVerifier ? VET_SCREENS[screen] : undefined) ??
    (isAdmin ? ADMIN_SCREENS[screen] : undefined);

  if (!page) return isVetPortal(session, portal) ? <VetDashboard /> : <HomeScreen />;
  // Remount screens when their params change so data reloads.
  return <Fragment key={`${screen}:${JSON.stringify(params)}`}>{page()}</Fragment>;
}

export default function Index() {
  const { scheme } = useThemePreference();
  // Screens read the palette while rendering, so remount them when the theme changes.
  // Navigation, session and notifications live above this in AppProvider and are kept.
  return (
    <Shell key={scheme}>
      <PageRenderer />
    </Shell>
  );
}
