import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "../components/EmptyState";
import { getEffectiveStatus } from "../listingHelpers";
import { db } from "../firebase";
import { ChatMessage, Conversation, Listing } from "../types";

function timestampMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : 0;
  }
  return 0;
}

export function MessagesPage({
  userId,
  initialConversationId,
  messageProduct,
  onBrowse,
  onBackToInbox,
  onConversationOpened,
}: {
  userId: string | null;
  initialConversationId: string | null;
  messageProduct: Listing | null;
  onBrowse: () => void;
  onBackToInbox: () => void;
  onConversationOpened: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveConversationId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (!db || !userId) {
      setConversations([]);
      return;
    }
    const conversationsQuery = query(
      collection(db, "conversations"),
      where("memberIds", "array-contains", userId),
    );
    return onSnapshot(
      conversationsQuery,
      (snapshot) => {
        setConversations(
          snapshot.docs
            .map((conversationDocument) => {
              const data = conversationDocument.data();
              return {
                id: conversationDocument.id,
                memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((id): id is string => typeof id === "string") : [],
                memberNames: data.memberNames,
                lastMessage: typeof data.lastMessage === "string" ? data.lastMessage : "",
                lastMessageAt: data.lastMessageAt || null,
                updatedAt: data.updatedAt || null,
              };
            })
            .sort((a, b) => timestampMillis(b.lastMessageAt || b.updatedAt) - timestampMillis(a.lastMessageAt || a.updatedAt)),
        );
      },
      () => setError("Could not load your conversations. Please try again."),
    );
  }, [userId]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || null;

  if (!userId) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader />
        <EmptyState title="Sign in to message" message="Sign in to contact campus sellers and manage conversations." action="Browse listings" onAction={onBrowse} />
      </ScrollView>
    );
  }

  if (activeConversationId) {
    return (
      <ChatView
        key={activeConversationId}
        dbReady={!!db}
        userId={userId}
        conversation={activeConversation}
        conversationId={activeConversationId}
        messageProduct={messageProduct}
        onBack={() => {
          onBackToInbox();
          setActiveConversationId(null);
        }}
        onError={setError}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PageHeader />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {conversations.length === 0 ? (
        <EmptyState title="Your inbox is quiet" message="When you message a seller, conversations will show up here." action="Browse listings" onAction={onBrowse} />
      ) : (
        <FlatList
          data={conversations}
          scrollEnabled={false}
          keyExtractor={(conversation) => conversation.id}
          renderItem={({ item }) => {
            const otherId = item.memberIds.find((memberId) => memberId !== userId);
            const otherName = (otherId && item.memberNames?.[otherId]) || "Campus student";
            return (
              <Pressable style={styles.conversationRow} onPress={() => { setActiveConversationId(item.id); onConversationOpened(); }}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{otherName.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.conversationBody}>
                  <Text style={styles.conversationName}>{otherName}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage || "No messages yet"}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </ScrollView>
  );
}

function ChatView({
  dbReady,
  userId,
  conversation,
  conversationId,
  messageProduct,
  onBack,
  onError,
}: {
  dbReady: boolean;
  userId: string;
  conversation: Conversation | null;
  conversationId: string;
  messageProduct: Listing | null;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!dbReady || !db) return;
    return onSnapshot(
      collection(db, "conversations", conversationId, "messages"),
      (snapshot) => {
        setMessages(
          snapshot.docs
            .map((messageDocument) => {
              const data = messageDocument.data();
              return {
                id: messageDocument.id,
                senderId: typeof data.senderId === "string" ? data.senderId : "",
                text: typeof data.text === "string" ? data.text : "",
                createdAt: data.createdAt || null,
              };
            })
            .sort((a, b) => timestampMillis(a.createdAt) - timestampMillis(b.createdAt)),
        );
      },
      () => onError("Could not load messages. Please try again."),
    );
  }, [conversationId, dbReady, onError]);

  const otherName = useMemo(() => {
    const otherId = conversation?.memberIds.find((memberId) => memberId !== userId);
    return (otherId && conversation?.memberNames?.[otherId]) || "Campus student";
  }, [conversation, userId]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !db) return;
    setSending(true);
    try {
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: userId,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "conversations", conversationId), {
        lastMessage: trimmed,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setText("");
    } catch {
      onError("Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.chatContainer}>
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.chatTitle}>{otherName}</Text>
        <View style={styles.headerSpacer} />
      </View>
      {messageProduct ? <View style={styles.productContext}>
        <Image source={{ uri: messageProduct.image }} style={styles.productImage} resizeMode="contain" />
        <View style={styles.productBody}>
          <Text style={styles.contextLabel}>REGARDING THIS ITEM</Text>
          <Text style={styles.productTitle} numberOfLines={1}>{messageProduct.title}</Text>
          <Text style={styles.productMeta}>${messageProduct.price} · {getEffectiveStatus(messageProduct) === "sold" ? "SOLD OUT" : "AVAILABLE"}</Text>
        </View>
      </View> : null}
      <FlatList
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => <View style={[styles.bubble, item.senderId === userId ? styles.myBubble : styles.theirBubble]}><Text style={[styles.bubbleText, item.senderId === userId && styles.myBubbleText]}>{item.text}</Text></View>}
        ListEmptyComponent={<Text style={styles.emptyChat}>Start the conversation with {otherName}.</Text>}
      />
      <View style={styles.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Write a message..." placeholderTextColor="#9BA59F" style={styles.messageInput} multiline />
        <Pressable style={[styles.sendButton, (!text.trim() || sending) && styles.disabled]} onPress={() => void sendMessage()} disabled={!text.trim() || sending}>
          {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function PageHeader() {
  return <View><Text style={styles.pageTitle}>Messages</Text><Text style={styles.pageSubtitle}>Keep campus meetups simple</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110, flexGrow: 1 },
  pageTitle: { color: "#173C34", fontSize: 28, fontWeight: "800" },
  pageSubtitle: { color: "#87918C", fontSize: 13, marginTop: 5, marginBottom: 18 },
  error: { color: "#B3434B", backgroundColor: "#FDEDEE", padding: 12, borderRadius: 10, marginBottom: 12 },
  conversationRow: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10, borderRadius: 14, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E9ECE6" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EAF1EB", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#1F5D4C", fontWeight: "800", fontSize: 17 },
  conversationBody: { flex: 1, marginLeft: 12 },
  conversationName: { color: "#173C34", fontWeight: "800", fontSize: 14 },
  lastMessage: { color: "#87918C", marginTop: 4, fontSize: 13 },
  chatContainer: { flex: 1, paddingBottom: 92, backgroundColor: "#F8F8F4" },
  chatHeader: { height: 62, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E8EBE5" },
  back: { color: "#1F5D4C", fontSize: 34, lineHeight: 34 },
  chatTitle: { flex: 1, textAlign: "center", color: "#173C34", fontSize: 17, fontWeight: "800" },
  headerSpacer: { width: 20 },
  productContext: { flexDirection: "row", margin: 14, padding: 10, borderRadius: 14, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E9ECE6" },
  productImage: { width: 58, height: 58, backgroundColor: "#E5ECE5", borderRadius: 9 },
  productBody: { flex: 1, marginLeft: 10, justifyContent: "center" },
  contextLabel: { color: "#65766D", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  productTitle: { color: "#173C34", fontSize: 14, fontWeight: "800", marginTop: 4 },
  productMeta: { color: "#1C7057", fontSize: 12, fontWeight: "700", marginTop: 4 },
  messageList: { padding: 16, gap: 9, flexGrow: 1, justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", padding: 11, borderRadius: 15 },
  myBubble: { alignSelf: "flex-end", backgroundColor: "#1F5D4C", borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: "flex-start", backgroundColor: "#FFF", borderBottomLeftRadius: 4 },
  bubbleText: { color: "#365B4C", fontSize: 14, lineHeight: 20 },
  myBubbleText: { color: "#FFF" },
  emptyChat: { alignSelf: "center", color: "#87918C", marginBottom: 18 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E8EBE5" },
  messageInput: { flex: 1, maxHeight: 100, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: "#F3F6F2", color: "#173C34" },
  sendButton: { minHeight: 42, paddingHorizontal: 15, borderRadius: 12, backgroundColor: "#1F5D4C", alignItems: "center", justifyContent: "center" },
  sendText: { color: "#FFF", fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
