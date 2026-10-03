import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { EmptyState } from "../components/EmptyState";
import { ListingCard } from "../components/ListingCard";
import { PageTitle } from "../components/PageTitle";
import { Listing } from "../types";
export function SavedPage({
  items,
  onSave,
  onOpen,
}: {
  items: Listing[];
  onSave: (id: string) => void;
  onOpen: (item: Listing) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PageTitle
        title="Saved items"
        subtitle="Your shortlist, all in one place"
      />
      <FlatList
        data={items}
        scrollEnabled={false}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <EmptyState
            title="No saved items yet"
            message="Listings you save will appear here."
          />
        }
        renderItem={({ item }) => (
          <ListingCard
            item={item}
            saved
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
  columns: { gap: 14 },
  grid: { gap: 14 },
});
