import { useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getEffectiveStatus } from "../listingHelpers";
import { Listing } from "../types";

export function ListingCard({
  item,
  saved,
  onSave,
  onOpen,
  showSave = true,
}: {
  item: Listing;
  saved: boolean;
  onSave?: () => void;
  onOpen: () => void;
  showSave?: boolean;
}) {
  const status = getEffectiveStatus(item);
  const [isHovered, setIsHovered] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const isSavingRef = useRef(false);

  const triggerHeartPop = () => {
    heartScale.setValue(1);
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.35,
        duration: 150,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  };

  const handleSave = () => {
    if (isSavingRef.current || !onSave) return;
    isSavingRef.current = true;
    triggerHeartPop();
    onSave();
    setTimeout(() => {
      isSavingRef.current = false;
    }, 350);
  };

  return (
    <View
      style={[styles.card, isHovered && styles.cardHovered]}
      {...(Platform.OS === "web"
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          }
        : {})}
    >
      <Pressable
        style={styles.cardContent}
        onPress={onOpen}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
      >
        <View pointerEvents="none" style={styles.photo}>
          <Image
            source={{ uri: item.image }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.price}>${item.price}</Text>
          </View>
          <Text style={styles.muted}>
            {item.condition} {"\u00b7"} {item.campus}
          </Text>
          <Text style={styles.tiny}>Listed by {item.seller}</Text>
          <Text
            style={[
              styles.status,
              status === "sold" && styles.soldStatus,
            ]}
          >
            {status === "sold" ? "SOLD OUT" : "AVAILABLE"}
          </Text>
        </View>
      </Pressable>
      {showSave && onSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove saved item" : "Save item"}
          accessibilityState={{ selected: saved }}
          style={styles.save}
          onPress={handleSave}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Text style={[styles.heart, saved && styles.red]}>
              {saved ? "\u2665" : "\u2661"}
            </Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E9ECE6",
    ...(Platform.OS === "web"
      ? ({
          transitionProperty: "transform, box-shadow, border-color",
          transitionDuration: "200ms",
          transitionTimingFunction: "ease-out",
          cursor: "pointer",
        } as any)
      : {}),
  },
  cardHovered: {
    transform: [{ scale: 1.02 }],
    zIndex: 2,
    borderColor: "#CBD8CE",
    shadowColor: "rgba(23,60,52,0.12)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: { flex: 1 },
  photo: { height: 148, backgroundColor: "#E5ECE5" },
  image: { width: "100%", height: "100%" },
  save: {
    position: "absolute",
    zIndex: 1,
    elevation: 2,
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  heart: { color: "#365B4C", fontSize: 21 },
  red: { color: "#C3535B" },
  body: { padding: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  title: {
    flex: 1,
    minHeight: 34,
    color: "#1B3A33",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  price: { color: "#1C7057", fontSize: 14, fontWeight: "800" },
  muted: { color: "#87918C", fontSize: 12 },
  tiny: { color: "#A0AAA4", fontSize: 10, marginTop: 5 },
  status: { color: "#1C7057", fontSize: 10, fontWeight: "800", marginTop: 5 },
  soldStatus: { color: "#C3535B" },
});
