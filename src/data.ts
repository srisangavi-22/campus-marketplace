import { Listing } from "./types";

export const categories = [
  "All Categories",
  "Textbooks",
  "Furniture",
  "Tech",
  "Electronics",
  "Fashion",
];

export const seedListings: Listing[] = [
  {
    id: "1",
    title: "Calculus: Early Transcendentals",
    price: 35,
    category: "Textbooks",
    seller: "Maya R.",
    campus: "North Campus",
    condition: "Like new",
    image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800",
    description: "Barely used and ready for your next math class.",
  },
  {
    id: "2",
    title: "Walnut study desk",
    price: 80,
    category: "Furniture",
    seller: "Jordan K.",
    campus: "West Village",
    condition: "Good condition",
    image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800",
    description: "Solid walnut desk with room for a monitor and books.",
  },
  {
    id: "3",
    title: "Noise-cancelling headphones",
    price: 120,
    category: "Tech",
    seller: "Alex P.",
    campus: "East Quad",
    condition: "Like new",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    description: "Wireless headphones with case and charging cable.",
  },
  {
    id: "4",
    title: "Vintage varsity jacket",
    price: 45,
    category: "Fashion",
    seller: "Sam T.",
    campus: "North Campus",
    condition: "Good condition",
    image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800",
    description: "A warm, classic layer with a relaxed fit.",
  },
];
