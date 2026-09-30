// The same api/ package is deployed to two hosts:
//   - 'swa': managed Functions inside the Static Web App (state, attachments, mcp-arm).
//   - 'mcp': a separate Azure Functions Flex Consumption app that claude.ai calls
//            directly (MCP + OAuth). SWA rewrites the Authorization header on
//            managed Functions, so bearer tokens can't reach /api/mcp there.
// PUNCH_FUNCTIONS_ROLE=mcp selects the MCP role; anything else is 'swa'.

export type FunctionsRole = 'swa' | 'mcp';

export function functionsRole(): FunctionsRole {
  return process.env.PUNCH_FUNCTIONS_ROLE === 'mcp' ? 'mcp' : 'swa';
}

export const isMcpHost = (): boolean => functionsRole() === 'mcp';

// The MCP host is deployed with host.json routePrefix "" (see
// deploy/prepare-mcp-host.mjs), so routes there carry the "api/" prefix explicitly.
export function route(path: string): string {
  return isMcpHost() ? `api/${path}` : path;
}
