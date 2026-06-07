import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ConversationSummary } from "@/shared/types";

interface AppContextValue {
  refreshConversations: () => Promise<ConversationSummary[]>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  refreshConversations,
}: {
  children: ReactNode;
  refreshConversations: () => Promise<ConversationSummary[]>;
}) {
  const value = useMemo(
    () => ({ refreshConversations }),
    [refreshConversations]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return ctx;
}
