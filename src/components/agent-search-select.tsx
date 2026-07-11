"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type AgentOption = {
  id: string;
  full_name: string | null;
  location: string | null;
};

export function AgentSearchSelect({ agents }: { agents: AgentOption[] }) {
  const [query, setQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return agents.slice(0, 8);
    }

    return agents
      .filter((agent) => `${agent.full_name ?? ""} ${agent.location ?? ""}`.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [agents, query]);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
      <input type="hidden" name="preferred_agent_id" value={selectedAgentId} />
      <label className="text-sm font-extrabold text-[var(--primary)]">Preferred agent</label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3">
        <Search size={16} className="text-[var(--muted)]" />
        <input
          className="min-h-12 flex-1 bg-transparent text-sm font-bold outline-none"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents by name or location"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={`button ${selectedAgentId ? "button-outline" : "button-primary"} px-3 py-2 text-xs`}
          type="button"
          onClick={() => setSelectedAgentId("")}
        >
          Any agent
        </button>
        {filteredAgents.map((agent) => (
          <button
            key={agent.id}
            className={`button ${selectedAgentId === agent.id ? "button-primary" : "button-outline"} px-3 py-2 text-xs`}
            type="button"
            onClick={() => setSelectedAgentId(agent.id)}
          >
            {agent.full_name ?? "Hazi agent"}{agent.location ? ` - ${agent.location}` : ""}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--muted)]">
        {selectedAgent ? `${selectedAgent.full_name ?? "This agent"} will be assigned automatically.` : "Leave as Any agent if you want Hazi.ng to assign someone."}
      </p>
    </div>
  );
}
