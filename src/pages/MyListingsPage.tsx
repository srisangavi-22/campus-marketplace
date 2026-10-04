import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../components/EmptyState";
import { ListingCard } from "../components/ListingCard";
import { PageTitle } from "../components/PageTitle";
import { getEffectiveQuantity, getEffectiveStatus } from "../listingHelpers";
import { Listing } from "../types";
export function MyListingsPage({
  items,
  onOpen,
  onSell,
  busyById,
  error,
  onClearError,
  onIncrease,
  onDecrease,
  onRecordSale,
  onEdit,
  onDelete,
}: {
  items: Listing[];
  onOpen: (item: Listing) => void;
  onSell: () => void;
  busyById: Record<string, boolean>;
  error: string;
  onClearError: () => void;
  onIncrease: (item: Listing) => void;
  onDecrease: (item: Listing) => void;
  onRecordSale: (item: Listing) => void;
  onEdit: (item: Listing) => void;
  onDelete: (item: Listing) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <PageTitle title="My listings" subtitle="Items you have posted to campus marketplace" />
        {items.length > 0 && <Pressable style={styles.newButton} onPress={onSell}><Text style={styles.newButtonText}>+ New listing</Text></Pressable>}
      </View>
      {!!error && <Pressable style={styles.errorBox} onPress={onClearError}><Text style={styles.errorText}>{error}</Text></Pressable>}
      <FlatList
        data={items}
        scrollEnabled={false}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <EmptyState
            title="No listings yet"
            message="Publish an item and it will appear here."
            action="Sell an item"
            onAction={onSell}
          />
        }
        renderItem={({ item }) => {
          const quantity = getEffectiveQuantity(item);
          const status = getEffectiveStatus(item);
          const busy = !!busyById[item.id];
          return <View style={styles.listingColumn}>
            <ListingCard item={item} saved={false} onSave={() => undefined} onOpen={() => onOpen(item)} />
            <View style={styles.inventory}>
              <Text style={styles.stockText}>Stock: {quantity}</Text>
              <Text style={[styles.statusText, status === "sold" && styles.soldText]}>{status === "sold" ? "SOLD OUT" : "AVAILABLE"}</Text>
              <View style={styles.stockControls}>
                <Pressable style={[styles.stockButton, quantity === 0 && styles.disabledButton]} onPress={() => onDecrease(item)} disabled={busy || quantity === 0}><Text style={styles.stockButtonText}>-</Text></Pressable>
                <Text style={styles.quantityText}>{quantity}</Text>
                <Pressable style={styles.stockButton} onPress={() => onIncrease(item)} disabled={busy}><Text style={styles.stockButtonText}>+</Text></Pressable>
              </View>
              <Pressable style={[styles.saleButton, busy && styles.disabledButton]} onPress={() => onRecordSale(item)} disabled={busy}><Text style={styles.saleButtonText}>{busy ? "Updating..." : "Record Sale"}</Text></Pressable>
              <View style={styles.actions}>
                <Pressable style={styles.editButton} onPress={() => onEdit(item)} disabled={busy}><Text style={styles.editText}>Edit</Text></Pressable>
                <Pressable style={styles.deleteButton} onPress={() => onDelete(item)} disabled={busy}><Text style={styles.deleteText}>Delete</Text></Pressable>
              </View>
            </View>
          </View>;
        }}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110 },
  columns: { gap: 14, justifyContent: "center" },
  grid: { gap: 14 },
  listingColumn: { flex: 1, minWidth: 0, maxWidth: 420 },
  heading: { position: "relative" },
  newButton: { position: "absolute", right: 0, top: 30, borderRadius: 12, backgroundColor: "#1F5D4C", paddingHorizontal: 12, paddingVertical: 10 },
  newButtonText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  inventory: { marginTop: -5, padding: 12, borderWidth: 1, borderColor: "#E9ECE6", borderTopWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: "#FFF" },
  stockText: { color: "#365B4C", fontSize: 12, fontWeight: "700" },
  statusText: { color: "#1C7057", fontSize: 11, fontWeight: "800", marginTop: 4 },
  soldText: { color: "#B3434B" },
  stockControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 10 },
  stockButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1EB" },
  disabledButton: { opacity: 0.5 },
  stockButtonText: { color: "#1F5D4C", fontSize: 20, fontWeight: "800" },
  quantityText: { minWidth: 20, color: "#173C34", textAlign: "center", fontWeight: "800" },
  saleButton: { minHeight: 38, marginTop: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#1F5D4C" },
  saleButtonText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  errorBox: { marginBottom: 14, padding: 12, borderRadius: 10, backgroundColor: "#FDEDEE" },
  errorText: { color: "#B3434B", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  editButton: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#CBD8CE" },
  editText: { color: "#1F5D4C", fontSize: 12, fontWeight: "800" },
  deleteButton: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#FDEDEE" },
  deleteText: { color: "#B3434B", fontSize: 12, fontWeight: "800" },
});
