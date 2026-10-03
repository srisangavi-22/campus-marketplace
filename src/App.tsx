import { StatusBar } from "expo-status-bar";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "./components/EmptyState";
import { ExplorePage } from "./pages/ExplorePage";
import { MessagesPage } from "./pages/MessagesPage";
import { MyListingsPage } from "./pages/MyListingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SavedPage } from "./pages/SavedPage";
import { seedListings } from "./data";
import { auth, db, firebaseConfigured } from "./firebase";
import { Listing, Tab } from "./types";
import {
  AppUser,
  DEMO_USER,
  NO_FIREBASE_MESSAGE,
  friendlyAuthError,
  toAppUser,
  validateAuthInput,
  loadStoredSession,
  saveStoredSession,
  getDemoAccounts,
  saveDemoAccounts,
  loadUserSavedIds,
  saveUserSavedIds,
} from "./authHelpers";

async function registerUser(user: AppUser) {
  if (!db) return;

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      displayName:
        user.displayName ||
        user.email?.split("@")[0] ||
        "Campus student",
      email: user.email || "",
      phoneNumber: user.phoneNumber || null,
      photoURL: user.photoURL || null,
      campus: user.campus || "North Campus",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/* Persist profile edits to Firebase Auth + Firestore */
async function saveProfileRemote(
  uid: string,
  displayName: string,
  meetupPreference: string,
  phoneNumber?: string,
) {
  if (auth?.currentUser) {
    await updateProfile(auth.currentUser, { displayName });
  }

  if (db) {
    await setDoc(
      doc(db, "users", uid),
      {
        displayName,
        meetupPreference,
        phoneNumber: phoneNumber || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Explore");
  const [items, setItems] = useState(seedListings);
  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState("All items");
  // Initialize savedIds for the active user (default is empty: [])
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    const initialUser = auth?.currentUser
      ? toAppUser(auth.currentUser)
      : loadStoredSession();
    return loadUserSavedIds(initialUser?.uid);
  });
  const [selected, setSelected] = useState<Listing | null>(null);

  // Initialize user from existing Firebase auth or local stored session
  const [user, setUser] = useState<AppUser | null>(() => {
    if (auth?.currentUser) {
      return toAppUser(auth.currentUser);
    }
    return loadStoredSession();
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"signIn" | "signUp">("signIn");
  const [sellOpen, setSellOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [meetup, setMeetup] = useState(
    user?.meetupPreference || user?.campus || "North Campus",
  );

  /* Load saved items for the current user (from Firestore if connected, else local storage) */
  useEffect(() => {
    if (db && user && user.uid !== DEMO_USER.uid) {
      const savedQuery = collection(db, "users", user.uid, "saved");
      return onSnapshot(
        savedQuery,
        (snapshot) => {
          const ids = snapshot.docs.map((docSnap) => docSnap.id);
          setSavedIds(ids);
          saveUserSavedIds(user.uid, ids);
        },
        () => {
          setSavedIds(loadUserSavedIds(user.uid));
        },
      );
    } else {
      setSavedIds(loadUserSavedIds(user?.uid));
    }
  }, [user?.uid]);

  /* Keep user in sync with Firebase if configured */
  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) {
      // Local demo mode: restore session if stored
      const stored = loadStoredSession();
      if (stored) {
        setUser(stored);
        setMeetup(stored.meetupPreference || stored.campus || "North Campus");
      }
      return;
    }

    getRedirectResult(firebaseAuth).catch((error) => {
      const message = friendlyAuthError(error);
      if (message) setAuthError(message);
    });

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!nextUser) {
        setUser(null);
        saveStoredSession(null);
        setProfileReady(false);
        return;
      }

      const next = toAppUser(nextUser);
      setUser(next);
      saveStoredSession(next);

      registerUser(next)
        .then(() => setProfileReady(true))
        .catch((error) => setAuthError(friendlyAuthError(error)));
    });
  }, []);

  /* Load saved meetup preference from Firestore */
  useEffect(() => {
    if (!db || !user || user.uid === DEMO_USER.uid) return;

    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const saved = snapshot.data()?.meetupPreference;
        if (typeof saved === "string") setMeetup(saved);
      },
      () => undefined,
    );
  }, [user?.uid]);

  /* Load listings from Firestore */
  useEffect(() => {
    if (!db) return;

    const listingsQuery = query(
      collection(db, "listings"),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(
      listingsQuery,
      (snapshot) =>
        setItems(
          snapshot.empty
            ? seedListings
            : snapshot.docs.map(
                (entry) =>
                  ({
                    id: entry.id,
                    ...entry.data(),
                  }) as Listing,
              ),
        ),
      () => setItems(seedListings),
    );
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "All items" || item.category === category) &&
          item.title.toLowerCase().includes(queryText.toLowerCase()),
      ),
    [category, items, queryText],
  );

  const myListings = useMemo(
    () =>
      user ? items.filter((item) => item.sellerId === user.uid) : [],
    [items, user],
  );

  const toggleSaved = async (id: string) => {
    const isSaved = savedIds.includes(id);
    const next = isSaved
      ? savedIds.filter((value) => value !== id)
      : [...savedIds, id];

    setSavedIds(next);
    saveUserSavedIds(user?.uid, next);

    if (db && user && user.uid !== DEMO_USER.uid) {
      const savedRef = doc(db, "users", user.uid, "saved", id);
      try {
        if (isSaved) {
          await deleteDoc(savedRef);
        } else {
          await setDoc(savedRef, { savedAt: serverTimestamp() });
        }
      } catch {
        // Handled silently
      }
    }
  };

  /* ---------- Auth actions ---------- */

  const openAuth = (mode: "signIn" | "signUp" = "signIn") => {
    setAuthInitialMode(mode);
    setAuthError("");
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setAuthOpen(false);
    setAuthError("");
  };

  const signInWithGoogle = async () => {
    if (!auth) {
      continueAsGuest();
      return;
    }

    setAuthError("");
    setAuthBusy(true);

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setAuthOpen(false);
    } catch (error) {
      const code = (error as { code?: string })?.code;

      if (code === "auth/popup-blocked") {
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      }

      setAuthError(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const signInWithEmail = async (
    mode: "signIn" | "signUp",
    email: string,
    password: string,
    name: string,
    phone?: string,
  ) => {
    // 1. Client-side input validation
    const validationError = validateAuthInput(mode, email, password, name);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setAuthError("");
    setAuthBusy(true);

    try {
      if (auth) {
        // Live Firebase Auth
        if (mode === "signUp") {
          const credential = await createUserWithEmailAndPassword(
            auth,
            email.trim(),
            password,
          );

          if (name.trim()) {
            await updateProfile(credential.user, {
              displayName: name.trim(),
            });
          }

          const created = toAppUser(credential.user, {
            phoneNumber: phone?.trim() || null,
          });
          setUser(created);
          saveStoredSession(created);
          await registerUser(created).catch(() => undefined);
        } else {
          const credential = await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password,
          );
          const loggedIn = toAppUser(credential.user);
          setUser(loggedIn);
          saveStoredSession(loggedIn);
        }

        setAuthOpen(false);
      } else {
        // Campus Demo Mode Simulation (realistic latency for loading spinner)
        await new Promise((resolve) => setTimeout(resolve, 600));

        const accounts = getDemoAccounts();
        const normalizedEmail = email.trim().toLowerCase();

        if (mode === "signUp") {
          const exists = accounts.some(
            (acc) => acc.user.email?.toLowerCase() === normalizedEmail,
          );
          if (exists) {
            throw { code: "auth/email-already-in-use" };
          }

          const newUser: AppUser = {
            uid: `student-${Date.now()}`,
            email: email.trim(),
            displayName: name.trim(),
            phoneNumber: phone?.trim() || null,
            photoURL: null,
            campus: "North Campus",
            meetupPreference: "Student Center",
            createdAt: new Date().toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            isAnonymous: false,
          };

          accounts.push({
            user: newUser,
            passwordHash: password,
          });
          saveDemoAccounts(accounts);
          setUser(newUser);
          saveStoredSession(newUser);
          setAuthOpen(false);
        } else {
          const account = accounts.find(
            (acc) => acc.user.email?.toLowerCase() === normalizedEmail,
          );
          if (!account || account.passwordHash !== password) {
            throw { code: "auth/invalid-credential" };
          }

          setUser(account.user);
          saveStoredSession(account.user);
          setMeetup(account.user.meetupPreference || "North Campus");
          setAuthOpen(false);
        }
      }
    } catch (error) {
      setAuthError(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!email.trim()) {
      setAuthError("Please enter your email.");
      return false;
    }

    setAuthError("");

    if (!auth) {
      // Demo password reset simulation
      await new Promise((resolve) => setTimeout(resolve, 400));
      return true;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (error) {
      setAuthError(friendlyAuthError(error));
      return false;
    }
  };

  /* Demo mode: lets the app work end-to-end without Firebase keys */
  const continueAsGuest = () => {
    setUser(DEMO_USER);
    saveStoredSession(DEMO_USER);
    setMeetup(DEMO_USER.meetupPreference || "Student Center");
    closeAuth();
  };

  const handleSignOut = async () => {
    try {
      if (auth) await signOut(auth);
    } catch (error) {
      setAuthError(friendlyAuthError(error));
      return;
    }

    setUser(null);
    saveStoredSession(null);
    setProfileReady(false);
    setMeetup("North Campus");
    setSavedIds(loadUserSavedIds(null));
  };

  const handleUpdateProfile = async (
    displayName: string,
    meetupPreference: string,
    phoneNumber?: string,
  ) => {
    if (!user) throw new Error("Please sign in first.");

    if (auth?.currentUser && user.uid !== DEMO_USER.uid) {
      await saveProfileRemote(user.uid, displayName, meetupPreference, phoneNumber);
    }

    const updatedUser: AppUser = {
      ...user,
      displayName,
      meetupPreference,
      phoneNumber: phoneNumber !== undefined ? phoneNumber : user.phoneNumber,
    };

    setUser(updatedUser);
    setMeetup(meetupPreference);
    saveStoredSession(updatedUser);

    // Update demo accounts registry if in demo mode
    const demoAccounts = getDemoAccounts();
    const idx = demoAccounts.findIndex((acc) => acc.user.uid === user.uid);
    if (idx !== -1) {
      demoAccounts[idx].user = updatedUser;
      saveDemoAccounts(demoAccounts);
    }
  };

  /* ---------- Marketplace actions ---------- */

  const publish = async (
    title: string,
    price: string,
    listingCategory: string,
  ) => {
    if (!user) {
      setSellOpen(false);
      openAuth("signIn");
      return;
    }

    const listing = {
      title,
      price: Number(price),
      category: listingCategory,
      seller: user.displayName || user.email || "Campus Student",
      sellerId: user.uid,
      campus: meetup,
      condition: "Good condition",
      image: seedListings[0].image,
      description: "Available for pickup around campus.",
    };

    if (db && user.uid !== DEMO_USER.uid) {
      await addDoc(collection(db, "listings"), {
        ...listing,
        createdAt: serverTimestamp(),
      });
    } else {
      setItems((current) => [
        { id: `local-${Date.now()}`, ...listing } as Listing,
        ...current,
      ]);
    }

    setSellOpen(false);
  };

  const contactSeller = () => {
    if (!user) {
      openAuth("signIn");
      return;
    }

    setSelected(null);
    setTab("Messages");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {tab === "Explore" && (
        <ExplorePage
          items={filteredItems}
          query={queryText}
          category={category}
          savedIds={savedIds}
          user={user}
          onQueryChange={setQueryText}
          onCategoryChange={setCategory}
          onSave={toggleSaved}
          onOpen={setSelected}
          onProfile={() => setTab("Profile")}
        />
      )}

      {tab === "Saved" && (
        <SavedPage
          items={items.filter((item) => savedIds.includes(item.id))}
          onSave={toggleSaved}
          onOpen={setSelected}
        />
      )}

      {tab === "Messages" && (
        <MessagesPage onBrowse={() => setTab("Explore")} />
      )}

      {tab === "MyListings" && (
        <MyListingsPage
          items={myListings}
          onOpen={setSelected}
          onSell={() => (user ? setSellOpen(true) : openAuth("signIn"))}
        />
      )}

      {tab === "Profile" && (
        <ProfilePage
          user={user}
          meetup={meetup}
          savedCount={savedIds.length}
          listingCount={myListings.length}
          firebaseConfigured={firebaseConfigured}
          profileReady={profileReady}
          error={authError}
          onMyListings={() =>
            user ? setTab("MyListings") : openAuth("signIn")
          }
          onSaved={() => setTab("Saved")}
          onSignIn={() => openAuth("signIn")}
          onSignUp={() => openAuth("signUp")}
          onBrowse={() => setTab("Explore")}
          onSignOut={handleSignOut}
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      <BottomNav
        tab={tab}
        savedCount={savedIds.length}
        onChange={setTab}
        onSell={() => (user ? setSellOpen(true) : openAuth("signIn"))}
      />

      <ListingModal
        item={selected}
        user={user}
        onClose={() => setSelected(null)}
        onContact={contactSeller}
      />

      <AuthModal
        visible={authOpen}
        initialMode={authInitialMode}
        onClose={closeAuth}
        onGoogle={signInWithGoogle}
        onEmail={signInWithEmail}
        onReset={resetPassword}
        onGuest={continueAsGuest}
        busy={authBusy}
        error={authError}
        demoMode={!auth}
        onNavigateHome={() => {
          closeAuth();
          setTab("Explore");
        }}
      />

      <SellModal
        visible={sellOpen}
        onClose={() => setSellOpen(false)}
        onSubmit={publish}
      />
    </SafeAreaView>
  );
}

function BottomNav({
  tab,
  savedCount,
  onChange,
  onSell,
}: {
  tab: Tab;
  savedCount: number;
  onChange: (tab: Tab) => void;
  onSell: () => void;
}) {
  return (
    <View style={styles.nav}>
      <NavItem
        label="Explore"
        icon="⌂"
        active={tab === "Explore"}
        onPress={() => onChange("Explore")}
      />

      <NavItem
        label="Saved"
        icon="♡"
        active={tab === "Saved"}
        badge={savedCount}
        onPress={() => onChange("Saved")}
      />

      <NavItem
        label="Messages"
        icon="□"
        active={tab === "Messages"}
        onPress={() => onChange("Messages")}
      />

      <NavItem
        label="Profile"
        icon="☺"
        active={tab === "Profile" || tab === "MyListings"}
        onPress={() => onChange("Profile")}
      />

      <Pressable style={styles.sellButton} onPress={onSell}>
        <Text style={styles.sellPlus}>＋</Text>
        <Text style={styles.sellText}>Sell</Text>
      </Pressable>
    </View>
  );
}

function NavItem({
  label,
  icon,
  active,
  badge,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <View>
        <Text style={[styles.navIcon, active && styles.navActive]}>
          {icon}
        </Text>

        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.navLabel, active && styles.navActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ListingModal({
  item,
  user,
  onClose,
  onContact,
}: {
  item: Listing | null;
  user: AppUser | null;
  onClose: () => void;
  onContact: () => void;
}) {
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {item && (
        <View style={styles.backdrop}>
          <View style={styles.detail}>
            <Image source={{ uri: item.image }} style={styles.detailImage} />

            <Pressable style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>

            <View style={styles.detailBody}>
              <Text style={styles.detailCategory}>
                {item.category.toUpperCase()}
              </Text>

              <Text style={styles.detailTitle}>{item.title}</Text>

              <Text style={styles.detailPrice}>${item.price}</Text>

              <Text style={styles.muted}>
                {item.condition} · {item.campus} · {item.seller}
              </Text>

              <Text style={styles.description}>{item.description}</Text>

              <Pressable style={styles.primary} onPress={onContact}>
                <Text style={styles.primaryText}>
                  {user ? `Message ${item.seller}` : "Sign in to contact seller"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

function AuthModal({
  visible,
  initialMode = "signIn",
  onClose,
  onGoogle,
  onEmail,
  onReset,
  onGuest,
  busy,
  error,
  demoMode,
  onNavigateHome,
}: {
  visible: boolean;
  initialMode?: "signIn" | "signUp";
  onClose: () => void;
  onGoogle: () => Promise<void>;
  onEmail: (
    mode: "signIn" | "signUp",
    email: string,
    password: string,
    name: string,
    phone?: string,
  ) => Promise<void>;
  onReset: (email: string) => Promise<boolean>;
  onGuest: () => void;
  busy: boolean;
  error: string;
  demoMode: boolean;
  onNavigateHome?: () => void;
}) {
  const [mode, setMode] = useState<"signIn" | "signUp">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    } else {
      setPassword("");
      setNotice("");
    }
  }, [visible, initialMode]);

  const isSignUp = mode === "signUp";

  const handleModeSwitch = (targetMode: "signIn" | "signUp") => {
    setNotice("");
    setMode(targetMode);
  };

  const handleFillDemo = () => {
    setEmail("student@campus.edu");
    setPassword("campus123");
    if (isSignUp) {
      setName("Jordan Smith");
      setPhone("(555) 234-5678");
    }
    setNotice("Filled demo credentials (student@campus.edu / campus123)");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.authScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.auth}>
            {/* Header Tabs: Switch between Log In & Register */}
            <View style={styles.authTabs}>
              <Pressable
                style={[styles.authTab, !isSignUp && styles.authTabActive]}
                onPress={() => handleModeSwitch("signIn")}
              >
                <Text
                  style={[
                    styles.authTabText,
                    !isSignUp && styles.authTabTextActive,
                  ]}
                >
                  Log In
                </Text>
              </Pressable>

              <Pressable
                style={[styles.authTab, isSignUp && styles.authTabActive]}
                onPress={() => handleModeSwitch("signUp")}
              >
                <Text
                  style={[
                    styles.authTabText,
                    isSignUp && styles.authTabTextActive,
                  ]}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>

            <Text style={styles.formTitle}>
              {isSignUp ? "Create student account" : "Welcome back"}
            </Text>

            <Text style={styles.authMessage}>
              {isSignUp
                ? "Join your campus marketplace to post listings and connect with fellow students."
                : "Sign in to save items, message sellers, and manage your campus listings."}
            </Text>

            {/* User Friendly Validation & Auth Error Box */}
            {error ? (
              <View style={styles.authErrorContainer}>
                <Text style={styles.authErrorIcon}>⚠️</Text>
                <Text style={styles.authErrorText}>{error}</Text>
              </View>
            ) : null}

            {notice ? (
              <View style={styles.authNoticeContainer}>
                <Text style={styles.authNoticeText}>{notice}</Text>
              </View>
            ) : null}

            {isSignUp ? (
              <>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Jordan Smith"
                  placeholderTextColor="#9BA59F"
                  autoCapitalize="words"
                  style={styles.field}
                />

                <Text style={styles.label}>Phone Number (Optional)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. (555) 234-5678"
                  placeholderTextColor="#9BA59F"
                  keyboardType="phone-pad"
                  style={styles.field}
                />
              </>
            ) : null}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. student@campus.edu"
              placeholderTextColor="#9BA59F"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.field}
            />

            <Text style={styles.label}>
              {isSignUp ? "Password (min 6 characters)" : "Password"}
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={isSignUp ? "At least 6 characters" : "Your password"}
              placeholderTextColor="#9BA59F"
              secureTextEntry
              autoCapitalize="none"
              style={styles.field}
              onSubmitEditing={() =>
                !busy && onEmail(mode, email, password, name, phone)
              }
            />

            {!isSignUp ? (
              <Pressable
                style={styles.forgotRow}
                onPress={async () => {
                  setNotice("");
                  if (await onReset(email)) {
                    setNotice("Password reset email sent. Check your inbox.");
                  }
                }}
              >
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            {/* Submit Button with Loading State & Disabled while Busy */}
            <Pressable
              disabled={busy}
              style={[styles.primary, busy && styles.disabled]}
              onPress={() => onEmail(mode, email, password, name, phone)}
            >
              {busy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.primaryText}>
                    {isSignUp ? "Creating account..." : "Signing in..."}
                  </Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>
                  {isSignUp ? "Create Account" : "Sign In"}
                </Text>
              )}
            </Pressable>

            {/* Quick Demo Helper Button */}
            <Pressable style={styles.demoFillButton} onPress={handleFillDemo}>
              <Text style={styles.demoFillText}>
                ⚡ Fill demo student credentials
              </Text>
            </Pressable>

            {/* Alternative Auth / Guest Option */}
            <Pressable style={styles.guestButton} onPress={onGuest}>
              <Text style={styles.guestButtonText}>Continue as guest</Text>
            </Pressable>

            {Platform.OS === "web" && !demoMode ? (
              <Pressable
                disabled={busy}
                style={[styles.googleButton, busy && styles.disabled]}
                onPress={onGoogle}
              >
                <Text style={styles.googleMark}>G</Text>
                <Text style={styles.outlineText}>Continue with Google</Text>
              </Pressable>
            ) : null}

            {/* Switch between Sign In / Sign Up */}
            <Pressable
              style={styles.switchRow}
              onPress={() => handleModeSwitch(isSignUp ? "signIn" : "signUp")}
            >
              <Text style={styles.switchText}>
                {isSignUp
                  ? "Already have an account? "
                  : "Don't have an account? "}
                <Text style={styles.switchHighlight}>
                  {isSignUp ? "Sign In" : "Create Account"}
                </Text>
              </Text>
            </Pressable>

            {/* Navigation back to Home / Explore */}
            <Pressable
              style={styles.homeLinkButton}
              onPress={onNavigateHome || onClose}
            >
              <Text style={styles.homeLinkText}>
                ← Back to Explore (Home)
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SellModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, price: string, category: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Textbooks");

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Sell an item</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>What are you selling?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Organic Chemistry textbook"
            style={styles.field}
          />

          <Text style={styles.label}>Price</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="$ 0"
            style={styles.field}
          />

          <Pressable
            disabled={!title || !price}
            style={[styles.primary, (!title || !price) && styles.disabled]}
            onPress={() => onSubmit(title, price, category)}
          >
            <Text style={styles.primaryText}>Publish listing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F4",
  },

  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 82,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EBE5",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    alignItems: "center",
    minWidth: 54,
  },

  navIcon: {
    color: "#83918A",
    fontSize: 22,
  },

  navLabel: {
    color: "#83918A",
    fontSize: 10,
    marginTop: 3,
  },

  navActive: {
    color: "#1D6B54",
  },

  badge: {
    position: "absolute",
    right: -12,
    top: -3,
    backgroundColor: "#C3535B",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
  },

  badgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800",
  },

  sellButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F0E6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 4,
  },

  sellPlus: {
    color: "#247055",
    fontSize: 20,
  },

  sellText: {
    color: "#247055",
    fontWeight: "800",
    fontSize: 12,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,40,33,.45)",
    justifyContent: "flex-end",
  },

  detail: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },

  detailImage: {
    width: "100%",
    height: 230,
  },

  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: "#173C34",
    fontSize: 26,
  },

  detailBody: {
    padding: 24,
  },

  detailCategory: {
    color: "#23775D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  detailTitle: {
    color: "#173C34",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 8,
  },

  detailPrice: {
    color: "#1C7057",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },

  muted: {
    color: "#87918C",
    fontSize: 12,
  },

  description: {
    color: "#66736D",
    fontSize: 14,
    lineHeight: 21,
    marginVertical: 20,
  },

  primary: {
    height: 50,
    backgroundColor: "#1F5D4C",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  primaryText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 14,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  auth: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 24,
    margin: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },

  authTabs: {
    flexDirection: "row",
    backgroundColor: "#EFF4F0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },

  authTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },

  authTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  authTabText: {
    color: "#5E7369",
    fontWeight: "700",
    fontSize: 13,
  },

  authTabTextActive: {
    color: "#173C34",
    fontWeight: "800",
  },

  form: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },

  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  formTitle: {
    color: "#173C34",
    fontSize: 22,
    fontWeight: "800",
  },

  authMessage: {
    color: "#74857E",
    lineHeight: 20,
    marginTop: 6,
    fontSize: 13,
    marginBottom: 14,
  },

  authErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDF0F1",
    borderWidth: 1,
    borderColor: "#F4C4C8",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  authErrorIcon: {
    fontSize: 16,
  },

  authErrorText: {
    color: "#A7333B",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  authNoticeContainer: {
    backgroundColor: "#EBF5EF",
    borderWidth: 1,
    borderColor: "#C5E3D0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },

  authNoticeText: {
    color: "#1D704F",
    fontSize: 12,
    fontWeight: "600",
  },

  googleButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7DDD8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 10,
  },

  googleMark: {
    color: "#4285F4",
    fontSize: 18,
    fontWeight: "800",
  },

  guestButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFDCD3",
    backgroundColor: "#FAFBF9",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  guestButtonText: {
    color: "#285648",
    fontWeight: "700",
    fontSize: 13,
  },

  demoFillButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F7F4",
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#DCE5DF",
  },

  demoFillText: {
    color: "#2E755E",
    fontWeight: "700",
    fontSize: 12,
  },

  outline: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BCD0C3",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  outlineText: {
    color: "#1F5D4C",
    fontWeight: "800",
  },

  label: {
    color: "#274F40",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },

  field: {
    height: 48,
    borderWidth: 1,
    borderColor: "#CFDCD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#173C34",
    backgroundColor: "#FAFBF9",
    fontSize: 14,
  },

  disabled: {
    opacity: 0.55,
  },

  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },

  forgotRow: {
    alignSelf: "flex-end",
    marginTop: 8,
  },

  linkText: {
    color: "#206D56",
    fontSize: 12,
    fontWeight: "700",
  },

  switchRow: {
    marginTop: 16,
    alignItems: "center",
  },

  switchText: {
    color: "#6D7B74",
    fontSize: 13,
  },

  switchHighlight: {
    color: "#1D6B54",
    fontWeight: "800",
  },

  homeLinkButton: {
    marginTop: 16,
    paddingVertical: 8,
    alignItems: "center",
  },

  homeLinkText: {
    color: "#288365",
    fontSize: 13,
    fontWeight: "700",
  },
});
