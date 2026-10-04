import { Listing } from "./types";

export function getEffectiveQuantity(listing: Listing): number {
  if (typeof listing.quantity === "number" && Number.isFinite(listing.quantity)) {
    return Math.max(0, listing.quantity);
  }
  return listing.status === "sold" ? 0 : 1;
}

export function getEffectiveStatus(listing: Listing): "available" | "sold" {
  return getEffectiveQuantity(listing) <= 0 ? "sold" : "available";
}
