import { useProfile } from "@/hooks/use-profile";
import { getDatabase } from "@/modules/database";
import { syncDatabase } from "@/modules/database/sync";
import { flushSwipeQueueNow } from "@/modules/discovery/swipe-queue-orchestrator";
import { logger } from "@/utils/logger";
import { Database } from "@nozbe/watermelondb";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

const DatabaseContext = createContext<Database | null>(null);

/**
 * Provider que inicializa e disponibiliza a instância do WatermelonDB
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<Database | null>(null);
  const { profile } = useProfile();

  useEffect(() => {
    const initDb = async () => {
      try {
        const db = await getDatabase();
        setDatabase(db);
        logger.log("✅ DatabaseProvider initialized");
      } catch (error) {
        logger.error("Failed to initialize database in provider:", error);
      }
    };

    initDb();
  }, []);

  // Foreground sync to avoid missing messages if socket was down
  useEffect(() => {
    if (!database || !profile?.id) return;

    let currentState = AppState.currentState;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (currentState.match(/inactive|background/) && nextState === "active") {
        logger.log("📱 App active, running foreground sync");
        void flushSwipeQueueNow({ database, reason: "foreground" });
        syncDatabase(database).catch((error) => {
          logger.error("Foreground sync failed:", error);
        });
      }
      currentState = nextState;
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    // Initial sync when authenticated
    logger.log("🔄 User authenticated, starting initial sync");
    syncDatabase(database).catch((error) => {
      logger.error("Initial sync failed:", error);
    });
    void flushSwipeQueueNow({ database, reason: "app-start" });

    return () => sub.remove();
  }, [database, profile?.id]);

  if (!database) {
    // Enquanto carrega, retorna null (ou pode retornar loading screen)
    return null;
  }

  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook para acessar a instância do database
 */
export function useDatabase(): Database {
  const database = useContext(DatabaseContext);

  if (!database) {
    throw new Error("useDatabase must be used within DatabaseProvider");
  }

  return database;
}
