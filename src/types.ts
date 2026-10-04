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

export type Tab = "Explore" | "Saved" | "Messages" | "Profile" | "MyListings";

export type Conversation = {
  id: string;
  memberIds: string[];
  memberNames?: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: { toMillis?: () => number } | null;
  updatedAt?: { toMillis?: () => number } | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: { toMillis?: () => number } | null;
};
