import {
  ArrowDownLeft, ArrowLeftRight, ShoppingBasket, Car, UtensilsCrossed, Repeat, Clapperboard,
  ShoppingBag, Plane, Zap, HeartPulse, Gift, CircleDollarSign, type LucideIcon,
} from "lucide-react";

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
  emoji: string;
};

export const CATEGORIES: Category[] = [
  { id: "deposit", label: "Deposit", icon: ArrowDownLeft, emoji: "🎉" },
  { id: "investment", label: "Bot trade", icon: Zap, emoji: "⚡" },
  { id: "investment_payout", label: "Trade payout", icon: Gift, emoji: "🎉" },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight, emoji: "🤝" },
  { id: "groceries", label: "Groceries", icon: ShoppingBasket, emoji: "🛒" },
  { id: "food", label: "Food & Drink", icon: UtensilsCrossed, emoji: "🍜" },
  { id: "transport", label: "Transport", icon: Car, emoji: "🚕" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, emoji: "🛍️" },
  { id: "subscriptions", label: "Subscriptions", icon: Repeat, emoji: "🔁" },
  { id: "entertainment", label: "Entertainment", icon: Clapperboard, emoji: "🍿" },
  { id: "travel", label: "Travel", icon: Plane, emoji: "✈️" },
  { id: "bills", label: "Bills", icon: Zap, emoji: "⚡" },
  { id: "health", label: "Health", icon: HeartPulse, emoji: "💊" },
  { id: "gifts", label: "Gifts", icon: Gift, emoji: "🎁" },
  { id: "other", label: "Other", icon: CircleDollarSign, emoji: "💸" },
];

export const getCategory = (id: string) =>
  (CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]) as Category;

export const formatMoney = (n: number, sign = false) => {
  const s = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(n));
  if (!sign) return n < 0 ? `-${s}` : s;
  return n < 0 ? `-${s}` : `+${s}`;
};
