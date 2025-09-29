import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
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
      const workflows = await this.makeApiRequest('/rest/workflows');
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
    const workflow = await this.makeApiRequest(`/rest/workflows/${workflowId}`);
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

    const result = await this.makeApiRequest('/rest/workflows', 'POST', workflowData);
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
    const workflow = await this.makeApiRequest(`/rest/workflows/${workflowId}`);
    
    // Mettre à jour uniquement les champs fournis
    if (name !== undefined) workflow.name = name;
    if (nodes !== undefined) workflow.nodes = nodes;
    if (connections !== undefined) workflow.connections = connections;
    if (active !== undefined) workflow.active = active;

    const result = await this.makeApiRequest(`/rest/workflows/${workflowId}`, 'PATCH', workflow);
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
    await this.makeApiRequest(`/rest/workflows/${workflowId}`, 'DELETE');
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
    const result = await this.makeApiRequest(`/rest/workflows/${workflowId}/execute`, 'POST', { data });
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
      const nodeTypes = await this.makeApiRequest('/rest/node-types');
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
      const workflow = await this.makeApiRequest(`/rest/workflows/${args.workflowId}`);
      
      // Trouver le nœud
      const node = workflow.nodes.find(n => n.id === args.nodeId || n.name === args.nodeId);
      if (!node) {
        throw new Error(`Node '${args.nodeId}' not found`);
      }

      // Appliquer les modifications
      Object.assign(node, args.nodeUpdates);

      // Mettre à jour le workflow
      const result = await this.makeApiRequest(`/rest/workflows/${args.workflowId}`, 'PATCH', workflow);
      
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
      const workflow = await this.makeApiRequest(`/rest/workflows/${args.workflowId}`);
      
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

      const result = await this.makeApiRequest(`/rest/workflows/${args.workflowId}`, 'PATCH', workflow);
      
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
      const workflow = await this.makeApiRequest(`/rest/workflows/${args.workflowId}`);
      
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

      const result = await this.makeApiRequest(`/rest/workflows/${args.workflowId}`, 'PATCH', workflow);
      
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
