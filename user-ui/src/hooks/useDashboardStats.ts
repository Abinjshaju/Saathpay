import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/data/types";

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardStats>("/user/dashboard")
      .then(({ data }) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  return { stats, loading };
}
