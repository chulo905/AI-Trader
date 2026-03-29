import { create } from "zustand";

interface AppState {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
}

export const useAppState = create<AppState>((set) => ({
  selectedSymbol: "AAPL",
  setSelectedSymbol: (symbol: string) => set({ selectedSymbol: symbol.toUpperCase() }),
}));
