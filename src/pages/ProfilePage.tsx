import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PageTitle } from "../components/PageTitle";
import { AppUser, DEMO_USER, MEETUP_SPOTS } from "../authHelpers";

export function ProfilePage({
  user,
  meetup,
  firebaseConfigured,
  profileReady,
  error,
  onSignIn,
  onSignUp,
  onSignOut,
  onUpdateProfile,
  onResetPassword,
}: {
  user: AppUser | null;
  meetup: string;
  firebaseConfigured: boolean;
  profileReady: boolean;
  error: string;
  onSignIn: () => void;
  onSignUp?: () => void;
  onSignOut: () => void;
  onUpdateProfile: (
    displayName: string,
    meetupPreference: string,
    phoneNumber?: string,
  ) => Promise<void>;
  onResetPassword?: (email: string) => Promise<boolean>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editMeetup, setEditMeetup] = useState(meetup);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [resetNotice, setResetNotice] = useState("");

  const isDemo = user?.uid === DEMO_USER.uid;

  const name =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Campus Student";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const openEditProfile = () => {
    setEditError("");
    setEditName(
      user?.displayName || user?.email?.split("@")[0] || "",
    );
    setEditPhone(user?.phoneNumber || "");
    setEditMeetup(user?.meetupPreference || meetup);
    setEditOpen(true);
  };

  const saveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();

    if (!trimmedName) {
      setEditError("Please enter your name.");
      return;
    }

    if (trimmedName.length < 2) {
      setEditError("Name must contain at least 2 characters.");
      return;
    }

    if (trimmedName.length > 30) {
      setEditError("Name must be 30 characters or fewer.");
      return;
    }

    setSaving(true);
    setEditError("");

    try {
      await onUpdateProfile(trimmedName, editMeetup, trimmedPhone || undefined);
      setEditOpen(false);
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : "Could not update your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || !onResetPassword) return;
    try {
      const ok = await onResetPassword(user.email);
      if (ok) {
        setResetNotice("Password reset instructions sent to your email.");
      }
    } catch {
      setResetNotice("Could not send password reset email.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PageTitle
        title="Student Profile"
        subtitle="Manage your campus account authentication and credentials"
      />

      {/* Main Profile Hero Card */}
      <View style={styles.heroCard}>
        {user?.photoURL ? (
          <Image
            source={{ uri: user.photoURL }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.initials}>
              {user ? initials : "?"}
            </Text>
          </View>
        )}

        <Text style={styles.name}>{user ? name : "Campus Guest"}</Text>

        <Text style={styles.email}>
          {user?.email || "Sign in to authenticate your campus student profile"}
        </Text>

        {user?.phoneNumber ? (
          <View style={styles.phoneBadge}>
            <Text style={styles.phoneIcon}>📞</Text>
            <Text style={styles.phoneText}>{user.phoneNumber}</Text>
          </View>
        ) : user ? (
          <Pressable onPress={openEditProfile} style={styles.phoneBadgePlaceholder}>
            <Text style={styles.phoneTextPlaceholder}>+ Add phone number</Text>
          </Pressable>
        ) : null}

        {isDemo ? (
          <View style={styles.demoBadgeContainer}>
            <Text style={styles.demoBadge}>Student Demo Mode</Text>
          </View>
        ) : null}

        {user ? (
          <View style={styles.heroActionRow}>
            <Pressable
              style={styles.editButton}
              onPress={openEditProfile}
            >
              <Text style={styles.editButtonText}>✎ Edit Profile</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Account & Authentication Information Section */}
      {user ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>ACCOUNT & AUTHENTICATION</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Student Status</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active & Verified</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Authentication Provider</Text>
            <Text style={styles.infoVal}>
              {firebaseConfigured ? "Firebase Auth" : "Campus Demo Auth"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Student Email</Text>
            <Text style={styles.infoVal}>{user.email || "—"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Phone Number</Text>
            <Text style={styles.infoVal}>
              {user.phoneNumber || "Not provided"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Campus</Text>
            <Text style={styles.infoVal}>{user.campus || "North Campus"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Meetup Spot</Text>
            <Text style={styles.infoVal}>{meetup}</Text>
          </View>

          <View style={[styles.infoRow, styles.lastRow]}>
            <Text style={styles.infoKey}>Member Since</Text>
            <Text style={styles.infoVal}>{user.createdAt || "Fall 2024"}</Text>
          </View>
        </View>
      ) : null}

      {/* Account Settings Menu */}
      {user ? (
        <View style={styles.menu}>
          <Row
            icon="👤"
            label="Edit Profile Details"
            value="Update"
            onPress={openEditProfile}
          />
          <Row
            icon="📍"
            label="Campus Meetup Spot"
            value={meetup}
            onPress={openEditProfile}
          />
          {onResetPassword ? (
            <Row
              icon="🔒"
              label="Reset Password"
              value="Send link"
              onPress={handlePasswordReset}
            />
          ) : null}
        </View>
      ) : null}

      {resetNotice ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>{resetNotice}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {firebaseConfigured && user && !isDemo && profileReady ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncText}>✓ Profile authenticated & synced with Firebase</Text>
        </View>
      ) : null}

      {/* Primary Actions: Sign Out when logged in, or Auth Options when logged out */}
      {user ? (
        <Pressable style={styles.logoutButton} onPress={onSignOut}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </Pressable>
      ) : (
        <View style={styles.authPromptBox}>
          <Text style={styles.authPromptTitle}>Welcome to Campus Marketplace</Text>
          <Text style={styles.authPromptSubtitle}>
            Sign in to access your student profile, manage your campus credentials, and verify your account.
          </Text>

          <Pressable style={styles.primary} onPress={onSignIn}>
            <Text style={styles.primaryText}>Sign In to Account</Text>
          </Pressable>

          {onSignUp ? (
            <Pressable style={styles.outline} onPress={onSignUp}>
              <Text style={styles.outlineText}>Create New Student Account</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <Text style={styles.backend}>
        {firebaseConfigured
          ? "Connected to Firebase Authentication & Cloud Firestore"
          : "Local Campus Mode · Authentication & Profile Persistence"}
      </Text>

      {/* Edit Profile Modal */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.editModal}>
            <Text style={styles.formTitle}>Edit Profile Settings</Text>
            <Text style={styles.formSubtitle}>
              Update your student display name, contact phone, and campus location.
            </Text>

            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Jordan Smith"
              placeholderTextColor="#9BA59F"
              autoCapitalize="words"
              maxLength={30}
            />

            <Text style={[styles.inputLabel, styles.sectionGap]}>
              Phone Number
            </Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. (555) 234-5678"
              placeholderTextColor="#9BA59F"
              keyboardType="phone-pad"
              maxLength={20}
            />

            <Text style={[styles.inputLabel, styles.sectionGap]}>
              Campus Meetup Preference
            </Text>
            <View style={styles.chips}>
              {MEETUP_SPOTS.map((spot) => {
                const active = spot === editMeetup;
                return (
                  <Pressable
                    key={spot}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setEditMeetup(spot)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {spot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {editError ? (
              <View style={styles.errorBox}>
                <Text style={styles.editErrorText}>{editError}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primary, saving && styles.disabled]}
              disabled={saving}
              onPress={saveProfile}
            >
              <Text style={styles.primaryText}>
                {saving ? "Saving Changes..." : "Save Changes"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelOutline}
              disabled={saving}
              onPress={() => setEditOpen(false)}
            >
              <Text style={styles.cancelOutlineText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon?: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        {icon ? <Text style={styles.rowIcon}>{icon}</Text> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        <Text style={styles.rowChevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 120,
    backgroundColor: "#F7F8F5",
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5EBE5",
    shadowColor: "#173C34",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 14,
  },

  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E2EFE6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#C4DEC9",
  },

  initials: {
    fontSize: 26,
    color: "#184E3F",
    fontWeight: "800",
  },

  name: {
    color: "#173C34",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },

  email: {
    color: "#6D7B74",
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },

  phoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF5F0",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },

  phoneIcon: {
    fontSize: 12,
  },

  phoneText: {
    color: "#1F5D4C",
    fontSize: 12,
    fontWeight: "700",
  },

  phoneBadgePlaceholder: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },

  phoneTextPlaceholder: {
    color: "#2E7D63",
    fontSize: 12,
    fontWeight: "600",
  },

  demoBadgeContainer: {
    marginTop: 4,
    marginBottom: 8,
  },

  demoBadge: {
    color: "#85581A",
    backgroundColor: "#FEF6E7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#F4DFC1",
  },

  heroActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  editButton: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#F0F5F2",
    borderWidth: 1,
    borderColor: "#CFDCD3",
  },

  editButtonText: {
    color: "#1F5D4C",
    fontSize: 13,
    fontWeight: "700",
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5EBE5",
  },

  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#2A6E58",
    marginBottom: 14,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3EF",
  },

  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  infoKey: {
    fontSize: 13,
    color: "#6D7B74",
    fontWeight: "600",
  },

  infoVal: {
    fontSize: 13,
    color: "#173C34",
    fontWeight: "700",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF6EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#20885E",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#186A48",
  },

  menu: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5EBE5",
    marginBottom: 16,
  },

  row: {
    height: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3EF",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  rowIcon: {
    fontSize: 16,
  },

  label: {
    color: "#1E4136",
    fontWeight: "700",
    fontSize: 14,
  },

  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  rowValue: {
    color: "#6D7B74",
    fontSize: 13,
  },

  rowChevron: {
    fontSize: 18,
    color: "#A2ADA7",
    fontWeight: "400",
  },

  primary: {
    height: 48,
    backgroundColor: "#1F5D4C",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  outline: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F5D4C",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#FFFFFF",
  },

  outlineText: {
    color: "#1F5D4C",
    fontWeight: "800",
    fontSize: 14,
  },

  logoutButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5C2C4",
    backgroundColor: "#FFF8F8",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },

  logoutButtonText: {
    color: "#A8363F",
    fontWeight: "800",
    fontSize: 14,
  },

  authPromptBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5EBE5",
    marginTop: 8,
  },

  authPromptTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#173C34",
    marginBottom: 6,
  },

  authPromptSubtitle: {
    fontSize: 13,
    color: "#6D7B74",
    lineHeight: 19,
    marginBottom: 12,
  },

  syncBanner: {
    backgroundColor: "#EAF6EE",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    alignItems: "center",
  },

  syncText: {
    color: "#1F7351",
    fontSize: 12,
    fontWeight: "700",
  },

  noticeBox: {
    backgroundColor: "#EBF5EF",
    borderWidth: 1,
    borderColor: "#C5E3D0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  noticeText: {
    color: "#1D704F",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  error: {
    color: "#B64950",
    backgroundColor: "#FBECEE",
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F2CCD0",
  },

  backend: {
    textAlign: "center",
    color: "#8E9E94",
    fontSize: 11,
    marginTop: 24,
    marginBottom: 8,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 30, 24, 0.5)",
    justifyContent: "center",
    padding: 20,
  },

  editModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },

  formTitle: {
    color: "#173C34",
    fontSize: 20,
    fontWeight: "800",
  },

  formSubtitle: {
    color: "#6D7B74",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 18,
  },

  inputLabel: {
    color: "#24483D",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },

  sectionGap: {
    marginTop: 16,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#CFDCD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#173C34",
    backgroundColor: "#FAFBF9",
    fontSize: 14,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CFDCD3",
    backgroundColor: "#FAFBF9",
  },

  chipActive: {
    backgroundColor: "#1F5D4C",
    borderColor: "#1F5D4C",
  },

  chipText: {
    color: "#24483D",
    fontSize: 12,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#FFFFFF",
  },

  errorBox: {
    backgroundColor: "#FBECEE",
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#F2CCD0",
  },

  editErrorText: {
    color: "#B64950",
    fontSize: 12,
    fontWeight: "600",
  },

  cancelOutline: {
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  cancelOutlineText: {
    color: "#5C6F65",
    fontWeight: "700",
    fontSize: 13,
  },

  disabled: {
    opacity: 0.55,
  },
});
