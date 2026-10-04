import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
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
  { label: "$0\u2013$50", from: "0", to: "50" },
  { label: "$50\u2013$100", from: "50", to: "100" },
  { label: "$100\u2013$250", from: "100", to: "250" },
  { label: "$250\u2013$500", from: "250", to: "500" },
  { label: "$500\u2013$750", from: "500", to: "750" },
  { label: "$750\u2013$1000", from: "750", to: "1000" },
];

export function ExplorePage({
  items,
  query,
  category,
  savedIds,
  userPhotoURL,
  userDisplayName,
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
  userPhotoURL?: string | null;
  userDisplayName?: string | null;
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
  const [priceValidationError, setPriceValidationError] = useState("");

  const [pricePanelPosition, setPricePanelPosition] = useState({
    left: 16,
    top: 0,
  });

  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null);

  const userName = userDisplayName?.trim() || "";

  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const priceFilterButton = useRef<View>(null);
  const window = useWindowDimensions();

  const pricePanelWidth = Math.min(
    360,
    Math.max(0, window.width - 32)
  );

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
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const normalizedCategory = category.trim().toLocaleLowerCase();
    const hasPriceFilter = appliedFromPrice !== "" || appliedToPrice !== "";
    const minimum = appliedFromPrice === "" ? 0 : Number(appliedFromPrice);
    const maximum = appliedToPrice === "" ? Number.POSITIVE_INFINITY : Number(appliedToPrice);
    const isAllCategories =
      normalizedCategory === "all categories" ||
      normalizedCategory === "all items";

    return items.filter((item) => {
      const matchesSearch =
        normalizedQuery === "" ||
        [
          item.title,
          item.category,
          item.seller,
          item.campus,
          item.condition,
          item.description || "",
        ].some((field) => field.toLocaleLowerCase().includes(normalizedQuery));
      const itemCategory = item.category.trim().toLocaleLowerCase();
      const matchesCategory =
        isAllCategories ||
        itemCategory === normalizedCategory ||
        (normalizedCategory === "electronics" && itemCategory === "tech");
      const matchesPrice =
        !hasPriceFilter ||
        (item.price >= minimum && item.price <= maximum);

      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [appliedFromPrice, appliedToPrice, category, items, query]);

  const hasPriceFilter = appliedFromPrice !== "" || appliedToPrice !== "";
  const selectedPriceLabel = hasPriceFilter
    ? `$${appliedFromPrice || "0"}\u2013$${appliedToPrice || "1000"}`
    : "";

  const updateFromPrice = (value: string) => {
    setFromPrice(value);
    setPriceValidationError("");
  };

  const updateToPrice = (value: string) => {
    setToPrice(value);
    setPriceValidationError("");
  };

  const applyPriceFilter = () => {
    const parsePrice = (value: string): number | null => {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
      return Number(trimmed);
    };

    const minimum = parsePrice(fromPrice);
    const maximum = parsePrice(toPrice);
    if (minimum !== null && minimum < 0) {
      setPriceValidationError("Invalid price");
      return;
    }
    if (
      Number.isNaN(minimum) ||
      Number.isNaN(maximum) ||
      (maximum !== null && maximum < 0)
    ) {
      setPriceValidationError("Enter positive prices (up to 2 decimals).");
      return;
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      setPriceValidationError("Minimum price must be less than or equal to maximum price.");
      return;
    }

    setPriceValidationError("");
    setAppliedFromPrice(fromPrice.trim());
    setAppliedToPrice(toPrice.trim());
    setPricePanelOpen(false);
  };

  const clearPriceFilter = () => {
    setFromPrice("");
    setToPrice("");
    setAppliedFromPrice("");
    setAppliedToPrice("");
    setPriceValidationError("");
    setPricePanelOpen(false);
  };

  const togglePricePanel = () => {
    if (pricePanelOpen) {
      setPricePanelOpen(false);
      return;
    }

    priceFilterButton.current?.measureInWindow(
      (x, y, _width, height) => {
        const maxLeft = Math.max(
          16,
          window.width - pricePanelWidth - 16
        );

        setPricePanelPosition({
          left: Math.min(Math.max(16, x), maxLeft),
          top: y + height + 8,
        });

        setPricePanelOpen(true);
      }
    );
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
          {userPhotoURL && userPhotoURL !== failedPhotoURL ? (
            <Image
              source={{ uri: userPhotoURL }}
              style={styles.avatarImage}
              onError={() => setFailedPhotoURL(userPhotoURL)}
            />
          ) : (
            <Text style={styles.avatarText}>
              {userInitials || "?"}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.search}>
        <Text style={styles.icon}>{"\u2315"}</Text>

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
          <Text style={styles.sectionTitle}>
            Browse near you
          </Text>

          <Text style={styles.muted}>
            Good finds, close by
          </Text>
        </View>

        <Text style={styles.seeAll}>
          {visibleItems.length} items
        </Text>
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
            accessibilityState={{
              expanded: pricePanelOpen,
            }}
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
            {selectedPriceLabel ? `Price ${selectedPriceLabel}` : "Price Range"}
            </Text>

            <Text style={styles.priceChevron}>
              {pricePanelOpen ? "\u2303" : "\u2304"}
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
                      setPriceValidationError("");
                    }}
                    style={[
                      styles.pricePreset,
                      isSelected &&
                        styles.selectedPricePreset,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pricePresetText,
                        isSelected &&
                          styles.selectedPricePresetText,
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
                <Text style={styles.priceFieldLabel}>
                  From price
                </Text>

                <View style={styles.priceInput}>
                  <Text style={styles.currency}>$</Text>

                  <TextInput
                    value={fromPrice}
                    onChangeText={updateFromPrice}
                    placeholder="0"
                    placeholderTextColor="#87918C"
                    keyboardType="decimal-pad"
                    style={styles.priceInputText}
                  />
                </View>
              </View>

              <View style={styles.priceField}>
                <Text style={styles.priceFieldLabel}>
                  To price
                </Text>

                <View style={styles.priceInput}>
                  <Text style={styles.currency}>$</Text>

                  <TextInput
                    value={toPrice}
                    onChangeText={updateToPrice}
                    placeholder="1000"
                    placeholderTextColor="#87918C"
                    keyboardType="decimal-pad"
                    style={styles.priceInputText}
                  />
                </View>
              </View>
            </View>

            {priceValidationError ? (
              <Text accessibilityRole="alert" style={styles.priceError}>
                {priceValidationError}
              </Text>
            ) : null}

            <View style={styles.priceActions}>
              <Pressable
                style={styles.applyPriceButton}
                onPress={applyPriceFilter}
              >
                <Text style={styles.applyPriceText}>
                  Apply
                </Text>
              </Pressable>

              <Pressable
                onPress={clearPriceFilter}
                style={styles.clearPriceButton}
              >
                <Text style={styles.clearPriceText}>
                  Clear
                </Text>
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
  content: {
    padding: 20,
    paddingBottom: 110,
  },

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

  avatarText: {
    color: "#225347",
    fontWeight: "800",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
  },

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

  icon: {
    color: "#49635A",
    fontSize: 28,
    marginRight: 8,
  },

  input: {
    flex: 1,
    color: "#173C34",
    fontSize: 14,
  },

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

  muted: {
    color: "#87918C",
    fontSize: 12,
  },

  seeAll: {
    color: "#23775D",
    fontWeight: "700",
    fontSize: 12,
  },

  filterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  categoryScroller: {
    flex: 1,
    minWidth: 0,
  },

  categories: {
    gap: 8,
    paddingBottom: 22,
  },

  category: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#ECEFE9",
  },

  activeCategory: {
    backgroundColor: "#1F5D4C",
  },

  categoryText: {
    color: "#64736C",
    fontSize: 12,
    fontWeight: "700",
  },

  activeText: {
    color: "#FFF",
  },

  priceFilterButtonWrapper: {
    paddingBottom: 22,
  },

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

  priceFilterButtonText: {
    color: "#64736C",
    fontSize: 12,
    fontWeight: "700",
  },

  activePriceFilterButtonText: {
    color: "#386B54",
  },

  priceChevron: {
    color: "#64736C",
    fontSize: 14,
  },

  priceModal: {
    flex: 1,
    backgroundColor: "rgba(23, 60, 52, 0.06)",
  },

  priceFilter: {
    position: "absolute",
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6E9E2",
    padding: 16,
    shadowColor: "#173C34",
    shadowOffset: {
      width: 0,
      height: 8,
    },
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

  selectedPricePresetText: {
    color: "#386B54",
  },

  priceInputs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  priceField: {
    flex: 1,
  },

  priceFieldLabel: {
    color: "#64736C",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },

  priceError: {
    color: "#B33A3A",
    fontSize: 11,
    marginTop: 10,
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

  currency: {
    color: "#64736C",
    fontSize: 12,
    marginRight: 7,
  },

  priceInputText: {
    flex: 1,
    color: "#173C34",
    fontSize: 13,
    padding: 0,
  },

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

  applyPriceText: {
    color: "#386B54",
    fontSize: 13,
    fontWeight: "700",
  },

  clearPriceButton: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },

  clearPriceText: {
    color: "#64736C",
    fontSize: 13,
    fontWeight: "600",
  },

  grid: {
    gap: 14,
  },

  columns: {
    gap: 14,
  },

  empty: {
    textAlign: "center",
    color: "#87918C",
    padding: 30,
  },
});
