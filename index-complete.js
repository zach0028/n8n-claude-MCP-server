import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const advancedTools = require('./advanced-node-manipulation-tools.cjs');

// Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

/**
 * N8N MCP Server - Version Complète
 * 
 * Serveur MCP complet pour n8n avec manipulation fine des nœuds
 * @version 2.0.0
 * @date 2025-01-29
 */
class N8nMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'n8n-mcp-server-complete',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // Liste complète des tools disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // ===== OUTILS DE BASE =====
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
            name: 'update_workflow',
            description: 'Update an existing workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to update',
                },
                name: {
                  type: 'string',
                  description: 'New name (optional)',
                },
                nodes: {
                  type: 'array',
                  description: 'Updated nodes array (optional)',
                },
                connections: {
                  type: 'object',
                  description: 'Updated connections (optional)',
                },
                active: {
                  type: 'boolean',
                  description: 'Activate or deactivate workflow (optional)',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'delete_workflow',
            description: 'Delete a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to delete',
                },
              },
              required: ['workflowId'],
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

          // ===== CREDENTIALS MANAGEMENT =====
          {
            name: 'list_credentials',
            description: 'List all credentials configured in n8n',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_credential',
            description: 'Get details of a specific credential',
            inputSchema: {
              type: 'object',
              properties: {
                credentialId: {
                  type: 'string',
                  description: 'ID of the credential to retrieve',
                },
              },
              required: ['credentialId'],
            },
          },
          {
            name: 'create_credential',
            description: 'Create a new credential in n8n',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the credential',
                },
                type: {
                  type: 'string',
                  description: 'Credential type (e.g., "httpBasicAuth", "oAuth2Api", "slackApi")',
                },
                data: {
                  type: 'object',
                  description: 'Credential data (depends on type)',
                },
              },
              required: ['name', 'type', 'data'],
            },
          },
          {
            name: 'update_credential',
            description: 'Update an existing credential',
            inputSchema: {
              type: 'object',
              properties: {
                credentialId: {
                  type: 'string',
                  description: 'ID of the credential to update',
                },
                name: {
                  type: 'string',
                  description: 'New name (optional)',
                },
                data: {
                  type: 'object',
                  description: 'New credential data (optional)',
                },
              },
              required: ['credentialId'],
            },
          },
          {
            name: 'delete_credential',
            description: 'Delete a credential from n8n',
            inputSchema: {
              type: 'object',
              properties: {
                credentialId: {
                  type: 'string',
                  description: 'ID of the credential to delete',
                },
              },
              required: ['credentialId'],
            },
          },

          // ===== EXECUTIONS MANAGEMENT =====
          {
            name: 'list_executions',
            description: 'List workflow executions with filtering options',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'Filter by workflow ID (optional)',
                },
                status: {
                  type: 'string',
                  enum: ['success', 'error', 'waiting', 'running'],
                  description: 'Filter by execution status (optional)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results (default: 20)',
                  default: 20,
                },
              },
            },
          },
          {
            name: 'get_execution',
            description: 'Get details of a specific workflow execution',
            inputSchema: {
              type: 'object',
              properties: {
                executionId: {
                  type: 'string',
                  description: 'ID of the execution to retrieve',
                },
              },
              required: ['executionId'],
            },
          },
          {
            name: 'delete_execution',
            description: 'Delete a workflow execution',
            inputSchema: {
              type: 'object',
              properties: {
                executionId: {
                  type: 'string',
                  description: 'ID of the execution to delete',
                },
              },
              required: ['executionId'],
            },
          },

          // ===== WEBHOOK MANAGEMENT =====
          {
            name: 'get_workflow_webhooks',
            description: 'Get all webhook URLs for a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'trigger_webhook',
            description: 'Trigger a workflow webhook with custom data',
            inputSchema: {
              type: 'object',
              properties: {
                webhookPath: {
                  type: 'string',
                  description: 'Webhook path (e.g., "my-webhook")',
                },
                method: {
                  type: 'string',
                  enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                  description: 'HTTP method (default: POST)',
                  default: 'POST',
                },
                data: {
                  type: 'object',
                  description: 'Data to send to webhook',
                },
                headers: {
                  type: 'object',
                  description: 'Custom headers (optional)',
                },
              },
              required: ['webhookPath'],
            },
          },
          {
            name: 'test_webhook',
            description: 'Test a webhook by triggering it and returning the response',
            inputSchema: {
              type: 'object',
              properties: {
                webhookPath: {
                  type: 'string',
                  description: 'Webhook path to test',
                },
                testData: {
                  type: 'object',
                  description: 'Test data to send',
                },
              },
              required: ['webhookPath'],
            },
          },

          // ===== OUTILS AVANCÉS DE MANIPULATION DE NŒUDS =====
          {
            name: 'describe_node_type',
            description: 'Get complete documentation for a specific n8n node type, including all parameters, credentials, and examples',
            inputSchema: {
              type: 'object',
              properties: {
                nodeType: {
                  type: 'string',
                  description: 'Node type (e.g., "n8n-nodes-base.httpRequest", "n8n-nodes-base.webhook")',
                },
              },
              required: ['nodeType'],
            },
          },
          {
            name: 'configure_node_parameters',
            description: 'Configure specific parameters of a node with granular control and validation',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow containing the node',
                },
                nodeId: {
                  type: 'string',
                  description: 'ID or name of the node to modify',
                },
                parameterPath: {
                  type: 'string',
                  description: 'JSON path to the parameter (e.g., "url", "headerParameters.parameters[0].value")',
                },
                value: {
                  description: 'Value to set for the parameter',
                },
              },
              required: ['workflowId', 'nodeId', 'parameterPath', 'value'],
            },
          },
          {
            name: 'add_node_expression',
            description: 'Add or modify an n8n expression in a node parameter with syntax validation',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
                nodeId: {
                  type: 'string',
                  description: 'ID or name of the node',
                },
                parameterPath: {
                  type: 'string',
                  description: 'Path to the parameter to set the expression',
                },
                expression: {
                  type: 'string',
                  description: 'n8n expression (must be wrapped in ={{...}})',
                },
                contextHelp: {
                  type: 'boolean',
                  description: 'Include contextual help about the expression',
                  default: false,
                },
              },
              required: ['workflowId', 'nodeId', 'parameterPath', 'expression'],
            },
          },
          {
            name: 'configure_node_code',
            description: 'Configure JavaScript code for Function or Code nodes with validation',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
                nodeId: {
                  type: 'string',
                  description: 'ID or name of the node',
                },
                code: {
                  type: 'string',
                  description: 'JavaScript code to execute',
                },
                codeType: {
                  type: 'string',
                  enum: ['function', 'code'],
                  description: 'Type of code node ("function" for Function node, "code" for Code node)',
                },
                mode: {
                  type: 'string',
                  enum: ['runOnceForAllItems', 'runOnceForEachItem'],
                  description: 'Execution mode (only for Code nodes)',
                  default: 'runOnceForAllItems',
                },
              },
              required: ['workflowId', 'nodeId', 'code', 'codeType'],
            },
          },
          {
            name: 'configure_node_credentials',
            description: 'Configure authentication credentials for a node',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
                nodeId: {
                  type: 'string',
                  description: 'ID or name of the node',
                },
                credentialType: {
                  type: 'string',
                  description: 'Type of credential (e.g., "httpBasicAuth", "oAuth2Api")',
                },
                credentialId: {
                  type: 'string',
                  description: 'ID of the existing credential to use',
                },
              },
              required: ['workflowId', 'nodeId', 'credentialType', 'credentialId'],
            },
          },
          {
            name: 'get_code_snippet',
            description: 'Get reusable code snippets for Function and Code nodes',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Snippet category (e.g., "dataTransformation", "filtering", "aggregation"). Leave empty to list all categories.',
                },
                snippetName: {
                  type: 'string',
                  description: 'Name of the specific snippet. Leave empty to list all snippets in the category.',
                },
              },
            },
          },
          {
            name: 'validate_workflow_node',
            description: 'Validate a node definition before adding it to a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                nodeDefinition: {
                  type: 'object',
                  description: 'Complete node definition to validate',
                },
              },
              required: ['nodeDefinition'],
            },
          },
          {
            name: 'discover_node',
            description: '🚀 NOUVEAU: Discover ANY n8n node dynamically from the n8n API. Use this to get documentation for nodes not in the local database (Slack, Gmail, OpenAI, etc.). This enables 100% node coverage!',
            inputSchema: {
              type: 'object',
              properties: {
                nodeType: {
                  type: 'string',
                  description: 'Node type to discover (e.g., "n8n-nodes-base.slack", "n8n-nodes-base.gmail", "n8n-nodes-base.openai")',
                },
              },
              required: ['nodeType'],
            },
          },

          // ===== OUTILS DE MODIFICATION FINE =====
          {
            name: 'modify_single_node',
            description: 'Modify a specific node in a workflow without affecting other nodes',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
                nodeId: {
                  type: 'string',
                  description: 'ID or name of the node to modify',
                },
                nodeUpdates: {
                  type: 'object',
                  description: 'Properties to update (name, parameters, position, notes, disabled, etc.)',
                },
              },
              required: ['workflowId', 'nodeId', 'nodeUpdates'],
            },
          },
          {
            name: 'add_nodes_to_workflow',
            description: 'Add new nodes to an existing workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
                nodes: {
                  type: 'array',
                  description: 'Array of new nodes to add',
                },
                autoConnect: {
                  type: 'boolean',
                  description: 'Automatically create connections to existing nodes',
                  default: false,
                },
              },
              required: ['workflowId', 'nodes'],
            },
          },
          {
            name: 'remove_nodes_from_workflow',
            description: 'Remove specific nodes from a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'ID of the workflow',
                },
                nodeIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of node IDs or names to remove',
                },
                cleanupConnections: {
                  type: 'boolean',
                  description: 'Automatically cleanup connections to/from removed nodes',
                  default: true,
                },
              },
              required: ['workflowId', 'nodeIds'],
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
          // Outils de base
          case 'list_workflows':
            return await this.listWorkflows();
          case 'get_workflow':
            return await this.getWorkflow(args.workflowId);
          case 'create_workflow':
            return await this.createWorkflow(args);
          case 'update_workflow':
            return await this.updateWorkflow(args);
          case 'delete_workflow':
            return await this.deleteWorkflow(args.workflowId);
          case 'execute_workflow':
            return await this.executeWorkflow(args.workflowId, args.data);
          case 'list_node_types':
            return await this.listNodeTypes();

          // Credentials management
          case 'list_credentials':
            return await this.listCredentials();
          case 'get_credential':
            return await this.getCredential(args.credentialId);
          case 'create_credential':
            return await this.createCredential(args);
          case 'update_credential':
            return await this.updateCredential(args);
          case 'delete_credential':
            return await this.deleteCredential(args.credentialId);

          // Executions management
          case 'list_executions':
            return await this.listExecutions(args);
          case 'get_execution':
            return await this.getExecution(args.executionId);
          case 'delete_execution':
            return await this.deleteExecution(args.executionId);

          // Webhook management
          case 'get_workflow_webhooks':
            return await this.getWorkflowWebhooks(args.workflowId);
          case 'trigger_webhook':
            return await this.triggerWebhook(args);
          case 'test_webhook':
            return await this.testWebhook(args);

          // Outils avancés de manipulation
          case 'describe_node_type':
            return await this.describeNodeType(args.nodeType);
          case 'discover_node':
            return await this.discoverNode(args.nodeType);
          case 'configure_node_parameters':
            return await this.configureNodeParameters(args);
          case 'add_node_expression':
            return await this.addNodeExpression(args);
          case 'configure_node_code':
            return await this.configureNodeCode(args);
          case 'configure_node_credentials':
            return await this.configureNodeCredentials(args);
          case 'get_code_snippet':
            return this.getCodeSnippet(args.category, args.snippetName);
          case 'validate_workflow_node':
            return this.validateWorkflowNode(args.nodeDefinition);

          // Outils de modification fine
          case 'modify_single_node':
            return await this.modifySingleNode(args);
          case 'add_nodes_to_workflow':
            return await this.addNodesToWorkflow(args);
          case 'remove_nodes_from_workflow':
            return await this.removeNodesFromWorkflow(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n\nStack: ${error.stack}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Handler pour MCP Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'n8n://documentation/nodes',
            name: 'Node Types Documentation',
            description: 'Complete documentation of all n8n node types with parameters',
            mimeType: 'application/json',
          },
          {
            uri: 'n8n://documentation/expressions',
            name: 'n8n Expressions Guide',
            description: '100+ examples of n8n expressions ($json, $node, $now, etc.)',
            mimeType: 'text/markdown',
          },
          {
            uri: 'n8n://documentation/snippets',
            name: 'Code Snippets Library',
            description: '30+ reusable code snippets for common tasks',
            mimeType: 'application/json',
          },
          {
            uri: 'n8n://workflows/list',
            name: 'User Workflows',
            description: 'List of all workflows in the n8n instance',
            mimeType: 'application/json',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      try {
        if (uri === 'n8n://documentation/nodes') {
          const fs = await import('fs/promises');
          const nodesData = JSON.parse(await fs.readFile('./node-parameters-database.json', 'utf-8'));
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(nodesData, null, 2),
              },
            ],
          };
        }

        if (uri === 'n8n://documentation/expressions') {
          const fs = await import('fs/promises');
          const expressionsGuide = await fs.readFile('./N8N_EXPRESSIONS_GUIDE.md', 'utf-8');
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: expressionsGuide,
              },
            ],
          };
        }

        if (uri === 'n8n://documentation/snippets') {
          const fs = await import('fs/promises');
          const snippets = JSON.parse(await fs.readFile('./node-code-snippets.json', 'utf-8'));
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(snippets, null, 2),
              },
            ],
          };
        }

        if (uri === 'n8n://workflows/list') {
          const workflows = await this.makeApiRequest('/api/v1/workflows');
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(workflows.data, null, 2),
              },
            ],
          };
        }

        throw new Error(`Unknown resource URI: ${uri}`);
      } catch (error) {
        throw new Error(`Failed to read resource: ${error.message}`);
      }
    });

    // Handler pour MCP Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'create_workflow',
            description: 'Guide to create a new n8n workflow step by step',
            arguments: [
              {
                name: 'workflowPurpose',
                description: 'What the workflow should accomplish',
                required: true,
              },
            ],
          },
          {
            name: 'debug_workflow',
            description: 'Help debug a workflow that is not working correctly',
            arguments: [
              {
                name: 'workflowId',
                description: 'ID of the workflow to debug',
                required: true,
              },
              {
                name: 'issue',
                description: 'Description of the problem',
                required: true,
              },
            ],
          },
          {
            name: 'optimize_workflow',
            description: 'Suggestions to optimize workflow performance',
            arguments: [
              {
                name: 'workflowId',
                description: 'ID of the workflow to optimize',
                required: true,
              },
            ],
          },
        ],
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'create_workflow') {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `I want to create an n8n workflow that: ${args.workflowPurpose}\n\nPlease guide me through:\n1. What nodes I need\n2. How to configure each node\n3. How to connect them\n4. Best practices for this type of workflow`,
              },
            },
          ],
        };
      }

      if (name === 'debug_workflow') {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please help me debug workflow ${args.workflowId}.\n\nIssue: ${args.issue}\n\nSteps:\n1. Get the workflow details\n2. Analyze the configuration\n3. Check recent executions\n4. Identify the problem\n5. Suggest fixes`,
              },
            },
          ],
        };
      }

      if (name === 'optimize_workflow') {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please analyze workflow ${args.workflowId} and suggest optimizations for:\n1. Performance (reduce execution time)\n2. Error handling (make it more robust)\n3. Maintainability (better organization)\n4. Best practices (n8n conventions)`,
              },
            },
          ],
        };
      }

      throw new Error(`Unknown prompt: ${name}`);
    });
  }

  // ===== MÉTHODES D'API n8n =====
  
  async makeApiRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${N8N_API_URL}${endpoint}`,
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
      const workflows = await this.makeApiRequest('/api/v1/workflows');
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
    const workflow = await this.makeApiRequest(`/api/v1/workflows/${workflowId}`);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow: ${workflow.name}\nID: ${workflow.id}\nActive: ${workflow.active}\nNodes: ${workflow.nodes.length}\n\nNodes:\n${workflow.nodes.map(n => `- ${n.name} (${n.type})`).join('\n')}\n\nConnections:\n${JSON.stringify(workflow.connections, null, 2)}`,
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

    const result = await this.makeApiRequest('/api/v1/workflows', 'POST', workflowData);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow created successfully!\nID: ${result.id}\nName: ${result.name}`,
        },
      ],
    };
  }

  async updateWorkflow({ workflowId, name, nodes, connections, active }) {
    // Récupérer le workflow actuel
    const workflow = await this.makeApiRequest(`/api/v1/workflows/${workflowId}`);
    
    // Mettre à jour uniquement les champs fournis
    if (name !== undefined) workflow.name = name;
    if (nodes !== undefined) workflow.nodes = nodes;
    if (connections !== undefined) workflow.connections = connections;
    if (active !== undefined) workflow.active = active;

    const result = await this.makeApiRequest(`/api/v1/workflows/${workflowId}`, 'PATCH', workflow);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow updated successfully!\nID: ${result.id}\nName: ${result.name}`,
        },
      ],
    };
  }

  async deleteWorkflow(workflowId) {
    await this.makeApiRequest(`/api/v1/workflows/${workflowId}`, 'DELETE');
    return {
      content: [
        {
          type: 'text',
          text: `Workflow ${workflowId} deleted successfully!`,
        },
      ],
    };
  }

  async executeWorkflow(workflowId, data = {}) {
    const result = await this.makeApiRequest(`/api/v1/workflows/${workflowId}/execute`, 'POST', { data });
    return {
      content: [
        {
          type: 'text',
          text: `Workflow executed!\nExecution ID: ${result.executionId}\nStatus: ${result.status}`,
        },
      ],
    };
  }

  // ===== CREDENTIALS MANAGEMENT METHODS =====

  async listCredentials() {
    try {
      const credentials = await this.makeApiRequest('/api/v1/credentials');
      return {
        content: [
          {
            type: 'text',
            text: `Found ${credentials.data?.length || 0} credentials:\n\n` +
                  (credentials.data?.map(c => `- ${c.name} (Type: ${c.type}, ID: ${c.id})`).join('\n') || 'No credentials found'),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'listing credentials');
    }
  }

  async getCredential(credentialId) {
    try {
      const credential = await this.makeApiRequest(`/api/v1/credentials/${credentialId}`);
      return {
        content: [
          {
            type: 'text',
            text: `Credential: ${credential.name}\nType: ${credential.type}\nID: ${credential.id}\nCreated: ${credential.createdAt}`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'retrieving credential');
    }
  }

  async createCredential({ name, type, data }) {
    try {
      const credentialData = {
        name,
        type,
        data,
      };
      const result = await this.makeApiRequest('/api/v1/credentials', 'POST', credentialData);
      return {
        content: [
          {
            type: 'text',
            text: `Credential created successfully!\nID: ${result.id}\nName: ${result.name}\nType: ${result.type}`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'creating credential');
    }
  }

  async updateCredential({ credentialId, name, data }) {
    try {
      const credential = await this.makeApiRequest(`/api/v1/credentials/${credentialId}`);
      if (name) credential.name = name;
      if (data) credential.data = { ...credential.data, ...data };

      const result = await this.makeApiRequest(`/api/v1/credentials/${credentialId}`, 'PATCH', credential);
      return {
        content: [
          {
            type: 'text',
            text: `Credential updated successfully!\nID: ${result.id}\nName: ${result.name}`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'updating credential');
    }
  }

  async deleteCredential(credentialId) {
    try {
      await this.makeApiRequest(`/api/v1/credentials/${credentialId}`, 'DELETE');
      return {
        content: [
          {
            type: 'text',
            text: `Credential ${credentialId} deleted successfully!`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'deleting credential');
    }
  }

  // ===== EXECUTIONS MANAGEMENT METHODS =====

  async listExecutions({ workflowId, status, limit = 20 }) {
    try {
      let endpoint = `/api/v1/executions?limit=${limit}`;
      if (workflowId) endpoint += `&workflowId=${workflowId}`;
      if (status) endpoint += `&status=${status}`;

      const executions = await this.makeApiRequest(endpoint);
      return {
        content: [
          {
            type: 'text',
            text: `Found ${executions.data?.length || 0} executions:\n\n` +
                  (executions.data?.map(e =>
                    `- Execution ${e.id}\n` +
                    `  Workflow: ${e.workflowData?.name || e.workflowId}\n` +
                    `  Status: ${e.status}\n` +
                    `  Started: ${e.startedAt}\n` +
                    `  ${e.stoppedAt ? `Finished: ${e.stoppedAt}` : 'Still running'}`
                  ).join('\n\n') || 'No executions found'),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'listing executions');
    }
  }

  async getExecution(executionId) {
    try {
      const execution = await this.makeApiRequest(`/api/v1/executions/${executionId}`);
      return {
        content: [
          {
            type: 'text',
            text: `Execution ${execution.id}\n` +
                  `Workflow: ${execution.workflowData?.name || execution.workflowId}\n` +
                  `Status: ${execution.status}\n` +
                  `Mode: ${execution.mode}\n` +
                  `Started: ${execution.startedAt}\n` +
                  `${execution.stoppedAt ? `Finished: ${execution.stoppedAt}` : 'Still running'}\n` +
                  `${execution.data ? `\nData:\n${JSON.stringify(execution.data, null, 2)}` : ''}`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'retrieving execution');
    }
  }

  async deleteExecution(executionId) {
    try {
      await this.makeApiRequest(`/api/v1/executions/${executionId}`, 'DELETE');
      return {
        content: [
          {
            type: 'text',
            text: `Execution ${executionId} deleted successfully!`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'deleting execution');
    }
  }

  // ===== WEBHOOK MANAGEMENT METHODS =====

  async getWorkflowWebhooks(workflowId) {
    try {
      const workflow = await this.makeApiRequest(`/api/v1/workflows/${workflowId}`);
      const webhookNodes = workflow.nodes.filter(node =>
        node.type === 'n8n-nodes-base.webhook' ||
        node.type.toLowerCase().includes('webhook')
      );

      if (webhookNodes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No webhook nodes found in workflow "${workflow.name}"`,
            },
          ],
        };
      }

      const webhookUrls = webhookNodes.map(node => {
        const path = node.parameters?.path || 'undefined';
        const method = node.parameters?.httpMethod || 'POST';
        const isTestWebhook = node.parameters?.mode === 'webhook' || !workflow.active;
        const prefix = isTestWebhook ? 'webhook-test' : 'webhook';

        return {
          nodeName: node.name,
          nodeId: node.id,
          path: path,
          method: method,
          url: `${N8N_API_URL}/${prefix}/${path}`,
          isTest: isTestWebhook,
        };
      });

      const output = `Found ${webhookUrls.length} webhook(s) in workflow "${workflow.name}":\n\n` +
        webhookUrls.map(w =>
          `**${w.nodeName}** (${w.nodeId})\n` +
          `  Method: ${w.method}\n` +
          `  Path: ${w.path}\n` +
          `  URL: ${w.url}\n` +
          `  Mode: ${w.isTest ? 'Test/Inactive' : 'Production/Active'}`
        ).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'retrieving webhooks');
    }
  }

  async triggerWebhook({ webhookPath, method = 'POST', data = {}, headers = {} }) {
    try {
      const webhookUrl = `${N8N_API_URL}/webhook/${webhookPath}`;

      const config = {
        method,
        url: webhookUrl,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        config.data = data;
      }

      const response = await axios(config);

      return {
        content: [
          {
            type: 'text',
            text: `Webhook triggered successfully!\n` +
                  `URL: ${webhookUrl}\n` +
                  `Method: ${method}\n` +
                  `Status: ${response.status}\n` +
                  `Response:\n${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'triggering webhook');
    }
  }

  async testWebhook({ webhookPath, testData = { test: true } }) {
    try {
      const testWebhookUrl = `${N8N_API_URL}/webhook-test/${webhookPath}`;

      const response = await axios.post(testWebhookUrl, testData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `Webhook test successful!\n` +
                  `URL: ${testWebhookUrl}\n` +
                  `Status: ${response.status}\n` +
                  `Response:\n${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          content: [
            {
              type: 'text',
              text: `Webhook not found at path "${webhookPath}". Make sure:\n` +
                    `1. The workflow exists and has a webhook node\n` +
                    `2. The webhook path matches the node configuration\n` +
                    `3. The workflow is saved (test webhooks work even if inactive)`,
            },
          ],
          isError: true,
        };
      }
      return this.handleError(error, 'testing webhook');
    }
  }

  // Helper method for error handling
  handleError(error, action) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    let errorText = `Error ${action}: ${message}`;

    if (status === 401) {
      errorText = 'Error: Invalid API key. Please check your n8n API key configuration.';
    } else if (status === 404) {
      errorText = `Error: Resource not found while ${action}.`;
    } else if (status === 403) {
      errorText = `Error: Access forbidden while ${action}. Check your permissions.`;
    }

    return {
      content: [
        {
          type: 'text',
          text: errorText,
        },
      ],
      isError: true,
    };
  }

  async listNodeTypes() {
    try {
      const nodeTypes = await this.makeApiRequest('/api/v1/node-types');
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

  // ===== MÉTHODES AVANCÉES =====

  async describeNodeType(nodeType) {
    // AMÉLIORÉ: Utilise maintenant le fallback dynamique pour supporter 100% des nœuds
    const result = await advancedTools.describeNodeType(nodeType, N8N_API_URL, N8N_API_KEY);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async discoverNode(nodeType) {
    // 🚀 NOUVEAU: Force la découverte dynamique depuis l'API n8n
    // Contrairement à describeNodeType qui cherche d'abord localement,
    // cet outil va directement interroger l'API n8n
    const result = await advancedTools.getNodeDefinitionFromN8n(nodeType, N8N_API_URL, N8N_API_KEY);

    if (!result) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Could not discover node '${nodeType}' from n8n API`,
              hint: 'Check that your n8n instance is running and the node type is correct',
              suggestion: 'Use list_node_types to see all available nodes in your n8n instance'
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async configureNodeParameters(args) {
    const result = await advancedTools.configureNodeParameters(
      args.workflowId,
      args.nodeId,
      args.parameterPath,
      args.value,
      N8N_API_URL,
      N8N_API_KEY
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async addNodeExpression(args) {
    const result = await advancedTools.addNodeExpression(
      args.workflowId,
      args.nodeId,
      args.parameterPath,
      args.expression,
      args.contextHelp || false,
      N8N_API_URL,
      N8N_API_KEY
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async configureNodeCode(args) {
    const result = await advancedTools.configureNodeCode(
      args.workflowId,
      args.nodeId,
      args.code,
      args.codeType,
      args.mode,
      N8N_API_URL,
      N8N_API_KEY
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async configureNodeCredentials(args) {
    const result = await advancedTools.configureNodeCredentials(
      args.workflowId,
      args.nodeId,
      args.credentialType,
      args.credentialId,
      N8N_API_URL,
      N8N_API_KEY
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  getCodeSnippet(category, snippetName) {
    const result = advancedTools.getCodeSnippet(category, snippetName);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  validateWorkflowNode(nodeDefinition) {
    const result = advancedTools.validateWorkflowNode(nodeDefinition);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async modifySingleNode(args) {
    try {
      // Récupérer le workflow
      const workflow = await this.makeApiRequest(`/api/v1/workflows/${args.workflowId}`);
      
      // Trouver le nœud
      const node = workflow.nodes.find(n => n.id === args.nodeId || n.name === args.nodeId);
      if (!node) {
        throw new Error(`Node '${args.nodeId}' not found`);
      }

      // Appliquer les modifications
      Object.assign(node, args.nodeUpdates);

      // Mettre à jour le workflow
      const result = await this.makeApiRequest(`/api/v1/workflows/${args.workflowId}`, 'PATCH', workflow);
      
      return {
        content: [
          {
            type: 'text',
            text: `Node updated successfully!\nNode: ${node.name}\nUpdates applied: ${Object.keys(args.nodeUpdates).join(', ')}`,
          },
        ],
      };
    } catch (error) {
      throw error;
    }
  }

  async addNodesToWorkflow(args) {
    try {
      const workflow = await this.makeApiRequest(`/api/v1/workflows/${args.workflowId}`);
      
      // Ajouter les nouveaux nœuds
      workflow.nodes.push(...args.nodes);

      // Auto-connecter si demandé
      if (args.autoConnect && workflow.nodes.length > args.nodes.length) {
        const lastExistingNode = workflow.nodes[workflow.nodes.length - args.nodes.length - 1];
        const firstNewNode = args.nodes[0];
        
        if (!workflow.connections[lastExistingNode.name]) {
          workflow.connections[lastExistingNode.name] = {};
        }
        workflow.connections[lastExistingNode.name].main = [[{
          node: firstNewNode.name,
          type: 'main',
          index: 0
        }]];
      }

      const result = await this.makeApiRequest(`/api/v1/workflows/${args.workflowId}`, 'PATCH', workflow);
      
      return {
        content: [
          {
            type: 'text',
            text: `${args.nodes.length} node(s) added successfully!\nTotal nodes: ${result.nodes.length}`,
          },
        ],
      };
    } catch (error) {
      throw error;
    }
  }

  async removeNodesFromWorkflow(args) {
    try {
      const workflow = await this.makeApiRequest(`/api/v1/workflows/${args.workflowId}`);
      
      // Supprimer les nœuds
      workflow.nodes = workflow.nodes.filter(n => 
        !args.nodeIds.includes(n.id) && !args.nodeIds.includes(n.name)
      );

      // Nettoyer les connexions si demandé
      if (args.cleanupConnections) {
        args.nodeIds.forEach(nodeId => {
          delete workflow.connections[nodeId];
          
          // Supprimer les connexions pointant vers ce nœud
          Object.keys(workflow.connections).forEach(sourceNode => {
            Object.keys(workflow.connections[sourceNode]).forEach(outputType => {
              workflow.connections[sourceNode][outputType] = 
                workflow.connections[sourceNode][outputType].map(connArray =>
                  connArray.filter(conn => 
                    !args.nodeIds.includes(conn.node)
                  )
                );
            });
          });
        });
      }

      const result = await this.makeApiRequest(`/api/v1/workflows/${args.workflowId}`, 'PATCH', workflow);
      
      return {
        content: [
          {
            type: 'text',
            text: `${args.nodeIds.length} node(s) removed successfully!\nRemaining nodes: ${result.nodes.length}`,
          },
        ],
      };
    } catch (error) {
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8n MCP Server (Complete) running on stdio');
  }
}

// Démarrer le serveur
const server = new N8nMcpServer();
server.run().catch(console.error);
