import { StatusBar } from "expo-status-bar";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
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
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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

async function registerUser(user: User) {
  if (!db) return;
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      displayName:
        user.displayName || user.email?.split("@")[0] || "Campus student",
      email: user.email || "",
      photoURL: user.photoURL || null,
      campus: "North Campus",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Explore");
  const [items, setItems] = useState(seedListings);
  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState("All items");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const savingRef = useRef<Set<string>>(new Set());
  const [selected, setSelected] = useState<Listing | null>(null);
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) return;
    const handleUser = (nextUser: User | null) => {
      setUser(nextUser);
      if (nextUser)
        registerUser(nextUser)
          .then(() => setProfileReady(true))
          .catch((error) =>
            setAuthError(
              error instanceof Error
                ? error.message
                : "Could not create profile.",
            ),
          );
      else {
        setProfileReady(false);
        setSavedIds([]);
      }
    };
    let unsubscribe: () => void = () => undefined;
    setPersistence(firebaseAuth, browserLocalPersistence)
      .then(() => {
        unsubscribe = onAuthStateChanged(firebaseAuth, handleUser);
        return getRedirectResult(firebaseAuth);
      })
      .then((result) => {
        if (result?.user) handleUser(result.user);
      })
      .catch((error) =>
        setAuthError(
          error instanceof Error
            ? error.message
            : "Google sign-in could not be completed.",
        ),
      );
    return () => unsubscribe();
  }, []);

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
                (entry) => ({ id: entry.id, ...entry.data() }) as Listing,
              ),
        ),
      () => setItems(seedListings),
    );
  }, []);

  useEffect(() => {
    if (!db || !user) {
      setSavedIds([]);
      return;
    }
    const savedQuery = query(
      collection(db, "savedListings"),
      where("userId", "==", user.uid),
    );
    return onSnapshot(
      savedQuery,
      (snapshot) => {
        const ids = snapshot.docs
          .map((entry) => entry.data().listingId as string)
          .filter(Boolean);
        setSavedIds(ids);
      },
      (error) => {
        console.error("Could not load saved listings:", error);
      },
    );
  }, [user]);

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
    () => (user ? items.filter((item) => item.sellerId === user.uid) : []),
    [items, user],
  );
  const toggleSaved = async (id: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (savingRef.current.has(id)) {
      return;
    }
    savingRef.current.add(id);

    const isSaved = savedIds.includes(id);
    const saveDocId = `${user.uid}_${id}`;

    setSavedIds((current) =>
      isSaved ? current.filter((value) => value !== id) : [...current, id],
    );

    if (!db) {
      savingRef.current.delete(id);
      return;
    }

    try {
      const saveRef = doc(db, "savedListings", saveDocId);
      if (isSaved) {
        await deleteDoc(saveRef);
      } else {
        await setDoc(saveRef, {
          userId: user.uid,
          listingId: id,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Could not update saved listing:", error);
      setSavedIds((current) =>
        isSaved ? [...current, id] : current.filter((value) => value !== id),
      );
    } finally {
      savingRef.current.delete(id);
    }
  };
  const signInWithGoogle = async () => {
    if (!auth) return;
    setAuthError("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      if (Platform.OS === "web") {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await registerUser(result.user);
        setUser(result.user);
        setProfileReady(true);
        setAuthOpen(false);
      } else {
        await signInAnonymously(auth);
        setAuthOpen(false);
      }
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "Google sign-in failed.";
      if (
        Platform.OS === "web" &&
        /popup|cancelled-popup-request/i.test(code)
      ) {
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      }
      setAuthError(code);
      Alert.alert("Google sign-in failed", code);
    }
  };
  const publish = async (
    title: string,
    price: string,
    listingCategory: string,
  ) => {
    if (!user) {
      setSellOpen(false);
      setAuthOpen(true);
      return;
    }
    await addDoc(collection(db!, "listings"), {
      title,
      price: Number(price),
      category: listingCategory,
      seller: user.displayName || user.email || "You",
      sellerId: user.uid,
      campus: "North Campus",
      condition: "Good condition",
      image: seedListings[0].image,
      description: "New listing from a campus seller.",
      createdAt: serverTimestamp(),
    });
    setSellOpen(false);
  };
  const contactSeller = () => {
    if (!user) {
      setAuthOpen(true);
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
          onSell={() => setSellOpen(true)}
        />
      )}
      {tab === "Profile" && (
        <ProfilePage
          user={user}
          savedCount={savedIds.length}
          listingCount={myListings.length}
          firebaseConfigured={firebaseConfigured}
          profileReady={profileReady}
          error={authError}
          onMyListings={() => (user ? setTab("MyListings") : setAuthOpen(true))}
          onSaved={() => setTab("Saved")}
          onSignIn={() => setAuthOpen(true)}
          onSignOut={async () => {
            if (auth) {
              await signOut(auth);
            }
            setUser(null);
            setSavedIds([]);
          }}
        />
      )}
      <BottomNav
        tab={tab}
        savedCount={savedIds.length}
        onChange={setTab}
        onSell={() => setSellOpen(true)}
      />
      <ListingModal
        item={selected}
        user={user}
        onClose={() => setSelected(null)}
        onContact={contactSeller}
      />
      <AuthModal
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignIn={signInWithGoogle}
        error={authError}
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
        <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
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
  user: User | null;
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
                  {user
                    ? `Message ${item.seller}`
                    : "Sign in to contact seller"}
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
  onClose,
  onSignIn,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  error: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.auth}>
          <Text style={styles.formTitle}>Welcome to campus marketplace</Text>
          <Text style={styles.authMessage}>
            Sign in to save listings, message sellers, and publish your own
            items.
          </Text>
          {error ? <Text style={styles.authError}>{error}</Text> : null}
          <Pressable style={styles.googleButton} onPress={onSignIn}>
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.outlineText}>Continue with Google</Text>
          </Pressable>
          <Pressable style={styles.outline} onPress={onClose}>
            <Text style={styles.outlineText}>Maybe later</Text>
          </Pressable>
        </View>
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
  container: { flex: 1, backgroundColor: "#F8F8F4" },
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
  navItem: { alignItems: "center", minWidth: 54 },
  navIcon: { color: "#83918A", fontSize: 22 },
  navLabel: { color: "#83918A", fontSize: 10, marginTop: 3 },
  navActive: { color: "#1D6B54" },
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
  badgeText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  sellButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F0E6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 4,
  },
  sellPlus: { color: "#247055", fontSize: 20 },
  sellText: { color: "#247055", fontWeight: "800", fontSize: 12 },
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
  detailImage: { width: "100%", height: 230 },
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
  closeText: { color: "#173C34", fontSize: 26 },
  detailBody: { padding: 24 },
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
  muted: { color: "#87918C", fontSize: 12 },
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
    marginTop: 24,
  },
  primaryText: { color: "#FFF", fontWeight: "800" },
  auth: { backgroundColor: "#FFF", borderRadius: 20, padding: 24, margin: 20 },
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
  formTitle: { color: "#173C34", fontSize: 22, fontWeight: "800" },
  authMessage: { color: "#87918C", lineHeight: 20, marginTop: 10 },
  authError: {
    color: "#B64950",
    backgroundColor: "#FBECEE",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    marginTop: 16,
  },
  googleButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7DDD8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 10,
  },
  googleMark: { color: "#4285F4", fontSize: 18, fontWeight: "800" },
  outline: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BCD0C3",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  outlineText: { color: "#1F5D4C", fontWeight: "800" },
  label: {
    color: "#365B4C",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 7,
  },
  field: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DDE4DC",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#173C34",
  },
  disabled: { opacity: 0.45 },
});
