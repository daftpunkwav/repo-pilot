import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${localStorage.getItem("repopilot_token") || ""}` },
      });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
  });
}
