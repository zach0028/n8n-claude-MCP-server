import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
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
    // Liste des tools disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_workflows',
            description: 'List all n8n workflows',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_workflow',
            description: 'Get details of a specific workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to retrieve',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'create_workflow',
            description: 'Create a new n8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the workflow',
                },
                nodes: {
                  type: 'array',
                  description: 'Array of workflow nodes',
                },
                connections: {
                  type: 'object',
                  description: 'Node connections configuration',
                },
              },
              required: ['name', 'nodes'],
            },
          },
          {
            name: 'execute_workflow',
            description: 'Execute a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to execute',
                },
                data: {
                  type: 'object',
                  description: 'Input data for the workflow',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'list_node_types',
            description: 'List all available n8n node types',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Exécution des tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_workflows':
            return await this.listWorkflows();

          case 'get_workflow':
            return await this.getWorkflow(args.workflowId);

          case 'create_workflow':
            return await this.createWorkflow(args);

          case 'execute_workflow':
            return await this.executeWorkflow(args.workflowId, args.data);

          case 'list_node_types':
            return await this.listNodeTypes();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // Méthodes d'API n8n
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
            type: 'text',
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
              type: 'text',
              text: 'Error: Invalid API key. Please check your n8n API key configuration.',
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  async getWorkflow(workflowId) {
    const workflow = await this.makeApiRequest(`/workflows/${workflowId}`);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow: ${workflow.name}\nID: ${workflow.id}\nActive: ${workflow.active}\nNodes: ${workflow.nodes.length}\nConnections: ${JSON.stringify(workflow.connections, null, 2)}`,
        },
      ],
    };
  }

  async createWorkflow({ name, nodes, connections = {} }) {
    const workflowData = {
      name,
      nodes,
      connections,
      active: false,
      settings: {},
    };

    const result = await this.makeApiRequest('/workflows', 'POST', workflowData);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow created successfully!\nID: ${result.id}\nName: ${result.name}`,
        },
      ],
    };
  }

  async executeWorkflow(workflowId, data = {}) {
    const result = await this.makeApiRequest(`/workflows/${workflowId}/execute`, 'POST', { data });
    return {
      content: [
        {
          type: 'text',
          text: `Workflow executed!\nExecution ID: ${result.executionId}\nStatus: ${result.status}`,
        },
      ],
    };
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
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      if (error.response?.status === 401) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Invalid API key. Please check your n8n API key configuration.',
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