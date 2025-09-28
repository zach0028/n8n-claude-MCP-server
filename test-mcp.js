#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Test simple du serveur MCP
const server = new Server(
  {
    name: 'test-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function main() {
  console.error('Test MCP server starting...');

  // Test basique pour voir si le serveur peut être créé
  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [
        {
          name: "test_tool",
          description: "Test tool",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test MCP server running on stdio');
}

main().catch(console.error);