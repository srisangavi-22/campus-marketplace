import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  FieldPath,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
} from "react-native";
import { EmptyState } from "../components/EmptyState";
import { getEffectiveStatus } from "../listingHelpers";
import { db } from "../firebase";
import { ChatMessage, Conversation, ProductContextMessage, ReplySnapshot } from "../types";

function timestampMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : 0;
  }
  return 0;
}

function resolvedTimestamp(value: unknown): unknown | null {
  return timestampMillis(value) > 0 ? value : null;
}

export function useUnreadMessageState(userId: string | null): {
  total: number;
  byConversation: Record<string, number>;
  latestByConversation: Record<string, InboxMessageSummary>;
} {
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
    const [latestByConversation, setLatestByConversation] = useState<Record<string, InboxMessageSummary>>({});

    useEffect(() => {
      if (!db || !userId) {
        setUnreadCount(0);
        setUnreadByConversation({});
        setLatestByConversation({});
        return;
      }
      const firestore = db;

      let messageUnsubscribers: (() => void)[] = [];
      const conversationsQuery = query(
        collection(db, "conversations"),
        where("memberIds", "array-contains", userId),
      );

      const unsubscribeConversations = onSnapshot(conversationsQuery, (snapshot) => {
        messageUnsubscribers.forEach((unsubscribe) => unsubscribe());
        messageUnsubscribers = [];
        const counts = new Map<string, number>();
        const latestMessages = new Map<string, InboxMessageSummary>();
        const updateCount = () => {
          const next = Object.fromEntries(counts.entries());
          const latest = Object.fromEntries(latestMessages.entries());
          setUnreadByConversation(next);
          setLatestByConversation(latest);
          setUnreadCount(Object.values(next).reduce((sum, count) => sum + count, 0));
        };

        snapshot.docs.forEach((conversationDocument) => {
          const data = conversationDocument.data();
          const lastReadAt = timestampMillis(data.lastReadAt?.[userId]);
          const clearedAt = timestampMillis(data.clearedAt?.[userId]);
          const messagesQuery = collection(
            firestore,
            "conversations",
            conversationDocument.id,
            "messages",
          );
          const unsubscribe = onSnapshot(messagesQuery, (messageSnapshot) => {
            const count = messageSnapshot.docs.filter((messageDocument) => {
              const message = messageDocument.data();
              const createdAt = timestampMillis(message.createdAt);
              return (
                message.senderId !== userId &&
                !message.hiddenFor?.[userId] &&
                createdAt > lastReadAt &&
                createdAt > clearedAt
              );
            }).length;
            const visibleMessages = messageSnapshot.docs
              .map((messageDocument) => {
                const message = messageDocument.data();
                const createdAt = timestampMillis(message.createdAt);
                if (
                  !createdAt ||
                  createdAt <= clearedAt ||
                  message.hiddenFor?.[userId]
                ) {
                  return null;
                }
                return {
                  id: messageDocument.id,
                  createdAt,
                  preview:
                    message.type === "product_context" && typeof message.title === "string"
                      ? `Regarding: ${message.title}`
                      : typeof message.text === "string"
                        ? message.text
                        : "",
                };
              })
              .filter((message): message is InboxMessageSummary => message !== null)
              .sort((a, b) => a.createdAt - b.createdAt);
            const latest = visibleMessages[visibleMessages.length - 1];
            if (latest) {
              latestMessages.set(conversationDocument.id, latest);
            } else {
              latestMessages.delete(conversationDocument.id);
            }
              counts.set(conversationDocument.id, count);
              updateCount();
          });
          messageUnsubscribers.push(unsubscribe);
        });
        updateCount();
      });
      return () => {
        unsubscribeConversations();
        messageUnsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    }, [userId]);

    return { total: unreadCount, byConversation: unreadByConversation, latestByConversation };
  }

export const useUnreadMessageCount = (userId: string | null) =>
  useUnreadMessageState(userId).total;

type InboxMessageSummary = {
  id: string;
  createdAt: number;
  preview: string;
};

export function MessagesPage({
  userId,
  initialConversationId,
  onBrowse,
  onBackToInbox,
  unreadByConversation,
  latestByConversation,
}: {
  userId: string | null;
  initialConversationId: string | null;
  onBrowse: () => void;
  onBackToInbox: () => void;
  unreadByConversation: Record<string, number>;
  latestByConversation: Record<string, InboxMessageSummary>;
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
                lastReadAt: data.lastReadAt,
                clearedAt: data.clearedAt,
                lastMessage: typeof data.lastMessage === "string" ? data.lastMessage : "",
                lastMessageAt: data.lastMessageAt || null,
                updatedAt: data.updatedAt || null,
              };
            }),
        );
      },
      () => setError("Could not load your conversations. Please try again."),
    );
  }, [userId]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || null;
  const orderedConversations = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const aLatest = latestByConversation[a.id];
        const bLatest = latestByConversation[b.id];
        if (!aLatest && !bLatest) return 0;
        if (!aLatest) return 1;
        if (!bLatest) return -1;
        return bLatest.createdAt - aLatest.createdAt;
      }),
    [conversations, latestByConversation],
  );

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
          data={orderedConversations}
          scrollEnabled={false}
          keyExtractor={(conversation) => conversation.id}
          renderItem={({ item }) => {
            const otherId = item.memberIds.find((memberId) => memberId !== userId);
            const otherName = (otherId && item.memberNames?.[otherId]) || "Campus student";
            return (
              <Pressable style={styles.conversationRow} onPress={() => setActiveConversationId(item.id)}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{otherName.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.conversationBody}>
                  <Text style={styles.conversationName}>{otherName}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {latestByConversation[item.id]?.preview || "No messages"}
                  </Text>
                </View>
                {(unreadByConversation[item.id] || 0) > 0 ? (
                  <View style={styles.conversationBadge}>
                    <Text style={styles.conversationBadgeText}>{(unreadByConversation[item.id] || 0) > 99 ? "99+" : unreadByConversation[item.id]}</Text>
                  </View>
                ) : null}
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
  onBack,
  onError,
}: {
  dbReady: boolean;
  userId: string;
  conversation: Conversation | null;
  conversationId: string;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplySnapshot | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const clearedAtMillis = timestampMillis(conversation?.clearedAt?.[userId]);
  const lastMarkedMessageId = useRef<string | null>(null);

  const markRead = async (latestIncomingCreatedAt: unknown): Promise<boolean> => {
    if (!db) return false;
    const readAt = resolvedTimestamp(latestIncomingCreatedAt);
    if (!readAt) return false;
    try {
      await updateDoc(
        doc(db, "conversations", conversationId),
        new FieldPath("lastReadAt", userId),
        readAt,
      );
      return true;
    } catch {
      onError("Could not update your message read state. Please try again.");
      return false;
    }
  };

  const clearChat = async () => {
    if (!db) return;
    try {
      await updateDoc(
        doc(db, "conversations", conversationId),
        new FieldPath("clearedAt", userId),
        serverTimestamp(),
        new FieldPath("lastReadAt", userId),
        serverTimestamp(),
      );
      setClearConfirmVisible(false);
    } catch {
      onError("Could not clear this conversation. Please try again.");
    }
  };

  const deleteMessage = async () => {
    if (!db || !messageToDelete) return;
    try {
      if (messageToDelete.senderId === userId) {
        await deleteDoc(doc(db, "conversations", conversationId, "messages", messageToDelete.id));
      } else {
        await updateDoc(
          doc(db, "conversations", conversationId, "messages", messageToDelete.id),
          new FieldPath("hiddenFor", userId),
          true,
        );
      }
      setMessageToDelete(null);
    } catch {
      onError("Could not delete this message. Please try again.");
    }
  };

  useEffect(() => {
    if (!dbReady || !db) return;
    lastMarkedMessageId.current = null;
    return onSnapshot(
      collection(db, "conversations", conversationId, "messages"),
      (snapshot) => {
        const nextMessages = snapshot.docs
            .map((messageDocument) => {
              const data = messageDocument.data();
              return toChatMessage(messageDocument.id, data);
            })
            .filter((message): message is ChatMessage => message !== null)
            .filter((message) => timestampMillis(message.createdAt) > clearedAtMillis)
            .filter((message) => !message.hiddenFor?.[userId])
            .sort((a, b) => timestampMillis(a.createdAt) - timestampMillis(b.createdAt));
        setMessages(nextMessages);
        const latestIncomingMessage = [...nextMessages]
          .reverse()
          .find((message) => message.senderId !== userId);
        const lastReadMillis = timestampMillis(conversation?.lastReadAt?.[userId]);
        if (
          latestIncomingMessage &&
          (lastReadMillis === 0 || timestampMillis(latestIncomingMessage.createdAt) > lastReadMillis) &&
          latestIncomingMessage.id !== lastMarkedMessageId.current &&
          resolvedTimestamp(latestIncomingMessage.createdAt)
        ) {
          lastMarkedMessageId.current = latestIncomingMessage.id;
          void markRead(latestIncomingMessage.createdAt).then((didMarkRead) => {
            if (!didMarkRead && lastMarkedMessageId.current === latestIncomingMessage.id) {
              lastMarkedMessageId.current = null;
            }
          });
        }
      },
      () => onError("Could not load messages. Please try again."),
    );
  }, [conversationId, dbReady, onError, clearedAtMillis]);

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
        type: "text",
        senderId: userId,
        text: trimmed,
        ...(replyingTo ? { replyTo: replyingTo } : {}),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "conversations", conversationId), {
        lastMessage: trimmed,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setText("");
      setReplyingTo(null);
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
        <Pressable onPress={() => setClearConfirmVisible(true)} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear chat</Text>
        </Pressable>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => item.type === "product_context" ? (
          <ProductContextCard context={item} userId={userId} onReply={setReplyingTo} onDelete={setMessageToDelete} />
        ) : (
          <View style={[styles.messageEntry, item.senderId === userId ? styles.currentEntry : styles.otherEntry]}>
            {item.replyTo ? <ReplyQuote reply={item.replyTo} /> : null}
            <View style={styles.messageRow}>
              <View style={[styles.bubble, item.senderId === userId ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.bubbleText, item.senderId === userId && styles.myBubbleText]}>{item.text}</Text>
              </View>
              <View>
                <Pressable style={styles.replyAction} onPress={() => setReplyingTo(createReplySnapshot(item))}>
                  <Text style={styles.replyActionText}>Reply</Text>
                </Pressable>
                <Pressable style={styles.deleteAction} onPress={() => setMessageToDelete(item)}>
                  <Text style={styles.deleteActionText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyChat}>Start the conversation with {otherName}.</Text>}
      />
      {replyingTo ? (
        <View style={styles.replyPreview}>
          <View style={styles.replyPreviewBody}>
            <Text style={styles.replyPreviewLabel}>
              {replyingTo.type === "product_context" ? "Replying to product" : `Replying to ${replyingTo.senderId === userId ? "You" : otherName}`}
            </Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {replyingTo.type === "product_context"
                ? `${replyingTo.title} - $${replyingTo.price}`
                : `"${replyingTo.text}"`}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyingTo(null)}>
            <Text style={styles.closeReply}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Write a message..." placeholderTextColor="#9BA59F" style={styles.messageInput} multiline />
        <Pressable style={[styles.sendButton, (!text.trim() || sending) && styles.disabled]} onPress={() => void sendMessage()} disabled={!text.trim() || sending}>
          {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
      <Modal visible={messageToDelete !== null} transparent animationType="fade" onRequestClose={() => setMessageToDelete(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete message?</Text>
            <Text style={styles.confirmMessage}>
              {messageToDelete?.senderId === userId
                ? "This message will be removed from the conversation for everyone."
                : "This message will be removed from the conversation for you."}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancel} onPress={() => setMessageToDelete(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmDelete} onPress={() => void deleteMessage()}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={clearConfirmVisible} transparent animationType="fade" onRequestClose={() => setClearConfirmVisible(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Clear chat?</Text>
            <Text style={styles.confirmMessage}>This will clear the conversation history for you. It will remain available to the other participant.</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancel} onPress={() => setClearConfirmVisible(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmDelete} onPress={() => void clearChat()}>
                <Text style={styles.confirmDeleteText}>Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function toChatMessage(
  id: string,
  data: Record<string, unknown>,
): ChatMessage | null {
  if (
    data.type === "product_context" &&
    typeof data.senderId === "string" &&
    typeof data.listingId === "string" &&
    typeof data.title === "string" &&
    typeof data.price === "number" &&
    typeof data.image === "string" &&
    typeof data.quantity === "number" &&
    (data.status === "available" || data.status === "sold")
  ) {
    return {
      id,
      type: "product_context",
      senderId: data.senderId,
      listingId: data.listingId,
      title: data.title,
      price: data.price,
      image: data.image,
      quantity: data.quantity,
      status: data.status,
      hiddenFor: isHiddenFor(data.hiddenFor),
      createdAt: data.createdAt || null,
    };
  }

  if (typeof data.senderId === "string" && typeof data.text === "string") {
    return {
      id,
      type: data.type === "text" ? "text" : undefined,
      senderId: data.senderId,
      text: data.text,
      replyTo: toReplySnapshot(data.replyTo),
      hiddenFor: isHiddenFor(data.hiddenFor),
      createdAt: data.createdAt || null,
    };
  }

  return null;
}

function isHiddenFor(value: unknown): Record<string, boolean> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const hiddenFor: Record<string, boolean> = {};
  Object.entries(value).forEach(([userId, hidden]) => {
    if (typeof hidden === "boolean") hiddenFor[userId] = hidden;
  });
  return Object.keys(hiddenFor).length > 0 ? hiddenFor : undefined;
}

function toReplySnapshot(value: unknown): ReplySnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (
    typeof data.messageId !== "string" ||
    (data.type !== "text" && data.type !== "product_context") ||
    typeof data.senderId !== "string"
  ) return undefined;
  if (data.type === "text" && typeof data.text !== "string") return undefined;
  if (
    data.type === "product_context" &&
    (typeof data.listingId !== "string" ||
      typeof data.title !== "string" ||
      typeof data.price !== "number")
  ) return undefined;
  return {
    messageId: data.messageId,
    type: data.type,
    senderId: data.senderId,
    ...(typeof data.text === "string" ? { text: data.text } : {}),
    ...(typeof data.listingId === "string" ? { listingId: data.listingId } : {}),
    ...(typeof data.title === "string" ? { title: data.title } : {}),
    ...(typeof data.price === "number" ? { price: data.price } : {}),
  };
}

function createReplySnapshot(message: ChatMessage): ReplySnapshot {
  if (message.type === "product_context") {
    return {
      messageId: message.id,
      type: "product_context",
      senderId: message.senderId,
      listingId: message.listingId,
      title: message.title,
      price: message.price,
    };
  }
  return {
    messageId: message.id,
    type: "text",
    senderId: message.senderId,
    text: message.text,
  };
}

function ReplyQuote({ reply }: { reply: ReplySnapshot }) {
  return (
    <View style={styles.replyQuote}>
      <Text style={styles.replyQuoteLabel}>
        {reply.type === "product_context" ? "Replying to product:" : "Replying to:"}
      </Text>
      <Text style={styles.replyQuoteText} numberOfLines={1}>
        {reply.type === "product_context" ? `${reply.title} - $${reply.price}` : `"${reply.text}"`}
      </Text>
    </View>
  );
}

function ProductContextCard({
  context,
  userId,
  onReply,
  onDelete,
}: {
  context: ProductContextMessage;
  userId: string;
  onReply: (reply: ReplySnapshot) => void;
  onDelete: (message: ProductContextMessage) => void;
}) {
  return (
    <View style={[styles.messageEntry, context.senderId === userId ? styles.currentEntry : styles.otherEntry]}>
      <View style={styles.productContext}>
        <Image source={{ uri: context.image }} style={styles.productImage} resizeMode="contain" />
        <View style={styles.productBody}>
          <Text style={styles.contextLabel}>REGARDING THIS ITEM</Text>
          <Text style={styles.productTitle} numberOfLines={1}>{context.title}</Text>
          <Text style={styles.productMeta}>
            ${context.price} · {getEffectiveStatus(context) === "sold" ? "SOLD OUT" : "AVAILABLE"}
          </Text>
        </View>
        <Pressable style={styles.replyAction} onPress={() => onReply(createReplySnapshot(context))}>
          <Text style={styles.replyActionText}>Reply</Text>
        </Pressable>
        {context.senderId === userId ? (
          <Pressable style={styles.deleteAction} onPress={() => onDelete(context)}>
            <Text style={styles.deleteActionText}>Delete</Text>
          </Pressable>
        ) : null}
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
  conversationBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: "#C3535B", alignItems: "center", justifyContent: "center" },
  conversationBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
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
  clearButton: { paddingVertical: 8, paddingLeft: 8 },
  clearButtonText: { color: "#B3434B", fontSize: 11, fontWeight: "800" },
  productContext: { flexDirection: "row", margin: 14, padding: 10, borderRadius: 14, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E9ECE6" },
  productImage: { width: 58, height: 58, backgroundColor: "#E5ECE5", borderRadius: 9 },
  productBody: { flex: 1, marginLeft: 10, justifyContent: "center" },
  contextLabel: { color: "#65766D", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  productTitle: { color: "#173C34", fontSize: 14, fontWeight: "800", marginTop: 4 },
  productMeta: { color: "#1C7057", fontSize: 12, fontWeight: "700", marginTop: 4 },
  messageEntry: { gap: 4 },
  currentEntry: { alignSelf: "flex-end" },
  otherEntry: { alignSelf: "flex-start" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  replyAction: { paddingHorizontal: 6, paddingVertical: 4 },
  replyActionText: { color: "#1F5D4C", fontSize: 11, fontWeight: "700" },
  deleteAction: { paddingHorizontal: 6, paddingVertical: 4 },
  deleteActionText: { color: "#B3434B", fontSize: 11, fontWeight: "700" },
  replyQuote: { alignSelf: "flex-start", maxWidth: "78%", paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: "#1F5D4C", backgroundColor: "#EAF2EC", borderRadius: 6 },
  replyQuoteLabel: { color: "#65766D", fontSize: 10, fontWeight: "800" },
  replyQuoteText: { color: "#365B4C", fontSize: 12, marginTop: 2 },
  replyPreview: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "#EAF2EC", borderTopWidth: 1, borderTopColor: "#D7E4D9" },
  replyPreviewBody: { flex: 1 },
  replyPreviewLabel: { color: "#1F5D4C", fontSize: 11, fontWeight: "800" },
  replyPreviewText: { color: "#365B4C", fontSize: 12, marginTop: 2 },
  closeReply: { color: "#1F5D4C", fontSize: 24, lineHeight: 24, paddingHorizontal: 8 },
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
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(15,40,33,.45)", justifyContent: "center" },
  confirmCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 22, margin: 20 },
  confirmTitle: { color: "#173C34", fontSize: 20, fontWeight: "800" },
  confirmMessage: { color: "#64736C", fontSize: 14, lineHeight: 20, marginTop: 10 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  confirmCancel: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#CBD8CE", alignItems: "center", justifyContent: "center" },
  confirmCancelText: { color: "#365B4C", fontWeight: "800" },
  confirmDelete: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#B3434B", alignItems: "center", justifyContent: "center" },
  confirmDeleteText: { color: "#FFF", fontWeight: "800" },
});
