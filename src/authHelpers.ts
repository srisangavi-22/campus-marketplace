import { User } from "firebase/auth";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  campus?: string;
  meetupPreference?: string;
  createdAt?: string;
  isAnonymous?: boolean;
}

export const MEETUP_SPOTS = [
  "North Campus",
  "South Campus",
  "Student Center",
  "Main Library Lobby",
  "Campus Quad",
  "Engineering Building",
  "Science & Tech Atrium",
];

export const DEMO_USER: AppUser = {
  uid: "demo-student-001",
  email: "student@campus.edu",
  displayName: "Jordan Smith",
  phoneNumber: "(555) 234-5678",
  photoURL: null,
  campus: "North Campus",
  meetupPreference: "Student Center",
  createdAt: "September 2024",
  isAnonymous: false,
};

export const NO_FIREBASE_MESSAGE =
  "Firebase is not configured. Running in campus demo mode.";

/**
 * Validates email format according to standard campus/web rules.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  // Standard email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Client-side input validation for login and registration.
 * Returns null if valid, or a user-friendly error message.
 */
export function validateAuthInput(
  mode: "signIn" | "signUp",
  email: string,
  password: string,
  name?: string,
): string | null {
  const trimmedEmail = email.trim();

  // 1. Check email
  if (!trimmedEmail) {
    return "Please enter your email.";
  }

  if (!isValidEmail(trimmedEmail)) {
    return "Please enter a valid email address.";
  }

  // 2. Check name if signing up
  if (mode === "signUp") {
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return "Please enter your name.";
    }
    if (trimmedName.length < 2) {
      return "Name must be at least 2 characters.";
    }
  }

  // 3. Check password
  if (!password) {
    return "Please enter your password.";
  }

  if (mode === "signUp" && password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

/**
 * Converts Firebase error codes and raw exceptions into clean, user-friendly messages.
 * Never exposes raw Firebase error codes (e.g. auth/invalid-credential) to the user.
 */
export function friendlyAuthError(error: unknown): string {
  if (!error) return "";

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  const rawMessage =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/missing-email":
      return "Please enter your email.";

    case "auth/missing-password":
      return "Please enter your password.";

    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Incorrect email or password.";

    case "auth/email-already-in-use":
      return "An account with this email already exists.";

    case "auth/weak-password":
      return "Password must be at least 6 characters.";

    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few minutes and try again.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    case "auth/user-disabled":
      return "This account has been disabled. Please contact campus support.";

    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";

    case "auth/popup-blocked":
      return "Sign-in popup was blocked by your browser. Please allow popups.";

    default:
      if (rawMessage.includes("invalid-credential") || rawMessage.includes("wrong-password")) {
        return "Incorrect email or password.";
      }
      if (rawMessage.includes("email-already-in-use")) {
        return "An account with this email already exists.";
      }
      if (rawMessage.includes("weak-password")) {
        return "Password must be at least 6 characters.";
      }
      if (rawMessage.includes("invalid-email")) {
        return "Please enter a valid email address.";
      }
      return rawMessage.length < 100 && !rawMessage.startsWith("Firebase:")
        ? rawMessage
        : "An unexpected authentication error occurred. Please try again.";
  }
}

/**
 * Transforms a Firebase User object to an AppUser.
 */
export function toAppUser(
  firebaseUser: User,
  extra?: Partial<AppUser>,
): AppUser {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || null,
    displayName: firebaseUser.displayName || null,
    phoneNumber: firebaseUser.phoneNumber || extra?.phoneNumber || null,
    photoURL: firebaseUser.photoURL || null,
    campus: extra?.campus || "North Campus",
    meetupPreference: extra?.meetupPreference || "Student Center",
    createdAt:
      firebaseUser.metadata?.creationTime ||
      new Date().toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
    isAnonymous: firebaseUser.isAnonymous || false,
    ...extra,
  };
}

/* -------------------------------------------------------------
   Session & Demo Persistence (Web & Local Storage)
   Maintains user authentication state across app reload / reopen
---------------------------------------------------------------- */

const SESSION_STORAGE_KEY = "campus_marketplace_auth_user";
const DEMO_ACCOUNTS_KEY = "campus_marketplace_demo_accounts";

export function loadStoredSession(): AppUser | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredSession(user: AppUser | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (user) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or security errors
  }
}

interface DemoAccount {
  user: AppUser;
  passwordHash: string;
}

export function getDemoAccounts(): DemoAccount[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [
      {
        user: DEMO_USER,
        passwordHash: "campus123",
      },
    ];
  }
  try {
    const raw = window.localStorage.getItem(DEMO_ACCOUNTS_KEY);
    if (!raw) {
      const defaultAccounts: DemoAccount[] = [
        {
          user: DEMO_USER,
          passwordHash: "campus123",
        },
      ];
      window.localStorage.setItem(
        DEMO_ACCOUNTS_KEY,
        JSON.stringify(defaultAccounts),
      );
      return defaultAccounts;
    }
    return JSON.parse(raw);
  } catch {
    return [
      {
        user: DEMO_USER,
        passwordHash: "campus123",
      },
    ];
  }
}

export function saveDemoAccounts(accounts: DemoAccount[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota
  }
}

const SAVED_ITEMS_PREFIX = "campus_marketplace_saved_";

export function loadUserSavedIds(userId?: string | null): string[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const key = `${SAVED_ITEMS_PREFIX}${userId || "guest"}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserSavedIds(
  userId: string | null | undefined,
  ids: string[],
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const key = `${SAVED_ITEMS_PREFIX}${userId || "guest"}`;
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Ignore storage quota
  }
}

