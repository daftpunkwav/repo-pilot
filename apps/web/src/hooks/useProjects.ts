import { useQuery } from "@tanstack/react-query";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/v1/projects", {
        headers: { Authorization: `Bearer ${localStorage.getItem("repopilot_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      return data.data;
    },
  });
}
