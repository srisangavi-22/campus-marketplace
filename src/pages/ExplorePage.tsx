import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ListingCard } from "../components/ListingCard";
import { categories } from "../data";
import { Listing } from "../types";

const pricePresets = [
  { label: "Under Rs 1,000", from: "", to: "999" },
  { label: "Rs 1,000–5,000", from: "1000", to: "5000" },
  { label: "Rs 5,000–10,000", from: "5000", to: "10000" },
  { label: "Rs 10,000+", from: "10000", to: "" },
];

export function ExplorePage({
  items,
  query,
  category,
  savedIds,
  onQueryChange,
  onCategoryChange,
  onSave,
  onOpen,
  onProfile,
}: {
  items: Listing[];
  query: string;
  category: string;
  savedIds: string[];
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSave: (id: string) => void;
  onOpen: (item: Listing) => void;
  onProfile: () => void;
}) {
  const [fromPrice, setFromPrice] = useState("");
  const [toPrice, setToPrice] = useState("");
  const [appliedFromPrice, setAppliedFromPrice] = useState("");
  const [appliedToPrice, setAppliedToPrice] = useState("");
  const [pricePanelOpen, setPricePanelOpen] = useState(false);
  const [pricePanelPosition, setPricePanelPosition] = useState({
    left: 16,
    top: 0,
  });
  const priceFilterButton = useRef<View>(null);
  const window = useWindowDimensions();
  const pricePanelWidth = Math.min(360, Math.max(0, window.width - 32));
  const selectedPreset = pricePresets.find((preset) => {
    const matchesBound = (value: string, bound: string) =>
      bound === ""
        ? value.trim() === ""
        : value.trim() !== "" && Number(value) === Number(bound);
    return (
      matchesBound(fromPrice, preset.from) &&
      matchesBound(toPrice, preset.to)
    );
  });
  const visibleItems = useMemo(() => {
    const minimum = appliedFromPrice.trim() ? Number(appliedFromPrice) : null;
    const maximum = appliedToPrice.trim() ? Number(appliedToPrice) : null;
    return items.filter(
      (item) =>
        (minimum === null || item.price >= minimum) &&
        (maximum === null || item.price <= maximum),
    );
  }, [appliedFromPrice, appliedToPrice, items]);

  const applyPriceFilter = () => {
    setAppliedFromPrice(fromPrice);
    setAppliedToPrice(toPrice);
    setPricePanelOpen(false);
  };
  const clearPriceFilter = () => {
    setFromPrice("");
    setToPrice("");
    setAppliedFromPrice("");
    setAppliedToPrice("");
    setPricePanelOpen(false);
  };
  const togglePricePanel = () => {
    if (pricePanelOpen) {
      setPricePanelOpen(false);
      return;
    }
    priceFilterButton.current?.measureInWindow((x, y, _width, height) => {
      const maxLeft = Math.max(16, window.width - pricePanelWidth - 16);
      setPricePanelPosition({
        left: Math.min(Math.max(16, x), maxLeft),
        top: y + height + 8,
      });
      setPricePanelOpen(true);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CAMPUS MARKETPLACE</Text>
          <Text style={styles.heading}>
            Find your next{"\n"}favorite thing.
          </Text>
        </View>
        <Pressable style={styles.avatar} onPress={onProfile}>
          <Text style={styles.avatarText}>?</Text>
        </Pressable>
      </View>
      <View style={styles.search}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search textbooks, desks, tech..."
          placeholderTextColor="#87918C"
          style={styles.input}
        />
      </View>
      <View style={styles.section}>
        <View>
          <Text style={styles.sectionTitle}>Browse near you</Text>
          <Text style={styles.muted}>Good finds, close by</Text>
        </View>
        <Text style={styles.seeAll}>{visibleItems.length} items</Text>
      </View>
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroller}
          contentContainerStyle={styles.categories}
        >
          {categories.map((value) => (
            <Pressable
              key={value}
              onPress={() => onCategoryChange(value)}
              style={[
                styles.category,
                category === value && styles.activeCategory,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === value && styles.activeText,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View
          ref={priceFilterButton}
          collapsable={false}
          style={styles.priceFilterButtonWrapper}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: pricePanelOpen }}
            onPress={togglePricePanel}
            style={[
              styles.priceFilterButton,
              (appliedFromPrice || appliedToPrice) &&
                styles.activePriceFilterButton,
            ]}
          >
            <Text
              style={[
                styles.priceFilterButtonText,
                (appliedFromPrice || appliedToPrice) &&
                  styles.activePriceFilterButtonText,
              ]}
            >
              Price Range
            </Text>
            <Text style={styles.priceChevron}>
              {pricePanelOpen ? "⌃" : "⌄"}
            </Text>
          </Pressable>
        </View>
      </View>
      <Modal
        visible={pricePanelOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPricePanelOpen(false)}
      >
        <View style={styles.priceModal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close price range filter"
            onPress={() => setPricePanelOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.priceFilter,
              {
                left: pricePanelPosition.left,
                top: pricePanelPosition.top,
                width: pricePanelWidth,
              },
            ]}
          >
            <Text style={styles.priceTitle}>Price Range</Text>
            <View style={styles.pricePresets}>
              {pricePresets.map((preset) => {
                const isSelected = selectedPreset === preset;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      setFromPrice(preset.from);
                      setToPrice(preset.to);
                    }}
                    style={[
                      styles.pricePreset,
                      isSelected && styles.selectedPricePreset,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pricePresetText,
                        isSelected && styles.selectedPricePresetText,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.priceInputs}>
              <View style={styles.priceField}>
                <Text style={styles.priceFieldLabel}>From price</Text>
                <View style={styles.priceInput}>
                  <Text style={styles.currency}>Rs</Text>
                  <TextInput
                    value={fromPrice}
                    onChangeText={setFromPrice}
                    placeholder="0"
                    placeholderTextColor="#87918C"
                    keyboardType="numeric"
                    style={styles.priceInputText}
                  />
                </View>
              </View>
              <View style={styles.priceField}>
                <Text style={styles.priceFieldLabel}>To price</Text>
                <View style={styles.priceInput}>
                  <Text style={styles.currency}>Rs</Text>
                  <TextInput
                    value={toPrice}
                    onChangeText={setToPrice}
                    placeholder="Any"
                    placeholderTextColor="#87918C"
                    keyboardType="numeric"
                    style={styles.priceInputText}
                  />
                </View>
              </View>
            </View>
            <View style={styles.priceActions}>
              <Pressable
                style={styles.applyPriceButton}
                onPress={applyPriceFilter}
              >
                <Text style={styles.applyPriceText}>Apply</Text>
              </Pressable>
              <Pressable
                onPress={clearPriceFilter}
                style={styles.clearPriceButton}
              >
                <Text style={styles.clearPriceText}>Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <FlatList
        data={visibleItems}
        scrollEnabled={false}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No items match your search or filters yet.
          </Text>
        }
        renderItem={({ item }) => (
          <ListingCard
            item={item}
            saved={savedIds.includes(item.id)}
            onSave={() => onSave(item.id)}
            onOpen={() => onOpen(item)}
          />
        )}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 28,
    paddingBottom: 24,
  },
  eyebrow: {
    color: "#65766D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  heading: {
    color: "#173C34",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D6E5D7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#225347", fontWeight: "800" },
  search: {
    height: 52,
    backgroundColor: "#FFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#E6E9E2",
  },
  icon: { color: "#49635A", fontSize: 28, marginRight: 8 },
  input: { flex: 1, color: "#173C34", fontSize: 14 },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#173C34",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  muted: { color: "#87918C", fontSize: 12 },
  seeAll: { color: "#23775D", fontWeight: "700", fontSize: 12 },
  filterRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  categoryScroller: { flex: 1, minWidth: 0 },
  categories: { gap: 8, paddingBottom: 22 },
  category: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#ECEFE9",
  },
  activeCategory: { backgroundColor: "#1F5D4C" },
  categoryText: { color: "#64736C", fontSize: 12, fontWeight: "700" },
  activeText: { color: "#FFF" },
  priceFilterButtonWrapper: { paddingBottom: 22 },
  priceFilterButton: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6E9E2",
    backgroundColor: "#FFF",
  },
  activePriceFilterButton: {
    backgroundColor: "#EEF5F0",
    borderColor: "#B8D0C2",
  },
  priceFilterButtonText: { color: "#64736C", fontSize: 12, fontWeight: "700" },
  activePriceFilterButtonText: { color: "#386B54" },
  priceChevron: { color: "#64736C", fontSize: 14 },
  priceModal: { flex: 1, backgroundColor: "rgba(23, 60, 52, 0.06)" },
  priceFilter: {
    position: "absolute",
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6E9E2",
    padding: 16,
    shadowColor: "#173C34",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  priceTitle: {
    color: "#173C34",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  pricePresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  pricePreset: {
    width: "48%",
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6E9E2",
    backgroundColor: "#FFF",
  },
  selectedPricePreset: {
    backgroundColor: "#EEF5F0",
    borderColor: "#B8D0C2",
  },
  pricePresetText: {
    color: "#64736C",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  selectedPricePresetText: { color: "#386B54" },
  priceInputs: { flexDirection: "row", gap: 10, marginTop: 14 },
  priceField: { flex: 1 },
  priceFieldLabel: {
    color: "#64736C",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  priceInput: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E6E9E2",
    borderRadius: 10,
    backgroundColor: "#FFF",
  },
  currency: { color: "#64736C", fontSize: 12, marginRight: 7 },
  priceInputText: { flex: 1, color: "#173C34", fontSize: 13, padding: 0 },
  priceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
  },
  applyPriceButton: {
    minWidth: 86,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#EAF2EC",
  },
  applyPriceText: { color: "#386B54", fontSize: 13, fontWeight: "700" },
  clearPriceButton: { paddingVertical: 9, paddingHorizontal: 4 },
  clearPriceText: { color: "#64736C", fontSize: 13, fontWeight: "600" },
  grid: { gap: 14 },
  columns: { gap: 14 },
  empty: { textAlign: "center", color: "#87918C", padding: 30 },
});
