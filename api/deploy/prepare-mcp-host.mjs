// Usage: node deploy/prepare-mcp-host.mjs <path-to-host.json>
// Deploy-time helper for the MCP Flex Consumption Function App only. Sets
// extensions.http.routePrefix to "" in place so the .well-known discovery routes
// live at the origin root (function routes carry an explicit "api/" prefix in the
// 'mcp' role, see src/role.ts). Run it on the host.json inside the deploy
// package, never on the repo copy: SWA managed Functions need the default "api".
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? 'host.json';
const host = JSON.parse(readFileSync(file, 'utf8'));
host.extensions ??= {};
host.extensions.http ??= {};
host.extensions.http.routePrefix = '';
writeFileSync(file, `${JSON.stringify(host, null, 2)}\n`);
console.log(`routePrefix cleared in ${file}`);
