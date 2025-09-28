#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';

// Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

class N8nMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'n8n-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // Liste des outils
    this.server.setRequestHandler("tools/list", async () => {
      return {
        tools: [
          {
            name: "list_workflows",
            description: "List all n8n workflows",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "list_node_types",
            description: "List all available n8n node types",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    });

    // Exécution des outils
    this.server.setRequestHandler("tools/call", async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_workflows":
            return await this.listWorkflows();

          case "list_node_types":
            return await this.listNodeTypes();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // Méthodes API n8n
  async makeApiRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${N8N_API_URL}/api/v1${endpoint}`,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  async listWorkflows() {
    try {
      const workflows = await this.makeApiRequest('/workflows');
      return {
        content: [
          {
            type: "text",
            text: `Found ${workflows.data.length} workflows:\n\n` +
                  workflows.data.map(w => `- ${w.name} (ID: ${w.id}) - ${w.active ? 'Active' : 'Inactive'}`).join('\n'),
          },
        ],
      };
    } catch (error) {
      if (error.response?.status === 401) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Invalid API key. Please check your n8n API key configuration.",
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  async listNodeTypes() {
    try {
      const nodeTypes = await this.makeApiRequest('/node-types');
      const categories = {};

      Object.values(nodeTypes).forEach(node => {
        const category = node.codex?.categories?.[0] || 'Other';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push({
          name: node.displayName,
          type: node.name,
          description: node.description,
        });
      });

      let output = 'Available n8n Node Types:\n\n';
      Object.keys(categories).sort().forEach(category => {
        output += `## ${category}\n`;
        categories[category].forEach(node => {
          output += `- **${node.name}** (${node.type}): ${node.description}\n`;
        });
        output += '\n';
      });

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      if (error.response?.status === 401) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Invalid API key. Please check your n8n API key configuration.",
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8n MCP server running on stdio');
  }
}

// Démarrer le serveur
const server = new N8nMcpServer();
server.run().catch(console.error);