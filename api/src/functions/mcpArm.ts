// POST /api/mcp-arm - owner-only. Opens a 5-minute window in which one MCP connection may be
// started (see src/oauth/arming.ts). Covered by the /api/* owner rule in staticwebapp.config.json;
// do not move it under /api/oauth/* (anonymous).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireOwner } from '../auth.js';
import { arm } from '../oauth/arming.js';

export async function mcpArmHandler(request: HttpRequest, context: Pick<InvocationContext, 'error'>): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }
  try {
    const armedUntil = await arm();
    return {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      jsonBody: { armedUntil: new Date(armedUntil).toISOString() },
    };
  } catch (error) {
    context.error('Failed to arm MCP connection', error instanceof Error ? error.message : 'unknown error');
    return { status: 500, jsonBody: { message: 'Failed to arm MCP connection.' } };
  }
}

app.http('mcpArm', { methods: ['POST'], authLevel: 'anonymous', route: 'mcp-arm', handler: mcpArmHandler });
