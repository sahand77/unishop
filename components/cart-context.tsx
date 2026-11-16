"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type BasketItem = { id: string; productId: string; title: string; variant: string; price: number; image: string; quantity: number };
const basketKey = "unishop-basket";
type Basket = {
  items: BasketItem[]; ready: boolean;
  add: (item: BasketItem, available: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  consume: (snapshot: { id: string; quantity: number }[]) => void;
};
const Context = createContext<Basket | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items,setItems] = useState<BasketItem[]>([]);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(basketKey) || "[]");
      if (Array.isArray(stored)) setItems(stored.filter((item) => item && typeof item.id === "string" && Number.isInteger(item.quantity) && item.quantity > 0));
    } catch { /* A malformed saved cart starts empty. */ }
    setReady(true);
  },[]);
  useEffect(() => {
    if (ready) localStorage.setItem(basketKey,JSON.stringify(items));
  },[items,ready]);
  function add(item: BasketItem, available: number) {
    setItems((before) => {
      const previous = before.find((line) => line.id === item.id);
      const next = { ...item, quantity: Math.min(available,99,(previous?.quantity || 0)+item.quantity) };
      return previous ? before.map((line) => line.id === item.id ? next : line) : [...before,next];
    });
  }
  function setQuantity(id: string, quantity: number) {
    setItems((before) => quantity <= 0 ? before.filter((item) => item.id !== id)
      : before.map((item) => item.id === id ? { ...item, quantity: Math.min(quantity,99) } : item));
  }
  function consume(snapshot: { id: string; quantity: number }[]) {
    setItems((before) => before.map((item) => {
      const ordered = snapshot.find((line) => line.id === item.id);
      return ordered ? { ...item, quantity: item.quantity - ordered.quantity } : item;
    }).filter((item) => item.quantity > 0));
  }
  return <Context.Provider value={{ items,ready,add,setQuantity,consume }}>{children}</Context.Provider>;
}

export function useCart() {
  const basket = useContext(Context);
  if (!basket) throw new Error("CartProvider is required");
  return basket;
}