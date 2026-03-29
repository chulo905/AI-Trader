import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./layout/Sidebar";
import { TopNav } from "./layout/TopNav";

function isMockData(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  if (rec["isMock"] === true) return true;
  if (Array.isArray(rec["data"])) {
    const first = (rec["data"] as unknown[])[0];
    if (first != null && typeof first === "object" && (first as Record<string, unknown>)["isMock"] === true) return true;
  }
  return false;
}

function useHasMockData(): boolean {
  const qc = useQueryClient();

  const check = () => qc.getQueryCache().getAll().some(q => isMockData(q.state.data));

  const [hasMock, setHasMock] = useState<boolean>(check);

  useEffect(() => {
    const unsub = qc.getQueryCache().subscribe(() => {
      // Defer to avoid setState-during-render warning when a query resolves mid-render
      queueMicrotask(() => setHasMock(check()));
    });
    return unsub;
  }, [qc]);

  return hasMock;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const hasMockData = useHasMockData();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopNav hasMockData={hasMockData} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1440px] mx-auto p-4 md:p-5 lg:p-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
