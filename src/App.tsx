import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
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
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  addDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
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
import { ExplorePage } from "./pages/ExplorePage";
import { MessagesPage, useUnreadMessageState } from "./pages/MessagesPage";
import { MyListingsPage } from "./pages/MyListingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SavedPage } from "./pages/SavedPage";
import { ListingDetailsModal } from "./components/ListingDetailsModal";
import { CreateListingInput, SellListingModal } from "./components/SellListingModal";
import { seedListings } from "./data";
import { auth, db, firebaseConfigured, storage } from "./firebase";
import { Listing, Tab } from "./types";
import { getEffectiveQuantity, getEffectiveStatus } from "./listingHelpers";
import {
  AppUser,
  DEMO_USER,
  friendlyAuthError,
  logAuthError,
  toAppUser,
  validateAuthInput,
  loadStoredSession,
  saveStoredSession,
  getDemoAccounts,
  saveDemoAccounts,
} from "./authHelpers";

const MAX_PRODUCT_IMAGE_BYTES = 500 * 1024;

function validateProductImageDataUrl(image: string): void {
  const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(image);
  if (!match) {
    throw new Error("Product image data is unavailable. Please choose another image.");
  }
  const encodedBytes = Math.ceil(match[2].length * 0.75);
  if (encodedBytes > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Image is too large. Please choose a smaller image.");
  }
}

/* -------------------------------------------------------------
   User Authentication & Profile Synchronization with Firebase
---------------------------------------------------------------- */

async function registerUser(user: AppUser) {
  if (!db) {
    throw { code: "app/firestore-not-configured" };
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      ...(user.displayName ? { displayName: user.displayName } : {}),
      email: user.email || "",
      ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
      photoURL: user.photoURL || null,
      campus: user.campus || "North Campus",
      meetupPreference: user.meetupPreference || "Student Center",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function uploadProfilePhoto(
  uid: string,
  uri: string,
  contentType?: string | null,
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read the selected profile photo.");
  }

  const image = await response.blob();
  const imageType = contentType || image.type || "image/jpeg";
  if (!imageType.startsWith("image/")) {
    throw new Error("The selected file is not a supported image.");
  }
  if (image.size >= 5 * 1024 * 1024) {
    throw new Error("Profile photos must be smaller than 5 MB.");
  }

  const photoRef = ref(storage, `profilePhotos/${uid}`);
  const uploaded = await uploadBytes(photoRef, image, { contentType: imageType });
  return getDownloadURL(uploaded.ref);
}

function friendlyProfileSaveError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (code === "permission-denied") {
    return "Your account is signed in, but Firestore could not save your profile. Check the Firestore rules for users/{uid}.";
  }

  if (code === "unavailable" || code === "auth/network-request-failed") {
    return "Your account is signed in, but your profile could not be synced. Check your internet connection and try again.";
  }

  if (code === "app/firestore-not-configured") {
    return "Your account is signed in, but Firestore is not configured. Check the Firebase environment settings.";
  }

  return "Your account is signed in, but your profile could not be saved. Check Firebase Firestore configuration and rules.";
}

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
  // Let users browse listings before choosing whether to sign in.
  const [tab, setTab] = useState<Tab>("Explore");

  // Initialize user from existing Firebase auth or local stored session
  const [user, setUser] = useState<AppUser | null>(() => {
    if (auth?.currentUser) {
      return toAppUser(auth.currentUser);
    }
    return loadStoredSession();
  });
  const unreadMessageState = useUnreadMessageState(
    user?.uid && user.uid !== DEMO_USER.uid ? user.uid : null,
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"signIn" | "signUp">("signIn");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [savedState, setSavedState] = useState<{
    userId: string | null;
    ids: string[];
  }>({ userId: user?.uid ?? null, ids: [] });
  const savedIds =
    user && savedState.userId === user.uid ? savedState.ids : [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>(seedListings);
  const [sellOpen, setSellOpen] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [deletingListing, setDeletingListing] = useState<Listing | null>(null);
  const [messageConversationId, setMessageConversationId] = useState<string | null>(null);
  const pendingSavedIds = useRef(new Set<string>());
  const [meetup, setMeetup] = useState(
    user?.meetupPreference || user?.campus || "North Campus",
  );

  useEffect(() => {
    if (!db) {
      setListings(seedListings);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "listings"),
      (snapshot) => {
        const next = snapshot.docs.map((listingDocument) => {
          const data = listingDocument.data();
          return {
            id: listingDocument.id,
            title: typeof data.title === "string" ? data.title : "",
            price: typeof data.price === "number" ? data.price : Number(data.price) || 0,
            category: typeof data.category === "string" ? data.category : "",
            seller: typeof data.seller === "string" ? data.seller : "Campus seller",
            sellerId: typeof data.sellerId === "string" ? data.sellerId : undefined,
            campus: typeof data.campus === "string" ? data.campus : "",
            condition: typeof data.condition === "string" ? data.condition : "",
            image: typeof data.image === "string" ? data.image : "",
            description: typeof data.description === "string" ? data.description : undefined,
            quantity: typeof data.quantity === "number" ? data.quantity : undefined,
            status: data.status === "sold" ? "sold" : data.status === "available" ? "available" : undefined,
          } satisfies Listing;
        }).filter((listing) => listing.title && listing.image);
        setListings(next);
      },
      (error) => {
        logAuthError("Listening to listings", error);
        setListings(seedListings);
      },
    );
    return unsubscribe;
  }, [db]);

  useEffect(() => {
    if (!user || user.uid === DEMO_USER.uid) {
      setSavedState({ userId: user?.uid ?? null, ids: [] });
      return;
    }

    if (!db) {
      setSavedState({ userId: user.uid, ids: [] });
      return;
    }

    let active = true;
    const userId = user.uid;
    setSavedState((current) =>
      current.userId === userId ? current : { userId, ids: [] },
    );

    const unsubscribe = onSnapshot(
      collection(db, "users", userId, "saved"),
      (snapshot) => {
        if (!active) return;
        const ids = snapshot.docs.map((savedDocument) => {
          const listingId = savedDocument.data().listingId;
          return typeof listingId === "string" ? listingId : savedDocument.id;
        });
        setSavedState({ userId, ids });
      },
      (error) => {
        if (!active) return;
        logAuthError("Listening to saved listings", error);
        setAuthError(friendlyProfileSaveError(error));
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid, db]);

  /* Keep user in sync with Firebase Authentication */
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
      logAuthError("Google redirect sign-in", error);
      const message = friendlyAuthError(error);
      if (message) setAuthError(message);
    });

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setSavedState({ userId: null, ids: [] });
        saveStoredSession(null);
        setProfileReady(false);
        setTab("Explore");
        return;
      }

      const next = toAppUser(nextUser);
      setUser(next);
      setTab("Explore");
      saveStoredSession(next);

      registerUser(next)
        .then(() => {
          setProfileReady(true);
          setAuthError("");
        })
        .catch((error) => {
          logAuthError("Saving signed-in user profile", error);
          setProfileReady(false);
          setAuthError(friendlyProfileSaveError(error));
        });
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
      (error) => {
        logAuthError("Listening to signed-in user profile", error);
        if (error.code !== "unavailable" && error.code !== "deadline-exceeded") {
          return;
        }

        setAuthError("Firebase is unavailable. You have been signed out.");
        setUser(null);
        setSavedState({ userId: null, ids: [] });
        saveStoredSession(null);
        setProfileReady(false);
        setMeetup("North Campus");
        setTab("Explore");
        if (auth) {
          signOut(auth).catch((signOutError) => {
            logAuthError(
              "Signing out after Firebase became unavailable",
              signOutError,
            );
          });
        }
      },
    );
  }, [user?.uid]);

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
      logAuthError("Google sign-in", error);
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
    photo?: { uri: string; dataUrl?: string; contentType?: string | null },
  ) => {
    // Client-side input validation
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

          let photoURL: string | null = null;
          let photoUploadError: unknown;
          if (photo) {
            try {
              photoURL = await uploadProfilePhoto(
                credential.user.uid,
                photo.uri,
                photo.contentType,
              );
            } catch (error) {
              logAuthError("Uploading profile photo", error);
              photoUploadError = error;
            }
          }

          const created = toAppUser(credential.user, {
            displayName: name.trim(),
            phoneNumber: phone?.trim() || null,
            photoURL,
          });
          setUser(created);
          setTab("Explore");
          setMeetup(created.meetupPreference || "Student Center");
          saveStoredSession(created);

          let profileError: unknown;
          if (name.trim()) {
            try {
              await updateProfile(credential.user, {
                displayName: name.trim(),
                photoURL,
              });
            } catch (error) {
              logAuthError("Updating new account profile", error);
              profileError = error;
            }
          }

          try {
            await registerUser(created);
            setProfileReady(true);
          } catch (error) {
            logAuthError("Saving new account profile", error);
            profileError = profileError || error;
            setProfileReady(false);
          }

          const signupNotice = photoUploadError
            ? "Your account was created, but the profile photo could not be uploaded. Check that Firebase Storage is enabled and storage.rules are deployed."
            : profileError
              ? friendlyProfileSaveError(profileError)
              : "";
          setAuthError(signupNotice);
          setAuthOpen(Boolean(signupNotice));
        } else {
          const credential = await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password,
          );
          const loggedIn = toAppUser(credential.user);
          setUser(loggedIn);
          setTab("Explore");
          saveStoredSession(loggedIn);
          setAuthOpen(false);
        }
      } else {
        // Campus Demo Mode Simulation (realistic latency for loading spinner)
        await new Promise((resolve) => setTimeout(resolve, 500));

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
            photoURL: photo?.dataUrl || photo?.uri || null,
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
          setTab("Explore");
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
          setTab("Explore");
          saveStoredSession(account.user);
          setMeetup(account.user.meetupPreference || "North Campus");
          setAuthOpen(false);
        }
      }
    } catch (error) {
      logAuthError(
        mode === "signUp" ? "Creating email/password account" : "Email/password sign-in",
        error,
      );
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
    setTab("Explore");
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
    setTab("Explore");
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

  const handleSaveListing = async (listingId: string) => {
    if (!listingId || !user || user.uid === DEMO_USER.uid) {
      openAuth("signIn");
      return;
    }

    if (!db) {
      setAuthError(friendlyProfileSaveError({ code: "app/firestore-not-configured" }));
      return;
    }

    const userId = user.uid;
    const pendingKey = `${userId}:${listingId}`;
    if (pendingSavedIds.current.has(pendingKey)) return;
    pendingSavedIds.current.add(pendingKey);

    const alreadySaved = savedIds.includes(listingId);
    setSavedState((current) => {
      const currentIds = current.userId === userId ? current.ids : [];
      const ids = alreadySaved
        ? currentIds.filter((id) => id !== listingId)
        : currentIds.includes(listingId)
          ? currentIds
          : [...currentIds, listingId];
      return { userId, ids };
    });

    try {
      if (alreadySaved) {
        await deleteDoc(doc(db, "users", userId, "saved", listingId));
      } else {
        await setDoc(
          doc(db, "users", userId, "saved", listingId),
          {
            userId,
            listingId,
          },
          { merge: true },
        );
      }
    } catch (error) {
      setSavedState((current) => {
        if (current.userId !== userId) return current;
        if (alreadySaved) {
          return current.ids.includes(listingId)
            ? current
            : { userId, ids: [...current.ids, listingId] };
        }
        return {
          userId,
          ids: current.ids.filter((id) => id !== listingId),
        };

      });
      setAuthError(friendlyProfileSaveError(error));
    } finally {
      pendingSavedIds.current.delete(pendingKey);
    }
  };

  const messageSeller = async (listing: Listing) => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || !db || !user || user.uid === DEMO_USER.uid) {
      openAuth("signIn");
      return;
    }
    if (!listing.sellerId || listing.sellerId === firebaseUser.uid) {
      setAuthError("You cannot message yourself.");
      return;
    }

    const memberIds = [firebaseUser.uid, listing.sellerId].sort();
    const conversationId = memberIds.join("_");
    try {
      await setDoc(
        doc(db, "conversations", conversationId),
        {
          memberIds,
          memberNames: {
            [firebaseUser.uid]: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Campus student",
            [listing.sellerId]: listing.seller || "Campus student",
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        type: "product_context",
        listingId: listing.id,
        title: listing.title,
        price: listing.price,
        image: listing.image,
        quantity: getEffectiveQuantity(listing),
        status: getEffectiveStatus(listing),
        senderId: firebaseUser.uid,
        createdAt: serverTimestamp(),
      });
      setSelectedListing(null);
      setMessageConversationId(conversationId);
      setTab("Messages");
    } catch (error) {
      logAuthError("Opening seller conversation", error);
      setAuthError("Could not open this conversation. Please try again.");
    }
  };

  const publishListing = async (input: CreateListingInput) => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || !db || user?.uid !== firebaseUser.uid) {
      throw new Error("Please sign in with Firebase before publishing a listing.");
    }
    const imageUri = input.imageUri;
    if (!imageUri) throw new Error("Please select a product image.");
    validateProductImageDataUrl(imageUri);
    await addDoc(collection(db, "listings"), {
      title: input.title,
      price: input.price,
      category: input.category,
      condition: input.condition,
      campus: input.campus,
      description: input.description,
      quantity: input.quantity,
      status: "available",
      image: imageUri,
      sellerId: firebaseUser.uid,
      seller: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Campus seller",
      createdAt: serverTimestamp(),
    });
  };

  const editListing = async (input: CreateListingInput) => {
    const firebaseUser = auth?.currentUser;
    const firestore = db;
    if (!firebaseUser || !firestore || !editingListing || editingListing.sellerId !== firebaseUser.uid) {
      throw new Error("You can only edit your own listings.");
    }
    const newImageUrl = input.imageUri || editingListing.image;
    if (input.imageUri) validateProductImageDataUrl(input.imageUri);
    await runTransaction(firestore, async (transaction) => {
        const listingRef = doc(firestore, "listings", editingListing.id);
        const snapshot = await transaction.get(listingRef);
        if (!snapshot.exists() || snapshot.data().sellerId !== firebaseUser.uid) {
          throw new Error("You do not own this listing.");
        }
        const quantity = input.quantity;
        transaction.update(listingRef, {
          title: input.title,
          price: input.price,
          category: input.category,
          condition: input.condition,
          campus: input.campus,
          description: input.description,
          quantity,
          status: quantity > 0 ? "available" : "sold",
          image: newImageUrl,
          updatedAt: serverTimestamp(),
        });
      });
    setEditingListing(null);
  };

  const deleteListing = async () => {
    const firebaseUser = auth?.currentUser;
    const firestore = db;
    const listing = deletingListing;
    if (!firebaseUser || !firestore || !listing || listing.sellerId !== firebaseUser.uid) {
      setInventoryError("You can only delete your own listings.");
      setDeletingListing(null);
      return;
    }
    setBusyById((current) => ({ ...current, [listing.id]: true }));
    try {
      await runTransaction(firestore, async (transaction) => {
        const listingRef = doc(firestore, "listings", listing.id);
        const snapshot = await transaction.get(listingRef);
        if (!snapshot.exists() || snapshot.data().sellerId !== firebaseUser.uid) {
          throw new Error("You do not own this listing.");
        }
        transaction.delete(listingRef);
      });
      setDeletingListing(null);
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Could not delete this listing.");
    } finally {
      setBusyById((current) => {
        const next = { ...current };
        delete next[listing.id];
        return next;
      });
    }
  };

  const runInventoryMutation = async (listing: Listing, operation: "increase" | "decrease" | "sale") => {
    const firebaseUser = auth?.currentUser;
    const firestore = db;
    if (!firebaseUser || !firestore || listing.sellerId !== firebaseUser.uid) {
      setInventoryError("You can only update listings that belong to your signed-in account.");
      return;
    }
    if (busyById[listing.id]) return;
    setBusyById((current) => ({ ...current, [listing.id]: true }));
    setInventoryError("");
    try {
      await runTransaction(firestore, async (transaction) => {
        const listingRef = doc(firestore, "listings", listing.id);
        const snapshot = await transaction.get(listingRef);
        if (!snapshot.exists()) throw new Error("This listing is no longer available.");
        const latest = snapshot.data();
        if (latest.sellerId !== firebaseUser.uid) throw new Error("You do not own this listing.");
        const currentQuantity = getEffectiveQuantity({
          ...listing,
          quantity: typeof latest.quantity === "number" ? latest.quantity : undefined,
          status: latest.status === "sold" ? "sold" : "available",
        });
        if (operation === "sale" && currentQuantity === 0) throw new Error("This item is already sold out.");
        const nextQuantity = operation === "increase"
          ? currentQuantity + 1
          : Math.max(0, currentQuantity - 1);
        transaction.update(listingRef, {
          quantity: nextQuantity,
          status: nextQuantity > 0 ? "available" : "sold",
        });
      });
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Could not update inventory.");
    } finally {
      setBusyById((current) => {
        const next = { ...current };
        delete next[listing.id];
        return next;
      });
    }
  };

  const savedItems = listings.filter((item) => savedIds.includes(item.id));
  const myListings = user
    ? listings.filter((item) => item.sellerId === user.uid)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Main Profile & Authentication Screen */}
      {tab === "Profile" && (
        <ProfilePage
          user={user}
          meetup={meetup}
          firebaseConfigured={firebaseConfigured}
          profileReady={profileReady}
          error={authError}
          onSignIn={() => openAuth("signIn")}
          onSignUp={() => openAuth("signUp")}
          onSignOut={handleSignOut}
          onUpdateProfile={handleUpdateProfile}
          onResetPassword={resetPassword}
        />
      )}

      {/* Placeholders for other team members' components */}
      {tab === "Explore" && (
        <ExplorePage
          items={listings}
          query={query}
          category={category}
          savedIds={savedIds}
          userPhotoURL={user?.photoURL}
          userDisplayName={
            user?.displayName || user?.email?.split("@")[0] || null
          }
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          onSave={(listingId) => {
            void handleSaveListing(listingId);
            setTab("Saved");
          }}
          onOpen={setSelectedListing}
          onProfile={() => setTab("Profile")}
        />
      )}

      {tab === "Saved" && (
        <SavedPage
          items={savedItems}
          onSave={handleSaveListing}
          onOpen={setSelectedListing}
        />
      )}

      {tab === "Messages" && (
        <MessagesPage
          userId={user?.uid && user.uid !== DEMO_USER.uid ? user.uid : null}
          initialConversationId={messageConversationId}
          unreadByConversation={unreadMessageState.byConversation}
          latestByConversation={unreadMessageState.latestByConversation}
          onBrowse={() => setTab("Explore")}
          onBackToInbox={() => {
            setMessageConversationId(null);
          }}
        />
      )}

      {tab === "MyListings" && (
        <MyListingsPage
          items={myListings}
          onOpen={setSelectedListing}
          onSell={() => setSellOpen(true)}
          busyById={busyById}
          error={inventoryError}
          onClearError={() => setInventoryError("")}
          onIncrease={(item) => void runInventoryMutation(item, "increase")}
          onDecrease={(item) => void runInventoryMutation(item, "decrease")}
          onRecordSale={(item) => void runInventoryMutation(item, "sale")}
          onEdit={setEditingListing}
          onDelete={setDeletingListing}
        />
      )}

      <BottomNav
        tab={tab}
        onChange={setTab}
        unreadMessageCount={unreadMessageState.total}
      />

      <ListingDetailsModal
        item={selectedListing}
        saved={selectedListing ? savedIds.includes(selectedListing.id) : false}
        onClose={() => setSelectedListing(null)}
        onSave={() => {
          if (selectedListing) void handleSaveListing(selectedListing.id);
        }}
        onMessageSeller={
          selectedListing &&
          user &&
          selectedListing.sellerId &&
          selectedListing.sellerId !== user.uid
            ? () => void messageSeller(selectedListing)
            : undefined
        }
      />

      <SellListingModal
        visible={sellOpen || editingListing !== null}
        listing={editingListing}
        onClose={() => {
          setSellOpen(false);
          setEditingListing(null);
        }}
        onSubmit={editingListing ? editListing : publishListing}
      />

      <Modal visible={deletingListing !== null} transparent animationType="fade" onRequestClose={() => setDeletingListing(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete listing?</Text>
            <Text style={styles.confirmMessage}>{deletingListing?.title} will be permanently removed from the marketplace.</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancel} onPress={() => setDeletingListing(null)} disabled={!!(deletingListing && busyById[deletingListing.id])}><Text style={styles.confirmCancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.confirmDelete} onPress={() => void deleteListing()} disabled={!!(deletingListing && busyById[deletingListing.id])}><Text style={styles.confirmDeleteText}>{deletingListing && busyById[deletingListing.id] ? "Deleting..." : "Delete"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    </SafeAreaView>
  );
}

function BottomNav({
  tab,
  onChange,
  unreadMessageCount,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  unreadMessageCount: number;
}) {
  return (
    <View style={styles.nav}>
      <NavItem
        label="Profile"
        icon="☺"
        active={tab === "Profile"}
        onPress={() => onChange("Profile")}
      />

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
        onPress={() => onChange("Saved")}
      />

      <NavItem
        label="Messages"
        icon="□"
        active={tab === "Messages"}
        badge={unreadMessageCount}
        onPress={() => onChange("Messages")}
      />

      <NavItem
        label="My Listings"
        icon="📦"
        active={tab === "MyListings"}
        onPress={() => onChange("MyListings")}
      />
    </View>
  );
}

function NavItem({
  label,
  icon,
  active,
  badge = 0,
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
      <View style={styles.navIconWrap}>
        <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
        {badge > 0 ? (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navActive]}>
        {label}
      </Text>
    </Pressable>
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
    photo?: { uri: string; dataUrl?: string; contentType?: string | null },
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [photoContentType, setPhotoContentType] = useState<string | null>();
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    } else {
      setPassword("");
      setNotice("");
      setPhotoError("");
      setPhotoUri(null);
      setPhotoDataUrl(undefined);
      setPhotoContentType(null);
    }
  }, [visible, initialMode]);

  const isSignUp = mode === "signUp";

  const handleModeSwitch = (targetMode: "signIn" | "signUp") => {
    setNotice("");
    setPhotoError("");
    if (targetMode === "signIn") {
      setPhotoUri(null);
      setPhotoDataUrl(undefined);
      setPhotoContentType(null);
    }
    setMode(targetMode);
  };

  const handleChoosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize >= 5 * 1024 * 1024) {
          setPhotoError("Profile photos must be smaller than 5 MB.");
          return;
        }

        setPhotoUri(asset.uri);
        setPhotoContentType(asset.mimeType || null);
        setPhotoDataUrl(
          asset.base64
            ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
            : undefined,
        );
        setNotice("");
        setPhotoError("");
      }
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? `Unable to select a profile photo: ${error.message}`
          : "Unable to select a profile photo. Please try again.",
      );
    }
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
                ? "Create your student account to verify your campus profile."
                : "Sign in to access and manage your campus student profile."}
            </Text>

            {/* Validation & Auth Error Box */}
            {error ? (
              <View style={styles.authErrorContainer}>
                <Text style={styles.authErrorIcon}>⚠️</Text>
                <Text style={styles.authErrorText}>{error}</Text>
              </View>
            ) : null}

            {photoError ? (
              <View style={styles.authErrorContainer}>
                <Text style={styles.authErrorIcon}>⚠️</Text>
                <Text style={styles.authErrorText}>{photoError}</Text>
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

                <Text style={styles.label}>Profile Photo (Optional)</Text>
                <Pressable
                  style={styles.photoPicker}
                  onPress={handleChoosePhoto}
                  disabled={busy}
                >
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photoPreview}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>+</Text>
                    </View>
                  )}
                  <View style={styles.photoPickerText}>
                    <Text style={styles.photoPickerTitle}>
                      {photoUri ? "Change profile photo" : "Choose profile photo"}
                    </Text>
                    <Text style={styles.photoPickerHint}>
                      Optional · image must be under 5 MB
                    </Text>
                  </View>
                </Pressable>

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
                !busy &&
                onEmail(mode, email, password, name, phone, photoUri
                  ? {
                      uri: photoUri,
                      dataUrl: photoDataUrl,
                      contentType: photoContentType,
                    }
                  : undefined)
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

            {/* Submit Button with Loading State */}
            <Pressable
              disabled={busy}
              style={[styles.primary, busy && styles.disabled]}
              onPress={() =>
                onEmail(
                  mode,
                  email,
                  password,
                  name,
                  phone,
                  photoUri
                    ? {
                        uri: photoUri,
                        dataUrl: photoDataUrl,
                        contentType: photoContentType,
                      }
                    : undefined,
                )
              }
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

            {/* Close / Return */}
            <Pressable
              style={styles.homeLinkButton}
              onPress={onNavigateHome || onClose}
            >
              <Text style={styles.homeLinkText}>
                ✕ Close
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F4",
  },
  confirmBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15,40,33,.45)",
  },
  confirmCard: {
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#FFF",
  },
  confirmTitle: { color: "#173C34", fontSize: 21, fontWeight: "800" },
  confirmMessage: { color: "#64736C", fontSize: 14, lineHeight: 20, marginTop: 10 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  confirmCancel: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#CBD8CE", alignItems: "center", justifyContent: "center" },
  confirmCancelText: { color: "#365B4C", fontWeight: "800" },
  confirmDelete: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#B3434B", alignItems: "center", justifyContent: "center" },
  confirmDeleteText: { color: "#FFF", fontWeight: "800" },

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
  navIconWrap: { position: "relative" },
  navBadge: {
    position: "absolute",
    top: -6,
    right: -14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#C3535B",
    alignItems: "center",
    justifyContent: "center",
  },
  navBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "800" },

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

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,40,33,.45)",
    justifyContent: "center",
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

  photoPicker: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CFDCD3",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FAFBF9",
  },

  photoPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E7EFE9",
    alignItems: "center",
    justifyContent: "center",
  },

  photoPlaceholderText: {
    color: "#1F5D4C",
    fontSize: 24,
    fontWeight: "500",
  },

  photoPickerText: {
    marginLeft: 12,
  },

  photoPickerTitle: {
    color: "#1F5D4C",
    fontSize: 13,
    fontWeight: "700",
  },

  photoPickerHint: {
    color: "#74857E",
    fontSize: 11,
    marginTop: 4,
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
