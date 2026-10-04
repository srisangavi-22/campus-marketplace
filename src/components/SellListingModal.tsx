import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { categories } from "../data";
import { Listing } from "../types";

export type CreateListingInput = {
  title: string;
  price: number;
  category: string;
  condition: string;
  campus: string;
  description: string;
  quantity: number;
  imageUri?: string | null;
  imageMimeType?: string | null;
  existingImageUrl?: string;
};

const MAX_PRODUCT_IMAGE_BYTES = 500 * 1024;

type Form = Omit<CreateListingInput, "price" | "quantity" | "imageUri" | "imageMimeType"> & {
  price: string;
  quantity: string;
};

const conditions = ["New", "Like new", "Good condition", "Fair condition"];
const listingCategories = categories.filter((item) => item !== "All Categories" && item !== "All items");
const emptyForm: Form = {
  title: "", price: "", category: "", condition: "", campus: "", description: "", quantity: "1",
};

export function SellListingModal({
  visible,
  onClose,
  onSubmit,
  listing,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateListingInput) => Promise<void>;
  listing?: Listing | null;
}) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const editing = !!listing;
  const [imageChanged, setImageChanged] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError("");
    setImageChanged(false);
    if (listing) {
      setForm({
        title: listing.title,
        price: String(listing.price),
        category: listing.category,
        condition: listing.condition,
        campus: listing.campus,
        description: listing.description || "",
        quantity: String(listing.quantity ?? (listing.status === "sold" ? 0 : 1)),
      });
      setImageUri(listing.image);
      setImageMimeType(null);
    } else {
      setForm(emptyForm);
      setImageUri(null);
      setImageMimeType(null);
    }
  }, [visible, listing]);

  const update = (field: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const chooseImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image?.uri || !image.base64) {
        setError("Could not read the selected image data. Please choose another image.");
        return;
      }
      const mimeType = image.mimeType || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${image.base64}`;
      const encodedImageBytes = Math.ceil(image.base64.length * 0.75);
      if (encodedImageBytes > MAX_PRODUCT_IMAGE_BYTES) {
        setError("Image is too large. Please choose a smaller image.");
        return;
      }
      setImageUri(dataUrl);
      setImageMimeType(mimeType);
      setImageChanged(true);
      setError("");
    } catch {
      setError("Could not choose an image. Please try again.");
    }
  };

  const resetAndClose = () => {
    if (publishing) return;
    setForm(emptyForm);
    setImageUri(null);
    setImageMimeType(null);
    setError("");
    onClose();
  };

  const publish = async () => {
    const price = Number(form.price.trim());
    const quantity = Number(form.quantity.trim());
    if (!form.title.trim()) return setError("Enter a title.");
    if (!form.price.trim() || !Number.isFinite(price) || price <= 0) return setError("Enter a price greater than 0.");
    if (!listingCategories.includes(form.category)) return setError("Choose a category.");
    if (!form.condition) return setError("Choose the item's condition.");
    if (!form.campus.trim()) return setError("Enter a campus or meetup location.");
    if (!form.description.trim()) return setError("Add a description.");
    if (!Number.isInteger(quantity) || quantity < (editing ? 0 : 1)) return setError(`Quantity must be a whole number of at least ${editing ? 0 : 1}.`);
    if (!imageUri) return setError("Please select a product image.");
    if (!editing && !imageChanged) return setError("Please select a product image.");

    setPublishing(true);
    setError("");
    try {
      await onSubmit({
        title: form.title.trim(),
        price,
        category: form.category,
        condition: form.condition,
        campus: form.campus.trim(),
        description: form.description.trim(),
        quantity,
        imageUri: imageChanged ? imageUri : null,
        imageMimeType,
        existingImageUrl: listing?.image,
      });
      setForm(emptyForm);
      setImageUri(null);
      setImageMimeType(null);
      onClose();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not publish this listing.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modal}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{editing ? "Edit listing" : "Create listing"}</Text>
            <Text style={styles.subtitle}>{editing ? "Update your listing details." : "Add an item for other students to discover."}</Text>
            <Field label="Title" placeholder="e.g. Calculus textbook" value={form.title} onChangeText={(v) => update("title", v)} />
            <Field label="Price" placeholder="0.00" value={form.price} onChangeText={(v) => update("price", v)} keyboardType="decimal-pad" />
            <Options label="Category" values={listingCategories} selected={form.category} onSelect={(v) => update("category", v)} />
            <Options label="Condition" values={conditions} selected={form.condition} onSelect={(v) => update("condition", v)} />
            <Field label="Campus" placeholder="e.g. North Campus" value={form.campus} onChangeText={(v) => update("campus", v)} />
            <Field label="Description" placeholder="Tell buyers about the item" value={form.description} onChangeText={(v) => update("description", v)} multiline />
            <Text style={styles.label}>Product image</Text>
            {imageUri ? (
              <View style={styles.previewContainer}><Image source={{ uri: imageUri }} style={styles.preview} /><Pressable style={styles.replaceButton} onPress={chooseImage} disabled={publishing}><Text style={styles.chooseText}>Replace image</Text></Pressable></View>
            ) : <Pressable style={styles.chooseButton} onPress={chooseImage} disabled={publishing}><Text style={styles.chooseText}>Choose image</Text></Pressable>}
            <Field label="Quantity" placeholder="1" value={form.quantity} onChangeText={(v) => update("quantity", v)} keyboardType="number-pad" />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.cancelButton]} onPress={resetAndClose} disabled={publishing}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.button, styles.publishButton]} onPress={publish} disabled={publishing}>{publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.publishText}>{editing ? "Save changes" : "Publish"}</Text>}</Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean; placeholder: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "decimal-pad" | "number-pad" }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput {...props} style={[styles.input, multiline && styles.multiline]} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} placeholderTextColor="#A0AAA4" /></View>;
}

function Options({ label, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  return <><Text style={styles.label}>{label}</Text><View style={styles.options}>{values.map((value) => <Pressable key={value} style={[styles.option, selected === value && styles.selectedOption]} onPress={() => onSelect(value)}><Text style={[styles.optionText, selected === value && styles.selectedOptionText]}>{value}</Text></Pressable>)}</View></>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23,60,52,.35)" },
  modal: { maxHeight: "92%", backgroundColor: "#F7F8F5", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { padding: 22, paddingBottom: 34 },
  title: { color: "#173C34", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#87918C", fontSize: 13, marginTop: 5, marginBottom: 10 },
  label: { color: "#365B4C", fontSize: 12, fontWeight: "700", marginTop: 14, marginBottom: 7 },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: "#DDE5DE", borderRadius: 12, backgroundColor: "#FFF", color: "#173C34" },
  multiline: { minHeight: 88, paddingTop: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: "#EAF1EB" },
  selectedOption: { backgroundColor: "#1F5D4C" },
  optionText: { color: "#365B4C", fontSize: 12, fontWeight: "600" },
  selectedOptionText: { color: "#FFF" },
  chooseButton: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#CBD8CE", justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
  chooseText: { color: "#1F5D4C", fontWeight: "800" },
  previewContainer: { borderRadius: 12, overflow: "hidden", backgroundColor: "#E5ECE5" },
  preview: { width: "100%", height: 150 },
  replaceButton: { minHeight: 42, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
  error: { color: "#B3434B", fontSize: 12, marginTop: 16 },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  button: { minHeight: 48, flex: 1, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  cancelButton: { borderWidth: 1, borderColor: "#CBD8CE" },
  publishButton: { backgroundColor: "#1F5D4C" },
  cancelText: { color: "#365B4C", fontWeight: "800" },
  publishText: { color: "#FFF", fontWeight: "800" },
});
