import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Plan } from "@/data/types";

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get<Plan[]>("/user/plans");
    setPlans(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  return { plans, loading, fetchPlans };
}
