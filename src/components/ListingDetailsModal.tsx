import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Listing } from "../types";

export function ListingDetailsModal({
  item,
  saved,
  onClose,
  onSave,
}: {
  item: Listing | null;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close listing details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          {item ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.topRow}>
                <Text style={styles.eyebrow}>LISTING DETAILS</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close listing details"
                  onPress={onClose}
                  hitSlop={10}
                >
                  <Text style={styles.close}>×</Text>
                </Pressable>
              </View>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.price}>${item.price}</Text>
                </View>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.meta}>
                  {item.condition} · {item.campus}
                </Text>
                <Text style={styles.seller}>Listed by {item.seller}</Text>
                {item.description ? (
                  <Text style={styles.description}>{item.description}</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    saved ? "Remove listing from saved items" : "Save listing"
                  }
                  accessibilityState={{ selected: saved }}
                  onPress={onSave}
                  style={[styles.saveButton, saved && styles.savedButton]}
                >
                  <Text style={[styles.saveIcon, saved && styles.savedIcon]}>
                    {saved ? "\u2665" : "\u2661"}
                  </Text>
                  <Text style={[styles.saveText, saved && styles.savedText]}>
                    {saved ? "Saved" : "Save listing"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(14, 34, 28, 0.45)",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  topRow: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  eyebrow: {
    color: "#65766D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  close: { color: "#365B4C", fontSize: 28, lineHeight: 32 },
  image: { width: "100%", height: 240, backgroundColor: "#E5ECE5" },
  body: { padding: 20, paddingBottom: 32 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: "#173C34",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  price: { color: "#1C7057", fontSize: 20, fontWeight: "800" },
  category: {
    alignSelf: "flex-start",
    color: "#386B54",
    backgroundColor: "#EEF5F0",
    borderRadius: 14,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
  },
  meta: { color: "#64736C", fontSize: 13, marginTop: 12 },
  seller: { color: "#87918C", fontSize: 12, marginTop: 5 },
  description: {
    color: "#365B4C",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 18,
  },
  saveButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EAF2EC",
    borderRadius: 12,
    marginTop: 22,
  },
  savedButton: { backgroundColor: "#F8EDEF" },
  saveIcon: { color: "#365B4C", fontSize: 20 },
  savedIcon: { color: "#C3535B" },
  saveText: { color: "#386B54", fontSize: 14, fontWeight: "700" },
  savedText: { color: "#A43E48" },
});
