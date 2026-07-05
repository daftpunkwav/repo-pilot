import { useQuery } from "@tanstack/react-query";

export function useAgent(sessionId?: string) {
  return useQuery({
    queryKey: ["agent", "sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/agent/sessions/${sessionId || ""}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("repopilot_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to fetch agent session");
      return res.json();
    },
    enabled: !!sessionId,
  });
}
