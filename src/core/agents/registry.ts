import type { AgentDefinition } from "./types.js";

const agents = new Map<string, AgentDefinition>();

export function registerAgent(agent: AgentDefinition): void {
  agents.set(agent.id, agent);
}

export function getAgent(id: string): AgentDefinition | undefined {
  return agents.get(id);
}

export function getAllAgents(): AgentDefinition[] {
  return Array.from(agents.values());
}

export function getInstalledAgents(): AgentDefinition[] {
  return getAllAgents().filter((a) => a.detectInstalled());
}

export function getAgentIds(): string[] {
  return Array.from(agents.keys());
}
