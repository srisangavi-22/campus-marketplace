export type Listing = {
  id: string;
  title: string;
  price: number;
  category: string;
  seller: string;
  sellerId?: string;
  campus: string;
  condition: string;
  image: string;
  description?: string;
  quantity?: number;
  status?: "available" | "sold";
};

export type ProductContext = {
  listingId: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  status: "available" | "sold";
};

export type Tab = "Explore" | "Saved" | "Messages" | "Profile" | "MyListings";

export type Conversation = {
  id: string;
  memberIds: string[];
  memberNames?: Record<string, string>;
  lastReadAt?: Record<string, { toMillis?: () => number } | null>;
  clearedAt?: Record<string, { toMillis?: () => number } | null>;
  lastMessage?: string;
  lastMessageAt?: { toMillis?: () => number } | null;
  updatedAt?: { toMillis?: () => number } | null;
};

export type ReplySnapshot = {
  messageId: string;
  type: "text" | "product_context";
  senderId: string;
  text?: string;
  listingId?: string;
  title?: string;
  price?: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  type?: "text";
  text: string;
  replyTo?: ReplySnapshot;
  hiddenFor?: Record<string, boolean>;
  createdAt?: { toMillis?: () => number } | null;
} | ProductContextMessage;

export type ProductContextMessage = ProductContext & {
  id: string;
  senderId: string;
  type: "product_context";
  hiddenFor?: Record<string, boolean>;
  createdAt?: { toMillis?: () => number } | null;
};
