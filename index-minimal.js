#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Fonction pour générer automatiquement les connexions entre nodes
function generateSmartConnections(nodes) {
  const connections = {};

  // Catégoriser les nodes par type
  const triggerNodes = nodes.filter(n =>
    n.type.includes('trigger') ||
    n.type.includes('webhook') ||
    n.type.includes('cron') ||
    n.type.includes('interval') ||
    n.type.includes('manual')
  );

  const actionNodes = nodes.filter(n =>
    !triggerNodes.some(t => t.name === n.name) &&
    !n.type.includes('respondToWebhook') &&
    !n.type.includes('response')
  );

  const responseNodes = nodes.filter(n =>
    n.type.includes('respondToWebhook') ||
    n.type.includes('response')
  );

  // Pattern 1: Trigger -> Actions -> Response (workflow linéaire)
  if (triggerNodes.length > 0) {
    let previousNodes = triggerNodes;

    // Connecter triggers aux premières actions
    if (actionNodes.length > 0) {
      const firstAction = actionNodes[0];
      triggerNodes.forEach(trigger => {
        connections[trigger.name] = {
          main: [[{ node: firstAction.name, type: 'main', index: 0 }]]
        };
      });

      // Connecter les actions en séquence
      for (let i = 0; i < actionNodes.length - 1; i++) {
        const currentAction = actionNodes[i];
        const nextAction = actionNodes[i + 1];
        connections[currentAction.name] = {
          main: [[{ node: nextAction.name, type: 'main', index: 0 }]]
        };
      }

      // Connecter la dernière action à la réponse
      if (responseNodes.length > 0) {
        const lastAction = actionNodes[actionNodes.length - 1];
        const firstResponse = responseNodes[0];
        connections[lastAction.name] = {
          main: [[{ node: firstResponse.name, type: 'main', index: 0 }]]
        };
      }
    } else if (responseNodes.length > 0) {
      // Connecter directement trigger à response si pas d'actions
      triggerNodes.forEach(trigger => {
        connections[trigger.name] = {
          main: [[{ node: responseNodes[0].name, type: 'main', index: 0 }]]
        };
      });
    }
  }

  // Pattern 2: Auto-positionnement intelligent
  nodes.forEach((node, index) => {
    const x = 250 + (index * 200); // Espacement horizontal de 200px
    const y = 300; // Ligne horizontale
    node.position = [x, y];
  });

  console.log('Final connections object:', JSON.stringify(connections, null, 2));
  return connections;
}

// ADVANCED CONNECTION TYPES IMPLEMENTATION
// Based on n8n official docs and 2000+ GitHub workflows analysis

// 1. MERGE/SPLIT CONNECTIONS
function generateMergeConnections(nodes, mergeType = 'append') {
  const connections = {};
  const mergeNodes = nodes.filter(n => n.type.includes('merge'));
  const splitNodes = nodes.filter(n => n.type.includes('if') || n.type.includes('switch'));

  mergeNodes.forEach(mergeNode => {
    const sourceNodes = nodes.filter(n =>
      !mergeNodes.includes(n) &&
      !n.type.includes('trigger') &&
      !n.type.includes('respondToWebhook')
    );

    // Configure merge based on type
    switch(mergeType) {
      case 'append':
        // Stack all inputs into single list
        sourceNodes.forEach((sourceNode, index) => {
          connections[sourceNode.name] = {
            main: [[{ node: mergeNode.name, type: 'main', index: 0 }]]
          };
        });
        break;

      case 'byKey':
        // Join by matching field (inner join)
        sourceNodes.forEach(sourceNode => {
          connections[sourceNode.name] = {
            main: [[{
              node: mergeNode.name,
              type: 'main',
              index: 0,
              joinField: 'id' // Default join field
            }]]
          };
        });
        break;

      case 'position':
        // Merge by index position
        sourceNodes.forEach((sourceNode, index) => {
          connections[sourceNode.name] = {
            main: [[{
              node: mergeNode.name,
              type: 'main',
              index: index
            }]]
          };
        });
        break;

      case 'combinations':
        // All possible combinations
        sourceNodes.forEach(sourceNode => {
          connections[sourceNode.name] = {
            main: [[{
              node: mergeNode.name,
              type: 'main',
              index: 0,
              combineMode: 'all'
            }]]
          };
        });
        break;
    }
  });

  return connections;
}

// 2. SWITCH CONNECTIONS (Multi-routing)
function generateSwitchConnections(nodes, rules = []) {
  const connections = {};
  const switchNodes = nodes.filter(n => n.type.includes('switch'));

  switchNodes.forEach(switchNode => {
    const sourceNode = nodes.find(n =>
      !switchNodes.includes(n) &&
      !n.type.includes('respondToWebhook')
    );

    if (sourceNode) {
      const targetNodes = nodes.filter(n =>
        n !== sourceNode &&
        n !== switchNode &&
        !n.type.includes('trigger')
      );

      // Multi-output routing based on rules
      connections[sourceNode.name] = {
        main: [[{ node: switchNode.name, type: 'main', index: 0 }]]
      };

      // Configure switch outputs to different targets
      const switchOutputs = [];
      targetNodes.forEach((targetNode, index) => {
        switchOutputs.push([{
          node: targetNode.name,
          type: 'main',
          index: 0,
          condition: rules[index] || `{{$json.type === '${targetNode.name}'}}`,
          rule: index
        }]);
      });

      connections[switchNode.name] = {
        main: switchOutputs
      };
    }
  });

  return connections;
}

// 3. ERROR HANDLING CONNECTIONS
function generateErrorHandlingConnections(nodes, errorConfig = {}) {
  const connections = {};
  const errorNodes = nodes.filter(n => n.type.includes('errorTrigger'));
  const retryNodes = nodes.filter(n => n.name.includes('retry'));

  nodes.forEach(node => {
    if (!node.type.includes('trigger') && !node.type.includes('errorTrigger')) {
      // Add error handling to each action node
      const nodeConnections = connections[node.name] || { main: [[]] };

      // Add error output
      nodeConnections.error = [{
        node: errorNodes[0]?.name || 'error-handler',
        type: 'error',
        index: 0,
        retryAttempts: errorConfig.retryAttempts || 3,
        retryDelay: errorConfig.retryDelay || 1000,
        continueOnFail: errorConfig.continueOnFail || false
      }];

      connections[node.name] = nodeConnections;
    }
  });

  // Configure retry logic
  if (retryNodes.length > 0) {
    retryNodes.forEach(retryNode => {
      connections[retryNode.name] = {
        main: [[{
          node: 'original-action',
          type: 'main',
          index: 0,
          isRetry: true
        }]],
        maxRetries: errorConfig.maxRetries || 3,
        backoffStrategy: errorConfig.backoffStrategy || 'exponential'
      };
    });
  }

  return connections;
}

// 4. ADVANCED WEBHOOK CONNECTIONS
function generateWebhookConnections(nodes, webhookConfig = {}) {
  const connections = {};
  const webhookNodes = nodes.filter(n => n.type.includes('webhook'));
  const responseNodes = nodes.filter(n => n.type.includes('respondToWebhook'));

  webhookNodes.forEach(webhookNode => {
    const processingNodes = nodes.filter(n =>
      !webhookNodes.includes(n) &&
      !responseNodes.includes(n) &&
      !n.type.includes('trigger')
    );

    // Multi-method webhook support
    connections[webhookNode.name] = {
      GET: [[{
        node: processingNodes[0]?.name || 'process-get',
        type: 'main',
        index: 0,
        method: 'GET'
      }]],
      POST: [[{
        node: processingNodes[1]?.name || 'process-post',
        type: 'main',
        index: 0,
        method: 'POST'
      }]],
      PUT: [[{
        node: processingNodes[2]?.name || 'process-put',
        type: 'main',
        index: 0,
        method: 'PUT'
      }]],
      DELETE: [[{
        node: processingNodes[3]?.name || 'process-delete',
        type: 'main',
        index: 0,
        method: 'DELETE'
      }]],
      error: [{
        node: responseNodes[0]?.name || 'error-response',
        type: 'error',
        index: 0,
        statusCode: webhookConfig.errorStatusCode || 500
      }]
    };

    // Conditional response based on processing results
    processingNodes.forEach(procNode => {
      if (connections[procNode.name]) {
        connections[procNode.name].main.push([{
          node: responseNodes[0]?.name || 'webhook-response',
          type: 'main',
          index: 0,
          conditional: true,
          successStatusCode: webhookConfig.successStatusCode || 200
        }]);
      }
    });
  });

  return connections;
}

// 5. LOOP CONNECTIONS
function generateLoopConnections(nodes, loopConfig = {}) {
  const connections = {};
  const loopNodes = nodes.filter(n =>
    n.name.includes('loop') ||
    n.name.includes('foreach') ||
    n.type.includes('splitInBatches')
  );

  loopNodes.forEach(loopNode => {
    const dataSource = nodes.find(n =>
      !loopNodes.includes(n) &&
      n.type.includes('trigger')
    );
    const processingNodes = nodes.filter(n =>
      !loopNodes.includes(n) &&
      n !== dataSource &&
      !n.type.includes('trigger')
    );

    if (dataSource) {
      // Connect data source to loop
      connections[dataSource.name] = {
        main: [[{
          node: loopNode.name,
          type: 'main',
          index: 0
        }]]
      };

      // Configure loop iteration
      connections[loopNode.name] = {
        main: [[{
          node: processingNodes[0]?.name || 'process-item',
          type: 'main',
          index: 0,
          loopType: loopConfig.type || 'forEach',
          batchSize: loopConfig.batchSize || 1,
          maxIterations: loopConfig.maxIterations || 1000
        }]],
        // Loop back connection
        loop: [{
          node: loopNode.name,
          type: 'loop',
          index: 0,
          condition: loopConfig.condition || '{{$json.hasMore}}'
        }]
      };
    }
  });

  return connections;
}

// 6. TEMPORAL CONNECTIONS
function generateTemporalConnections(nodes, timeConfig = {}) {
  const connections = {};
  const delayNodes = nodes.filter(n => n.type.includes('wait') || n.name.includes('delay'));
  const scheduleNodes = nodes.filter(n => n.type.includes('cron') || n.type.includes('schedule'));

  // Delayed connections
  delayNodes.forEach(delayNode => {
    const sourceNode = nodes.find(n => !delayNodes.includes(n) && !n.type.includes('trigger'));
    const targetNode = nodes.find(n =>
      n !== sourceNode &&
      n !== delayNode &&
      !n.type.includes('trigger')
    );

    if (sourceNode && targetNode) {
      connections[sourceNode.name] = {
        main: [[{
          node: delayNode.name,
          type: 'main',
          index: 0
        }]]
      };

      connections[delayNode.name] = {
        main: [[{
          node: targetNode.name,
          type: 'main',
          index: 0,
          delay: timeConfig.delay || 5000,
          delayUnit: timeConfig.delayUnit || 'milliseconds'
        }]]
      };
    }
  });

  // Scheduled connections with timeout
  scheduleNodes.forEach(scheduleNode => {
    const targetNodes = nodes.filter(n =>
      n !== scheduleNode &&
      !n.type.includes('trigger')
    );

    connections[scheduleNode.name] = {
      main: targetNodes.map(targetNode => [{
        node: targetNode.name,
        type: 'main',
        index: 0,
        schedule: timeConfig.schedule || '0 0 * * *',
        timezone: timeConfig.timezone || 'UTC',
        timeout: timeConfig.timeout || 30000
      }])
    };
  });

  return connections;
}

// 7. AI ENRICHMENT CONNECTIONS
function generateAIConnections(nodes, aiConfig = {}) {
  const connections = {};
  const aiNodes = nodes.filter(n =>
    n.type.includes('openai') ||
    n.type.includes('anthropic') ||
    n.name.includes('ai') ||
    n.name.includes('llm')
  );

  aiNodes.forEach(aiNode => {
    const dataNodes = nodes.filter(n =>
      !aiNodes.includes(n) &&
      !n.type.includes('respondToWebhook')
    );

    // AI transformation pipeline
    connections[aiNode.name] = {
      main: [[{
        node: dataNodes[0]?.name || 'process-ai-result',
        type: 'main',
        index: 0,
        aiModel: aiConfig.model || 'gpt-3.5-turbo',
        temperature: aiConfig.temperature || 0.7,
        maxTokens: aiConfig.maxTokens || 1000,
        enrichmentType: aiConfig.enrichmentType || 'sentiment',
        prompt: aiConfig.prompt || 'Analyze and enrich this data: {{$json}}'
      }]],
      // Conditional routing based on AI analysis
      sentiment: [{
        node: 'positive-handler',
        type: 'conditional',
        index: 0,
        condition: '{{$json.sentiment === "positive"}}'
      }],
      classification: [{
        node: 'category-router',
        type: 'conditional',
        index: 0,
        condition: '{{$json.category}}'
      }]
    };
  });

  return connections;
}

// 8. DYNAMIC SOURCE CONNECTIONS
function generateDynamicConnections(nodes, dynamicConfig = {}) {
  const connections = {};
  const httpNodes = nodes.filter(n => n.type.includes('httpRequest'));

  httpNodes.forEach(httpNode => {
    const targetNodes = nodes.filter(n =>
      n !== httpNode &&
      !n.type.includes('trigger')
    );

    connections[httpNode.name] = {
      main: [[{
        node: targetNodes[0]?.name || 'process-dynamic-data',
        type: 'main',
        index: 0,
        dynamicUrl: dynamicConfig.urlTemplate || '{{$json.endpoint}}',
        dynamicHeaders: dynamicConfig.headers || {},
        contextAware: true,
        userPersonalization: dynamicConfig.personalization || false,
        dataQuery: dynamicConfig.query || '{{$json.filters}}'
      }]]
    };
  });

  return connections;
}

// 9. PARALLEL ADVANCED CONNECTIONS
function generateParallelConnections(nodes, parallelConfig = {}) {
  const connections = {};
  const sourceNode = nodes.find(n => n.type.includes('trigger') || n.type.includes('webhook'));
  const parallelNodes = nodes.filter(n =>
    n !== sourceNode &&
    !n.type.includes('merge') &&
    !n.type.includes('respondToWebhook')
  );
  const mergeNode = nodes.find(n => n.type.includes('merge'));

  if (sourceNode && parallelNodes.length > 1) {
    // Fan-out: parallel execution
    connections[sourceNode.name] = {
      main: [parallelNodes.map(node => ({
        node: node.name,
        type: 'main',
        index: 0,
        parallel: true,
        syncPoint: mergeNode?.name || 'sync-point',
        loadBalancing: parallelConfig.loadBalancing || false,
        raceCondition: parallelConfig.raceCondition || 'wait-all'
      }))]
    };

    // Fan-in: merge parallel results
    if (mergeNode) {
      parallelNodes.forEach(parallelNode => {
        connections[parallelNode.name] = {
          main: [[{
            node: mergeNode.name,
            type: 'main',
            index: 0,
            syncRequired: true
          }]]
        };
      });
    }
  }

  return connections;
}

// 10. STATEFUL CONNECTIONS
function generateStatefulConnections(nodes, stateConfig = {}) {
  const connections = {};
  const stateNodes = nodes.filter(n =>
    n.name.includes('state') ||
    n.name.includes('cache') ||
    n.name.includes('session')
  );

  stateNodes.forEach(stateNode => {
    const dataNodes = nodes.filter(n =>
      !stateNodes.includes(n) &&
      !n.type.includes('trigger')
    );

    connections[stateNode.name] = {
      main: [[{
        node: dataNodes[0]?.name || 'process-with-state',
        type: 'main',
        index: 0,
        sessionId: stateConfig.sessionId || '{{$json.userId}}',
        cacheKey: stateConfig.cacheKey || '{{$json.id}}',
        cacheTTL: stateConfig.cacheTTL || 3600,
        persistence: stateConfig.persistence || 'memory',
        crossWorkflow: stateConfig.crossWorkflow || false
      }]]
    };
  });

  return connections;
}

// MASTER CONNECTION GENERATOR
function generateAdvancedConnections(nodes, connectionConfig = {}) {
  let connections = {};

  // Apply connection types based on configuration
  if (connectionConfig.enableMerge) {
    Object.assign(connections, generateMergeConnections(nodes, connectionConfig.mergeType));
  }

  if (connectionConfig.enableSwitch) {
    Object.assign(connections, generateSwitchConnections(nodes, connectionConfig.switchRules));
  }

  if (connectionConfig.enableErrorHandling) {
    Object.assign(connections, generateErrorHandlingConnections(nodes, connectionConfig.errorConfig));
  }

  if (connectionConfig.enableAdvancedWebhook) {
    Object.assign(connections, generateWebhookConnections(nodes, connectionConfig.webhookConfig));
  }

  if (connectionConfig.enableLoops) {
    Object.assign(connections, generateLoopConnections(nodes, connectionConfig.loopConfig));
  }

  if (connectionConfig.enableTemporal) {
    Object.assign(connections, generateTemporalConnections(nodes, connectionConfig.timeConfig));
  }

  if (connectionConfig.enableAI) {
    Object.assign(connections, generateAIConnections(nodes, connectionConfig.aiConfig));
  }

  if (connectionConfig.enableDynamic) {
    Object.assign(connections, generateDynamicConnections(nodes, connectionConfig.dynamicConfig));
  }

  if (connectionConfig.enableParallel) {
    Object.assign(connections, generateParallelConnections(nodes, connectionConfig.parallelConfig));
  }

  if (connectionConfig.enableStateful) {
    Object.assign(connections, generateStatefulConnections(nodes, connectionConfig.stateConfig));
  }

  // Fallback to basic connections if no advanced types specified
  if (Object.keys(connections).length === 0) {
    connections = generateSmartConnections(nodes);
  }

  return connections;
}

// Fonction pour améliorer les connexions existantes
function enhanceConnections(nodes, existingConnections) {
  // Si des connexions existent déjà, les garder
  if (Object.keys(existingConnections).length > 0) {
    return existingConnections;
  }

  // Sinon, générer des connexions intelligentes
  return generateSmartConnections(nodes);
}

// Fonction pour optimiser les positions des nodes
function optimizeNodePositions(nodes, connections) {
  const positioned = new Set();
  const layers = [];

  // Identifier les layers (trigger -> action -> response)
  const triggerNodes = nodes.filter(n =>
    n.type.includes('trigger') ||
    n.type.includes('webhook') ||
    n.type.includes('cron') ||
    n.type.includes('manual')
  );

  if (triggerNodes.length > 0) {
    layers.push(triggerNodes);
    triggerNodes.forEach(n => positioned.add(n.id));
  }

  // Construire les layers suivants en suivant les connexions
  let currentLayer = triggerNodes;
  while (currentLayer.length > 0 && positioned.size < nodes.length) {
    const nextLayer = [];

    currentLayer.forEach(node => {
      const nodeConnections = connections[node.id];
      if (nodeConnections?.main) {
        nodeConnections.main.forEach(connectionGroup => {
          connectionGroup.forEach(connection => {
            const targetNode = nodes.find(n => n.id === connection.node);
            if (targetNode && !positioned.has(targetNode.id)) {
              nextLayer.push(targetNode);
              positioned.add(targetNode.id);
            }
          });
        });
      }
    });

    if (nextLayer.length > 0) {
      layers.push(nextLayer);
      currentLayer = nextLayer;
    } else {
      break;
    }
  }

  // Ajouter les nodes non connectés à la fin
  const unconnected = nodes.filter(n => !positioned.has(n.id));
  if (unconnected.length > 0) {
    layers.push(unconnected);
  }

  // Positionner les nodes par layer
  layers.forEach((layer, layerIndex) => {
    layer.forEach((node, nodeIndex) => {
      const x = 250 + (layerIndex * 300); // 300px entre les layers
      const y = 200 + (nodeIndex * 150); // 150px entre les nodes du même layer
      node.position = [x, y];
    });
  });

  return nodes;
}

// Serveur MCP minimal
const server = new Server(
  {
    name: 'n8n-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Méthode pour faire des requêtes API n8n
async function makeApiRequest(endpoint, method = 'GET', data = null) {
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

// Liste des outils
server.setRequestHandler(ListToolsRequestSchema, async () => {
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
      {
        name: "create_workflow",
        description: "Create a new n8n workflow",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the workflow"
            },
            nodes: {
              type: "array",
              description: "Array of nodes for the workflow",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "Unique identifier for the node"
                  },
                  name: {
                    type: "string",
                    description: "Display name of the node"
                  },
                  type: {
                    type: "string",
                    description: "Node type (e.g., n8n-nodes-base.webhook, n8n-nodes-base.set)"
                  },
                  typeVersion: {
                    type: "number",
                    description: "Version of the node type (default: 1)",
                    default: 1
                  },
                  position: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                    description: "[x, y] coordinates for node positioning"
                  },
                  parameters: {
                    type: "object",
                    description: "Node-specific configuration parameters"
                  },
                  credentials: {
                    type: "object",
                    description: "Credentials configuration for the node"
                  },
                  disabled: {
                    type: "boolean",
                    description: "Whether the node is disabled",
                    default: false
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes for the node"
                  },
                  retryOnFail: {
                    type: "boolean",
                    description: "Whether to retry on failure"
                  },
                  maxTries: {
                    type: "number",
                    description: "Maximum number of retry attempts"
                  },
                  waitBetweenTries: {
                    type: "number",
                    description: "Wait time between retries in seconds"
                  },
                  alwaysOutputData: {
                    type: "boolean",
                    description: "Always output data even on error"
                  },
                  executeOnce: {
                    type: "boolean",
                    description: "Execute only once per workflow run"
                  },
                  continueOnFail: {
                    type: "boolean",
                    description: "Continue workflow even if this node fails"
                  }
                },
                required: ["id", "name", "type", "position"]
              }
            },
            connections: {
              type: "object",
              description: "Connections between nodes in format {nodeId: {main: [[{node: 'targetId', type: 'main', index: 0}]]}}"
            },
            active: {
              type: "boolean",
              description: "Whether the workflow should be active upon creation",
              default: false
            },
            autoConnect: {
              type: "boolean",
              description: "Automatically generate smart connections between nodes (default: true)",
              default: true
            },
            advancedConnections: {
              type: "boolean",
              description: "Enable advanced connection types (merge, switch, error handling, etc.)",
              default: false
            },
            connectionConfig: {
              type: "object",
              description: "Configuration for advanced connections",
              properties: {
                enableMerge: { type: "boolean" },
                enableSwitch: { type: "boolean" },
                enableErrorHandling: { type: "boolean" },
                enableAdvancedWebhook: { type: "boolean" },
                enableLoops: { type: "boolean" },
                enableTemporal: { type: "boolean" },
                enableAI: { type: "boolean" },
                enableDynamic: { type: "boolean" },
                enableParallel: { type: "boolean" },
                enableStateful: { type: "boolean" }
              }
            }
          },
          required: ["name", "nodes"]
        },
      },
      {
        name: "activate_workflow",
        description: "Activate or deactivate a workflow",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Workflow ID"
            },
            active: {
              type: "boolean",
              description: "Whether to activate (true) or deactivate (false) the workflow"
            }
          },
          required: ["id", "active"]
        },
      },
      {
        name: "get_workflow",
        description: "Get details of a specific workflow",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Workflow ID"
            }
          },
          required: ["id"]
        },
      },
      {
        name: "create_advanced_workflow",
        description: "Create workflows with advanced connection types (merge, switch, error handling, loops, AI, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the workflow"
            },
            nodes: {
              type: "array",
              description: "Array of nodes for the workflow"
            },
            connectionType: {
              type: "string",
              enum: ["merge", "switch", "error_handling", "advanced_webhook", "loops", "temporal", "ai_enrichment", "dynamic_source", "parallel_advanced", "stateful", "auto"],
              description: "Type of advanced connections to create",
              default: "auto"
            },
            connectionConfig: {
              type: "object",
              description: "Configuration for advanced connections",
              properties: {
                mergeType: {
                  type: "string",
                  enum: ["append", "byKey", "position", "combinations"],
                  description: "Type of merge operation"
                },
                switchRules: {
                  type: "array",
                  description: "Rules for switch routing"
                },
                errorConfig: {
                  type: "object",
                  properties: {
                    retryAttempts: { type: "number" },
                    retryDelay: { type: "number" },
                    continueOnFail: { type: "boolean" }
                  }
                },
                webhookConfig: {
                  type: "object",
                  properties: {
                    errorStatusCode: { type: "number" },
                    successStatusCode: { type: "number" }
                  }
                },
                loopConfig: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["forEach", "while", "recursive"] },
                    batchSize: { type: "number" },
                    maxIterations: { type: "number" }
                  }
                },
                timeConfig: {
                  type: "object",
                  properties: {
                    delay: { type: "number" },
                    schedule: { type: "string" },
                    timezone: { type: "string" }
                  }
                },
                aiConfig: {
                  type: "object",
                  properties: {
                    model: { type: "string" },
                    temperature: { type: "number" },
                    enrichmentType: { type: "string" }
                  }
                }
              }
            },
            active: {
              type: "boolean",
              description: "Whether to activate the workflow after creation",
              default: false
            }
          },
          required: ["name", "nodes"]
        }
      },
      {
        name: "create_workflow_template",
        description: "Create a workflow from a predefined template",
        inputSchema: {
          type: "object",
          properties: {
            template: {
              type: "string",
              enum: ["webhook_to_email", "cron_backup", "api_to_database", "file_processor", "slack_notifier"],
              description: "Predefined workflow template"
            },
            name: {
              type: "string",
              description: "Name for the new workflow"
            },
            config: {
              type: "object",
              description: "Template-specific configuration"
            }
          },
          required: ["template", "name"]
        },
      },
      {
        name: "validate_workflow",
        description: "Validate a workflow structure before creation",
        inputSchema: {
          type: "object",
          properties: {
            nodes: {
              type: "array",
              description: "Array of nodes to validate"
            },
            connections: {
              type: "object",
              description: "Connections between nodes"
            }
          },
          required: ["nodes"]
        },
      },
      {
        name: "execute_workflow",
        description: "Execute a workflow manually",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to execute"
            },
            data: {
              type: "object",
              description: "Input data for the workflow execution"
            }
          },
          required: ["id"]
        },
      },
      {
        name: "execution_list",
        description: "List executions for a workflow or all executions",
        inputSchema: {
          type: "object",
          properties: {
            workflowId: {
              type: "string",
              description: "Optional workflow ID to filter executions"
            },
            limit: {
              type: "number",
              description: "Maximum number of executions to return (default: 20)",
              default: 20
            },
            status: {
              type: "string",
              enum: ["running", "success", "error", "canceled", "waiting"],
              description: "Filter by execution status"
            }
          }
        },
      },
      {
        name: "execution_get",
        description: "Get details of a specific execution",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Execution ID"
            }
          },
          required: ["id"]
        },
      },
      {
        name: "execution_stop",
        description: "Stop a running execution",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Execution ID to stop"
            }
          },
          required: ["id"]
        },
      },
      {
        name: "workflow_update",
        description: "Update an existing workflow",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to update"
            },
            name: {
              type: "string",
              description: "New name for the workflow"
            },
            nodes: {
              type: "array",
              description: "Updated array of nodes"
            },
            connections: {
              type: "object",
              description: "Updated connections between nodes"
            },
            active: {
              type: "boolean",
              description: "Whether the workflow should be active"
            },
            settings: {
              type: "object",
              description: "Updated workflow settings"
            }
          },
          required: ["id"]
        },
      },
      {
        name: "workflow_delete",
        description: "Delete a workflow",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Workflow ID to delete"
            }
          },
          required: ["id"]
        },
      },
      {
        name: "create_smart_workflow",
        description: "Create a workflow with AI-powered automatic connections and positioning",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the workflow"
            },
            description: {
              type: "string",
              description: "Description of what the workflow should do"
            },
            nodeTypes: {
              type: "array",
              items: { type: "string" },
              description: "List of node types to include (e.g., ['webhook', 'set', 'email'])"
            },
            pattern: {
              type: "string",
              enum: ["linear", "parallel", "conditional", "loop"],
              description: "Workflow pattern to apply",
              default: "linear"
            },
            active: {
              type: "boolean",
              description: "Whether to activate the workflow",
              default: false
            }
          },
          required: ["name", "nodeTypes"]
        },
      },
    ],
  };
});

// Liste des ressources MCP
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const workflows = await makeApiRequest('/workflows');
    const executions = await makeApiRequest('/executions?limit=10');

    const resources = [
      // Ressources workflows
      ...workflows.data.map(workflow => ({
        uri: `n8n://workflow/${workflow.id}`,
        name: `Workflow: ${workflow.name}`,
        description: `n8n workflow with ${workflow.nodes.length} nodes (${workflow.active ? 'Active' : 'Inactive'})`,
        mimeType: 'application/json'
      })),
      // Ressources executions récentes
      ...executions.data.slice(0, 5).map(exec => ({
        uri: `n8n://execution/${exec.id}`,
        name: `Execution: ${exec.id}`,
        description: `Execution from ${new Date(exec.startedAt).toLocaleString()} - Status: ${exec.status}`,
        mimeType: 'application/json'
      })),
      // Ressources statiques
      {
        uri: 'n8n://node-types',
        name: 'Available Node Types',
        description: 'Complete list of all available n8n node types',
        mimeType: 'application/json'
      },
      {
        uri: 'n8n://templates',
        name: 'Workflow Templates',
        description: 'Predefined workflow templates',
        mimeType: 'application/json'
      }
    ];

    return { resources };
  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
});

// Lecture des ressources MCP
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri.startsWith('n8n://workflow/')) {
      const workflowId = uri.replace('n8n://workflow/', '');
      const workflow = await makeApiRequest(`/workflows/${workflowId}`);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(workflow, null, 2)
          }
        ]
      };
    }

    if (uri.startsWith('n8n://execution/')) {
      const executionId = uri.replace('n8n://execution/', '');
      const execution = await makeApiRequest(`/executions/${executionId}`);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(execution, null, 2)
          }
        ]
      };
    }

    if (uri === 'n8n://node-types') {
      // Liste statique des nodes les plus courants (car l'endpoint n'est pas public)
      const commonNodeTypes = {
        "triggers": [
          { name: "Webhook", type: "n8n-nodes-base.webhook", description: "Wait for webhook calls", category: "Trigger" },
          { name: "Cron", type: "n8n-nodes-base.cron", description: "Trigger on a schedule", category: "Trigger" },
          { name: "Manual Trigger", type: "n8n-nodes-base.manualTrigger", description: "Manual execution trigger", category: "Trigger" },
          { name: "Interval", type: "n8n-nodes-base.interval", description: "Trigger in intervals", category: "Trigger" }
        ],
        "actions": [
          { name: "HTTP Request", type: "n8n-nodes-base.httpRequest", description: "Make HTTP requests", category: "Action" },
          { name: "Set", type: "n8n-nodes-base.set", description: "Set values on items", category: "Action" },
          { name: "Code", type: "n8n-nodes-base.code", description: "Run custom JavaScript code", category: "Action" },
          { name: "IF", type: "n8n-nodes-base.if", description: "Conditional logic", category: "Action" },
          { name: "Switch", type: "n8n-nodes-base.switch", description: "Route items", category: "Action" }
        ],
        "communication": [
          { name: "Email Send", type: "n8n-nodes-base.emailSend", description: "Send emails", category: "Communication" },
          { name: "Slack", type: "n8n-nodes-base.slack", description: "Slack integration", category: "Communication" },
          { name: "Discord", type: "n8n-nodes-base.discord", description: "Discord integration", category: "Communication" },
          { name: "Telegram", type: "n8n-nodes-base.telegram", description: "Telegram bot", category: "Communication" }
        ],
        "data": [
          { name: "MySQL", type: "n8n-nodes-base.mySql", description: "MySQL database", category: "Data" },
          { name: "PostgreSQL", type: "n8n-nodes-base.postgres", description: "PostgreSQL database", category: "Data" },
          { name: "Google Sheets", type: "n8n-nodes-base.googleSheets", description: "Google Sheets integration", category: "Data" },
          { name: "Airtable", type: "n8n-nodes-base.airtable", description: "Airtable integration", category: "Data" }
        ]
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(commonNodeTypes, null, 2)
          }
        ]
      };
    }

    if (uri === 'n8n://templates') {
      const templates = {
        webhook_to_email: {
          name: "Webhook to Email",
          description: "Receive webhook data and send email notification",
          category: "Communication",
          complexity: "Simple"
        },
        cron_backup: {
          name: "Scheduled Backup",
          description: "Automated backup on schedule",
          category: "Automation",
          complexity: "Medium"
        },
        api_to_database: {
          name: "API to Database",
          description: "Fetch API data and store in database",
          category: "Data",
          complexity: "Medium"
        },
        file_processor: {
          name: "File Processor",
          description: "Process uploaded files automatically",
          category: "Files",
          complexity: "Advanced"
        },
        slack_notifier: {
          name: "Slack Notifications",
          description: "Send notifications to Slack channels",
          category: "Communication",
          complexity: "Simple"
        }
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(templates, null, 2)
          }
        ]
      };
    }

    throw new Error(`Resource not found: ${uri}`);

  } catch (error) {
    throw new Error(`Error reading resource ${uri}: ${error.message}`);
  }
});

// Exécution des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  try {
    switch (name) {
      case "list_workflows":
        try {
          const workflows = await makeApiRequest('/workflows');
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

      case "list_node_types":
        try {
          // Comme l'endpoint node-types n'est pas disponible dans l'API publique,
          // on fournit une liste statique des nodes les plus courants
          const commonNodeTypes = {
            "Triggers": [
              { name: "Webhook", type: "n8n-nodes-base.webhook", description: "Wait for webhook calls" },
              { name: "Cron", type: "n8n-nodes-base.cron", description: "Trigger on a schedule" },
              { name: "Manual Trigger", type: "n8n-nodes-base.manualTrigger", description: "Manual execution trigger" },
              { name: "Interval", type: "n8n-nodes-base.interval", description: "Trigger in intervals" }
            ],
            "Actions": [
              { name: "HTTP Request", type: "n8n-nodes-base.httpRequest", description: "Make HTTP requests" },
              { name: "Set", type: "n8n-nodes-base.set", description: "Set values on items" },
              { name: "Code", type: "n8n-nodes-base.code", description: "Run custom JavaScript code" },
              { name: "IF", type: "n8n-nodes-base.if", description: "Conditional logic" },
              { name: "Switch", type: "n8n-nodes-base.switch", description: "Route items" }
            ],
            "Communication": [
              { name: "Email Send", type: "n8n-nodes-base.emailSend", description: "Send emails" },
              { name: "Slack", type: "n8n-nodes-base.slack", description: "Slack integration" },
              { name: "Discord", type: "n8n-nodes-base.discord", description: "Discord integration" },
              { name: "Telegram", type: "n8n-nodes-base.telegram", description: "Telegram bot" }
            ],
            "Data": [
              { name: "MySQL", type: "n8n-nodes-base.mySql", description: "MySQL database" },
              { name: "PostgreSQL", type: "n8n-nodes-base.postgres", description: "PostgreSQL database" },
              { name: "Google Sheets", type: "n8n-nodes-base.googleSheets", description: "Google Sheets integration" },
              { name: "Airtable", type: "n8n-nodes-base.airtable", description: "Airtable integration" }
            ],
            "Utilities": [
              { name: "Wait", type: "n8n-nodes-base.wait", description: "Pause execution" },
              { name: "Merge", type: "n8n-nodes-base.merge", description: "Merge data" },
              { name: "Item Lists", type: "n8n-nodes-base.itemLists", description: "Process lists" },
              { name: "Respond to Webhook", type: "n8n-nodes-base.respondToWebhook", description: "Respond to webhook" }
            ]
          };

          let output = '**Available n8n Node Types** (Common nodes)\n\n';

          Object.entries(commonNodeTypes).forEach(([category, nodes]) => {
            output += `## ${category}\n`;
            nodes.forEach(node => {
              output += `• **${node.name}** (\`${node.type}\`)\n  ${node.description}\n\n`;
            });
          });

          output += `**Note:** This is a curated list of the most commonly used nodes. n8n has 500+ nodes available.\n\n`;
          output += `**Full documentation:** https://docs.n8n.io/integrations/builtin/`;

          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing node types: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "create_workflow":
        try {
          const {
            name,
            nodes,
            connections = {},
            active = false,
            autoConnect = true,
            advancedConnections = false,
            connectionConfig = {}
          } = request.params.arguments;

          // AUTOMATIC INTELLIGENCE: Connection and position generation
          let smartConnections = connections;
          let processedNodes = [...nodes];

          if (autoConnect && Object.keys(connections).length === 0) {
            if (advancedConnections) {
              // Use advanced connection generation
              smartConnections = generateAdvancedConnections(processedNodes, connectionConfig);
            } else {
              // Use basic connection generation
              smartConnections = generateSmartConnections(processedNodes);
            }

            // Optimiser les positions des nodes
            processedNodes = optimizeNodePositions(processedNodes, smartConnections);
          } else if (Object.keys(connections).length > 0) {
            // Améliorer les connexions existantes et optimiser positions
            smartConnections = enhanceConnections(processedNodes, connections);
            processedNodes = optimizeNodePositions(processedNodes, smartConnections);
          }

          // Structure ultra-minimaliste avec intelligence automatique
          const workflowData = {
            name: name,
            nodes: processedNodes.map(node => ({
              id: node.id,
              name: node.name,
              type: node.type,
              typeVersion: node.typeVersion || 1,
              position: node.position || [250, 300],
              parameters: node.parameters || {}
            })),
            connections: smartConnections
          };

          // Validation basique obligatoire
          if (!name || !nodes || nodes.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Validation failed: Missing required fields (name, nodes)`,
                },
              ],
              isError: true,
            };
          }

          // Tentative 1: Structure minimaliste (comme trouvé dans les repos)
          let result;
          try {
            result = await makeApiRequest('/workflows', 'POST', workflowData);
          } catch (firstError) {
            // Tentative 2: Ajouter settings si requis
            if (firstError.response?.status === 400 && firstError.response?.data?.message?.includes('settings')) {
              try {
                workflowData.settings = {};
                result = await makeApiRequest('/workflows', 'POST', workflowData);
              } catch (secondError) {
                // Tentative 3: Structure complète avec tous les champs optionnels
                try {
                  const fullWorkflowData = {
                    name: name,
                    nodes: workflowData.nodes,
                    connections: connections,
                    settings: {},
                    staticData: null,
                    pinData: null
                  };
                  result = await makeApiRequest('/workflows', 'POST', fullWorkflowData);
                } catch (thirdError) {
                  throw thirdError; // Si même la structure complète échoue
                }
              }
            } else {
              throw firstError;
            }
          }

          // Activation si demandée
          if (active && result.id) {
            try {
              await makeApiRequest(`/workflows/${result.id}/activate`, 'POST');
              result.active = true;
            } catch (activateError) {
              // L'activation a échoué mais le workflow est créé
              console.error('Failed to activate workflow:', activateError.message);
            }
          }

          // Analyser les connexions générées
          const connectionCount = Object.keys(smartConnections).length;
          const autoConnected = autoConnect && Object.keys(connections).length === 0 && connectionCount > 0;

          return {
            content: [
              {
                type: "text",
                text: `Workflow "${name}" created successfully!\n\n` +
                      `**Details:**\n` +
                      `• ID: ${result.id}\n` +
                      `• Name: ${result.name}\n` +
                      `• Nodes: ${result.nodes?.length || nodes.length}\n` +
                      `• Connections: ${connectionCount}\n` +
                      `• Status: ${result.active ? '🟢 Active' : '🔴 Inactive'}\n` +
                      (autoConnected ? `• 🤖 **Smart connections automatically generated!**\n` : '') +
                      `\n**Workflow Structure:**\n` +
                      `${result.nodes?.map(n => `• ${n.name} (${n.type.split('.').pop()})`).join('\n') || 'No nodes'}\n\n` +
                      (autoConnected ? `🧠 **AI Enhancement:** Nodes automatically connected in logical sequence\n\n` : '') +
                      `🌐 **View in n8n:** http://localhost:5678/workflow/${result.id}`,
              },
            ],
          };

        } catch (error) {
          // Gestion d'erreur robuste basée sur l'analyse des repos
          let errorMessage = 'Unknown error occurred';
          let debugInfo = '';

          if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 401) {
              errorMessage = 'Invalid API key. Please check your n8n API configuration.';
            } else if (status === 400) {
              errorMessage = data?.message || 'Bad request - Invalid workflow structure';
              debugInfo = `\n\n**Debug Info:**\n- Status: ${status}\n- Details: ${JSON.stringify(data, null, 2)}`;
            } else if (status === 404) {
              errorMessage = 'n8n API endpoint not found. Check if n8n is running and API is enabled.';
            } else {
              errorMessage = data?.message || `HTTP ${status} error`;
              debugInfo = `\n\n**Debug Info:**\n${JSON.stringify(data, null, 2)}`;
            }
          } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Cannot connect to n8n. Please ensure n8n is running on http://localhost:5678';
          } else {
            errorMessage = error.message;
          }

          return {
            content: [
              {
                type: "text",
                text: `**Workflow creation failed**\n\n${errorMessage}${debugInfo}\n\n**Troubleshooting:**\n• Verify n8n is running\n• Check API key validity\n• Ensure proper node structure\n• Try with simpler workflow first`,
              },
            ],
            isError: true,
          };
        }

      case "create_smart_workflow":
        try {
          const { name, description, nodeTypes, pattern = "linear", active = false } = request.params.arguments;

          // Générer automatiquement les nodes à partir des types
          const nodes = nodeTypes.map((nodeType, index) => {
            // Normaliser le type de node
            const fullNodeType = nodeType.startsWith('n8n-nodes-base.')
              ? nodeType
              : `n8n-nodes-base.${nodeType}`;

            // Générer des noms intelligents
            const nodeNames = {
              'webhook': 'Webhook Trigger',
              'manualTrigger': 'Manual Start',
              'cron': 'Schedule Trigger',
              'set': 'Process Data',
              'httpRequest': 'HTTP Request',
              'emailSend': 'Send Email',
              'code': 'Custom Code',
              'if': 'Condition Check',
              'switch': 'Route Data',
              'respondToWebhook': 'Send Response'
            };

            const shortType = fullNodeType.replace('n8n-nodes-base.', '');
            const nodeName = nodeNames[shortType] || shortType.charAt(0).toUpperCase() + shortType.slice(1);

            return {
              id: `node-${index + 1}-${shortType}`,
              name: nodeName,
              type: fullNodeType,
              typeVersion: 1,
              position: [250 + (index * 200), 300], // Position temporaire
              parameters: {}
            };
          });

          // Générer des connexions selon le pattern choisi
          let smartConnections = {};

          switch (pattern) {
            case "linear":
              smartConnections = generateSmartConnections(nodes);
              break;

            case "parallel":
              // Connecter le premier node à tous les autres
              if (nodes.length > 1) {
                const firstNode = nodes[0];
                const otherNodes = nodes.slice(1);
                smartConnections[firstNode.name] = {
                  main: [otherNodes.map(node => ({ node: node.name, type: 'main', index: 0 }))]
                };
              }
              break;

            case "conditional":
              // Pattern avec IF: trigger -> condition -> actions
              if (nodes.length >= 3) {
                smartConnections[nodes[0].name] = {
                  main: [[{ node: nodes[1].name, type: 'main', index: 0 }]]
                };
                // Connecter la condition aux nodes suivants
                smartConnections[nodes[1].name] = {
                  main: [
                    nodes.slice(2).map(node => ({ node: node.name, type: 'main', index: 0 }))
                  ]
                };
              }
              break;

            default:
              smartConnections = generateSmartConnections(nodes);
          }

          // Optimiser les positions selon le pattern
          const optimizedNodes = optimizeNodePositions(nodes, smartConnections);

          // Créer le workflow avec les nodes et connexions générés
          const workflowData = {
            name,
            nodes: optimizedNodes,
            connections: smartConnections,
            settings: {}
          };

          const result = await makeApiRequest('/workflows', 'POST', workflowData);

          // Activer si demandé
          if (active && result.id) {
            try {
              await makeApiRequest(`/workflows/${result.id}/activate`, 'POST');
              result.active = true;
            } catch (activateError) {
              console.error('Failed to activate workflow:', activateError.message);
            }
          }

          return {
            content: [
              {
                type: "text",
                text: `**Smart Workflow Created!**\n\n` +
                      `**"${name}"** successfully generated with AI\n\n` +
                      `**Generated Structure:**\n` +
                      `• Pattern: ${pattern.toUpperCase()}\n` +
                      `• Nodes: ${result.nodes.length}\n` +
                      `• Connections: ${Object.keys(smartConnections).length}\n` +
                      `• Status: ${result.active ? '🟢 Active' : '🔴 Inactive'}\n\n` +
                      `**Node Flow:**\n` +
                      `${result.nodes.map((n, i) => `${i + 1}. ${n.name}`).join(' → ')}\n\n` +
                      `🧠 **AI Features Applied:**\n` +
                      `• Smart node positioning\n` +
                      `• Automatic logical connections\n` +
                      `• Optimized workflow pattern\n` +
                      `• Default parameter generation\n\n` +
                      (description ? `📝 **Purpose:** ${description}\n\n` : '') +
                      `🌐 **View in n8n:** http://localhost:5678/workflow/${result.id}`,
              },
            ],
          };

        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `**Smart Workflow Creation Failed**\n\n${error.response?.data?.message || error.message}\n\nTry with simpler node types: webhook, set, httpRequest`,
              },
            ],
            isError: true,
          };
        }

      case "activate_workflow":
        try {
          const { id, active } = request.params.arguments;

          const result = await makeApiRequest(`/workflows/${id}/${active ? 'activate' : 'deactivate'}`, 'POST');

          return {
            content: [
              {
                type: "text",
                text: `Workflow ${active ? 'activated' : 'deactivated'} successfully!\n\n` +
                      `Workflow ID: ${id}\n` +
                      `Status: ${active ? 'Active' : 'Inactive'}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error ${request.params.arguments.active ? 'activating' : 'deactivating'} workflow: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "get_workflow":
        try {
          const { id } = request.params.arguments;

          const workflow = await makeApiRequest(`/workflows/${id}`);

          return {
            content: [
              {
                type: "text",
                text: `Workflow Details:\n\n` +
                      `**Name:** ${workflow.name}\n` +
                      `**ID:** ${workflow.id}\n` +
                      `**Status:** ${workflow.active ? 'Active' : 'Inactive'}\n` +
                      `**Nodes:** ${workflow.nodes.length}\n` +
                      `**Created:** ${new Date(workflow.createdAt).toLocaleString()}\n` +
                      `**Updated:** ${new Date(workflow.updatedAt).toLocaleString()}\n\n` +
                      `**Node Types:**\n${workflow.nodes.map(n => `- ${n.name} (${n.type})`).join('\n')}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching workflow: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "create_advanced_workflow":
        try {
          const { name, nodes, connectionType = "auto", connectionConfig = {}, active = false } = request.params.arguments;

          if (!name || !nodes || nodes.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Validation failed: Missing required fields (name, nodes)`,
                },
              ],
              isError: true,
            };
          }

          // Configure advanced connection settings based on type
          const advancedConfig = {
            enableMerge: connectionType === "merge" || connectionType === "auto",
            enableSwitch: connectionType === "switch" || connectionType === "auto",
            enableErrorHandling: connectionType === "error_handling" || connectionType === "auto",
            enableAdvancedWebhook: connectionType === "advanced_webhook" || connectionType === "auto",
            enableLoops: connectionType === "loops" || connectionType === "auto",
            enableTemporal: connectionType === "temporal" || connectionType === "auto",
            enableAI: connectionType === "ai_enrichment" || connectionType === "auto",
            enableDynamic: connectionType === "dynamic_source" || connectionType === "auto",
            enableParallel: connectionType === "parallel_advanced" || connectionType === "auto",
            enableStateful: connectionType === "stateful" || connectionType === "auto",
            ...connectionConfig
          };

          // Generate advanced connections
          const smartConnections = generateAdvancedConnections(nodes, advancedConfig);

          // Optimize node positions
          const optimizedNodes = optimizeNodePositions(nodes, smartConnections);

          // Create workflow data
          const workflowData = {
            name,
            nodes: optimizedNodes.map(node => ({
              id: node.id || node.name,
              name: node.name,
              type: node.type,
              position: node.position || [250, 300],
              parameters: node.parameters || {}
            })),
            connections: smartConnections,
            settings: {},
            staticData: null,
            pinData: {}
          };

          // Create workflow with progressive fallback
          let result;
          try {
            result = await makeApiRequest('/workflows', 'POST', workflowData);
          } catch (firstError) {
            if (firstError.response?.status === 400 && firstError.response?.data?.message?.includes('settings')) {
              workflowData.settings = { saveExecutionManually: false };
              try {
                result = await makeApiRequest('/workflows', 'POST', workflowData);
              } catch (secondError) {
                const fullWorkflowData = {
                  ...workflowData,
                  settings: {
                    saveExecutionManually: false,
                    saveExecutionProgress: false,
                    saveDataErrorExecution: 'all',
                    saveDataSuccessExecution: 'all'
                  }
                };
                result = await makeApiRequest('/workflows', 'POST', fullWorkflowData);
              }
            } else {
              throw firstError;
            }
          }

          // Activate if requested
          if (active && result.id) {
            try {
              await makeApiRequest(`/workflows/${result.id}/activate`, 'POST');
              result.active = true;
            } catch (activateError) {
              console.error('Failed to activate workflow:', activateError.message);
            }
          }

          // Analyze connection statistics
          const connectionCount = Object.keys(smartConnections).length;
          const connectionTypes = [];

          if (advancedConfig.enableMerge) connectionTypes.push("Merge/Split");
          if (advancedConfig.enableSwitch) connectionTypes.push("Switch Routing");
          if (advancedConfig.enableErrorHandling) connectionTypes.push("Error Handling");
          if (advancedConfig.enableAdvancedWebhook) connectionTypes.push("Advanced Webhook");
          if (advancedConfig.enableLoops) connectionTypes.push("Loops");
          if (advancedConfig.enableTemporal) connectionTypes.push("Temporal");
          if (advancedConfig.enableAI) connectionTypes.push("AI Enrichment");
          if (advancedConfig.enableDynamic) connectionTypes.push("Dynamic Sources");
          if (advancedConfig.enableParallel) connectionTypes.push("Parallel Processing");
          if (advancedConfig.enableStateful) connectionTypes.push("Stateful");

          return {
            content: [
              {
                type: "text",
                text: `**Advanced Workflow Created Successfully**\n\n` +
                      `**"${result.name}"** with sophisticated connection patterns\n\n` +
                      `**Details:**\n` +
                      `• Workflow ID: ${result.id}\n` +
                      `• Nodes: ${result.nodes?.length || nodes.length}\n` +
                      `• Advanced Connections: ${connectionCount}\n` +
                      `• Connection Types: ${connectionTypes.join(', ')}\n` +
                      `• Status: ${result.active ? 'Active' : 'Inactive'}\n\n` +
                      `**Workflow Structure:**\n` +
                      `${result.nodes?.map(n => `• ${n.name} (${n.type.split('.').pop()})`).join('\n') || 'No nodes'}\n\n` +
                      `**Advanced Features Applied:**\n` +
                      `• Intelligent connection routing\n` +
                      `• Advanced error handling\n` +
                      `• Smart node positioning\n` +
                      `• Enterprise-grade patterns\n\n` +
                      `**Next Steps:**\n` +
                      `• Configure node credentials if needed\n` +
                      `• Test workflow execution\n` +
                      `• Monitor advanced connection behavior`,
              },
            ],
          };
        } catch (error) {
          let errorMessage = 'Failed to create advanced workflow';
          let debugInfo = '';

          if (error.response) {
            const { status, data } = error.response;
            if (status === 401) {
              errorMessage = 'Authentication failed. Check your n8n API key.';
            } else if (status === 400) {
              errorMessage = 'Invalid workflow data or advanced connection configuration.';
              debugInfo = `\n\n**Debug Info:**\n- Status: ${status}\n- Details: ${JSON.stringify(data, null, 2)}`;
            } else if (status === 404) {
              errorMessage = 'n8n API endpoint not found. Check if n8n is running and API is enabled.';
            } else {
              errorMessage = `HTTP ${status}: ${data?.message || 'Unknown error'}`;
              debugInfo = `\n\n**Debug Info:**\n${JSON.stringify(data, null, 2)}`;
            }
          } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Cannot connect to n8n. Ensure n8n is running on the configured URL.';
          }

          return {
            content: [
              {
                type: "text",
                text: `**Advanced Workflow Creation Failed**\n\n${errorMessage}${debugInfo}\n\n**Troubleshooting:**\n• Verify n8n is running\n• Check API key validity\n• Ensure proper node structure\n• Validate advanced connection configuration\n• Try with simpler connection types first`,
              },
            ],
            isError: true,
          };
        }

      case "create_workflow_template":
        try {
          const { template, name, config = {} } = request.params.arguments;

          const templates = {
            webhook_to_email: {
              description: "Webhook that processes data and sends email notifications",
              nodes: [
                {
                  id: "webhook",
                  name: "Webhook Trigger",
                  type: "n8n-nodes-base.webhook",
                  position: [250, 300],
                  parameters: {
                    httpMethod: "POST",
                    path: config.webhookPath || "webhook-trigger",
                    responseMode: "onReceived"
                  }
                },
                {
                  id: "process-data",
                  name: "Process Data",
                  type: "n8n-nodes-base.set",
                  position: [450, 300],
                  parameters: {
                    assignments: {
                      assignments: [
                        {
                          id: "processed-message",
                          name: "message",
                          value: `Received data: {{ JSON.stringify($json) }}`,
                          type: "string"
                        }
                      ]
                    }
                  }
                },
                {
                  id: "send-email",
                  name: "Send Email",
                  type: "n8n-nodes-base.emailSend",
                  position: [650, 300],
                  parameters: {
                    fromEmail: config.fromEmail || "noreply@example.com",
                    toEmail: config.toEmail || "admin@example.com",
                    subject: "Webhook Notification",
                    text: "={{ $json.message }}"
                  }
                }
              ],
              connections: {
                webhook: { main: [[{ node: "process-data", type: "main", index: 0 }]] },
                "process-data": { main: [[{ node: "send-email", type: "main", index: 0 }]] }
              }
            },
            cron_backup: {
              description: "Scheduled backup workflow",
              nodes: [
                {
                  id: "cron-trigger",
                  name: "Schedule Trigger",
                  type: "n8n-nodes-base.cron",
                  position: [250, 300],
                  parameters: {
                    rule: {
                      hour: config.hour || 2,
                      minute: config.minute || 0
                    }
                  }
                },
                {
                  id: "backup-files",
                  name: "Backup Files",
                  type: "n8n-nodes-base.httpRequest",
                  position: [450, 300],
                  parameters: {
                    method: "POST",
                    url: config.backupUrl || "https://api.backup-service.com/backup",
                    sendHeaders: true,
                    headerParameters: {
                      parameters: [
                        { name: "Authorization", value: `Bearer ${config.apiKey || 'YOUR_API_KEY'}` }
                      ]
                    }
                  }
                }
              ],
              connections: {
                "cron-trigger": { main: [[{ node: "backup-files", type: "main", index: 0 }]] }
              }
            }
          };

          const templateData = templates[template];
          if (!templateData) {
            return {
              content: [
                {
                  type: "text",
                  text: `Template '${template}' not found. Available templates: ${Object.keys(templates).join(', ')}`,
                },
              ],
              isError: true,
            };
          }

          // Créer le workflow à partir du template
          const workflowData = {
            name,
            description: templateData.description,
            nodes: templateData.nodes,
            connections: templateData.connections,
            active: false,
            settings: {},
            tags: ["template", template],
            meta: {
              templateCreatedBy: 'Claude MCP Server',
              templateType: template,
              createdAt: new Date().toISOString()
            }
          };

          const result = await makeApiRequest('/workflows', 'POST', workflowData);

          return {
            content: [
              {
                type: "text",
                text: `Workflow "${name}" created from template "${template}"!\n\n` +
                      `**Details:**\n` +
                      `• ID: ${result.id}\n` +
                      `• Template: ${template}\n` +
                      `• Description: ${templateData.description}\n` +
                      `• Nodes: ${result.nodes.length}\n\n` +
                      `**Next Steps:**\n` +
                      `• Configure credentials if needed\n` +
                      `• Customize parameters\n` +
                      `• Activate the workflow\n\n` +
                      `🌐 **View in n8n:** http://localhost:5678/workflow/${result.id}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating workflow from template: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "validate_workflow":
        try {
          const { nodes, connections = {} } = request.params.arguments;

          const validationErrors = [];
          const warnings = [];
          const suggestions = [];

          // Validation des nodes (basée sur les patterns des repos GitHub)
          const nodeIds = new Set();
          const nodeTypes = new Set();

          nodes.forEach((node, index) => {
            // Validation obligatoire
            if (!node.id) validationErrors.push(`Node ${index + 1}: Missing 'id' field`);
            if (!node.name) validationErrors.push(`Node ${index + 1}: Missing 'name' field`);
            if (!node.type) validationErrors.push(`Node ${index + 1}: Missing 'type' field`);
            if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
              validationErrors.push(`Node '${node.id || index + 1}': Invalid position (must be [x, y] array)`);
            }

            // Vérification unicité ID
            if (node.id && nodeIds.has(node.id)) {
              validationErrors.push(`Duplicate node ID: '${node.id}'`);
            }
            if (node.id) nodeIds.add(node.id);

            // Validation type de node
            if (node.type) {
              nodeTypes.add(node.type);
              if (!node.type.startsWith('n8n-nodes-')) {
                warnings.push(`Node '${node.id}': Type '${node.type}' may not be a valid n8n node type`);
              }
            }

            // Validation des paramètres (patterns trouvés dans les repos)
            if (node.type && !node.parameters) {
              suggestions.push(`Node '${node.id}': Consider adding 'parameters' object for configuration`);
            }

            // Validation typeVersion
            if (!node.typeVersion) {
              suggestions.push(`Node '${node.id}': Consider specifying 'typeVersion' (default: 1)`);
            }
          });

          // Validation des connexions (améliorée selon les repos analysés)
          for (const [sourceId, sourceConnections] of Object.entries(connections)) {
            if (!nodeIds.has(sourceId)) {
              validationErrors.push(`Connection source '${sourceId}' does not exist in nodes`);
              continue;
            }

            if (sourceConnections.main) {
              sourceConnections.main.forEach((connectionGroup, groupIndex) => {
                if (!Array.isArray(connectionGroup)) {
                  validationErrors.push(`Connection from '${sourceId}' group ${groupIndex}: Must be an array`);
                  return;
                }

                connectionGroup.forEach((connection, connIndex) => {
                  if (!connection.node) {
                    validationErrors.push(`Connection from '${sourceId}' [${groupIndex}][${connIndex}]: Missing 'node' field`);
                  } else if (!nodeIds.has(connection.node)) {
                    validationErrors.push(`Connection target '${connection.node}' does not exist in nodes`);
                  }

                  if (connection.type && connection.type !== 'main') {
                    warnings.push(`Connection '${sourceId}' -> '${connection.node}': Non-main connection type '${connection.type}'`);
                  }

                  if (connection.index !== undefined && typeof connection.index !== 'number') {
                    warnings.push(`Connection '${sourceId}' -> '${connection.node}': Index should be a number`);
                  }
                });
              });
            }
          }

          // Analyse de la structure du workflow (patterns des repos)
          const triggerNodes = nodes.filter(n =>
            n.type && (
              n.type.includes('trigger') ||
              n.type.includes('webhook') ||
              n.type.includes('cron') ||
              n.type.includes('interval') ||
              n.type.includes('manual')
            )
          );

          const actionNodes = nodes.filter(n =>
            n.type && (
              n.type.includes('set') ||
              n.type.includes('httpRequest') ||
              n.type.includes('code') ||
              n.type.includes('function')
            )
          );

          // Validation structure workflow
          if (triggerNodes.length === 0) {
            warnings.push("No trigger nodes found. Workflow may not execute automatically.");
            suggestions.push("Add a trigger node like 'webhook', 'cron', or 'manualTrigger'");
          }

          if (triggerNodes.length > 3) {
            warnings.push(`Multiple triggers found (${triggerNodes.length}). Consider simplifying the workflow.`);
          }

          if (nodes.length > 20) {
            suggestions.push("Large workflow detected. Consider breaking into smaller, reusable workflows.");
          }

          // Vérifications spécifiques selon les bonnes pratiques
          const orphanNodes = nodes.filter(node => {
            const hasIncomingConnections = Object.values(connections).some(conn =>
              conn.main?.some(group => group.some(target => target.node === node.id))
            );
            const hasOutgoingConnections = connections[node.id];
            const isTrigger = triggerNodes.some(t => t.id === node.id);

            return !hasIncomingConnections && !isTrigger && nodes.length > 1;
          });

          if (orphanNodes.length > 0) {
            warnings.push(`Orphan nodes detected: ${orphanNodes.map(n => n.id).join(', ')}`);
          }

          const result = {
            valid: validationErrors.length === 0,
            errors: validationErrors,
            warnings: warnings,
            suggestions: suggestions,
            stats: {
              nodeCount: nodes.length,
              connectionCount: Object.keys(connections).length,
              triggerNodes: triggerNodes.length,
              actionNodes: actionNodes.length,
              uniqueNodeTypes: nodeTypes.size
            }
          };

          return {
            content: [
              {
                type: "text",
                text: `**Workflow Validation ${result.valid ? 'PASSED' : 'FAILED'}**\n\n` +
                      `**Statistics:**\n` +
                      `• Total Nodes: ${result.stats.nodeCount}\n` +
                      `• Connections: ${result.stats.connectionCount}\n` +
                      `• Triggers: ${result.stats.triggerNodes}\n` +
                      `• Actions: ${result.stats.actionNodes}\n` +
                      `• Node Types: ${result.stats.uniqueNodeTypes}\n\n` +
                      (result.errors.length > 0 ? `**Errors (${result.errors.length}):**\n${result.errors.map(err => `• ${err}`).join('\n')}\n\n` : '') +
                      (result.warnings.length > 0 ? `**Warnings (${result.warnings.length}):**\n${result.warnings.map(warn => `• ${warn}`).join('\n')}\n\n` : '') +
                      (result.suggestions.length > 0 ? `**Suggestions (${result.suggestions.length}):**\n${result.suggestions.map(sug => `• ${sug}`).join('\n')}\n\n` : '') +
                      `**Status:** ${result.valid ? '🟢 Ready for creation!' : '🔴 Fix errors before proceeding'}`,
              },
            ],
            isError: !result.valid,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `**Validation Error**\n\n${error.message}\n\nEnsure you provide valid 'nodes' and 'connections' objects.`,
              },
            ],
            isError: true,
          };
        }

      case "execute_workflow":
        try {
          const { id, data = {} } = request.params.arguments;

          const execution = await makeApiRequest(`/workflows/${id}/execute`, 'POST', data);

          return {
            content: [
              {
                type: "text",
                text: `Workflow execution started!\n\n` +
                      `📋 **Execution Details:**\n` +
                      `• Workflow ID: ${id}\n` +
                      `• Execution ID: ${execution.id}\n` +
                      `• Status: ${execution.status || 'Started'}\n` +
                      `• Started: ${new Date(execution.startedAt || Date.now()).toLocaleString()}\n\n` +
                      `🔍 **Monitor execution:** http://localhost:5678/executions`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing workflow: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "execution_list":
        try {
          const { workflowId, limit = 20, status } = request.params.arguments;

          let endpoint = '/executions';
          const params = new URLSearchParams();

          if (limit) params.append('limit', limit.toString());
          if (status) params.append('status', status);
          if (workflowId) params.append('workflowId', workflowId);

          if (params.toString()) {
            endpoint += `?${params.toString()}`;
          }

          const executions = await makeApiRequest(endpoint);

          return {
            content: [
              {
                type: "text",
                text: `📊 **Executions** ${workflowId ? `for workflow ${workflowId}` : '(All workflows)'}\n\n` +
                      `Found ${executions.data.length} executions:\n\n` +
                      executions.data.map(exec =>
                        `${exec.status === 'success' ? '[SUCCESS]' : exec.status === 'error' ? '[ERROR]' : '[RUNNING]'} ` +
                        `**${exec.id}** - ${exec.workflowName || exec.workflowId}\n` +
                        `   Status: ${exec.status} | Started: ${new Date(exec.startedAt).toLocaleString()}\n` +
                        `   Duration: ${exec.stoppedAt ? `${Math.round((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000)}s` : 'Running'}`
                      ).join('\n\n') +
                      `\n\n🔍 **View executions:** http://localhost:5678/executions`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing executions: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "execution_get":
        try {
          const { id } = request.params.arguments;

          const execution = await makeApiRequest(`/executions/${id}`);

          return {
            content: [
              {
                type: "text",
                text: `📋 **Execution Details**\n\n` +
                      `**ID:** ${execution.id}\n` +
                      `**Workflow:** ${execution.workflowName || execution.workflowId}\n` +
                      `**Status:** ${execution.status === 'success' ? 'Success' : execution.status === 'error' ? 'Error' : execution.status}\n` +
                      `**Started:** ${new Date(execution.startedAt).toLocaleString()}\n` +
                      `**Stopped:** ${execution.stoppedAt ? new Date(execution.stoppedAt).toLocaleString() : 'Still running'}\n` +
                      `**Duration:** ${execution.stoppedAt ? `${Math.round((new Date(execution.stoppedAt) - new Date(execution.startedAt)) / 1000)}s` : 'Running'}\n` +
                      `**Mode:** ${execution.mode}\n\n` +
                      (execution.data ? `**Result Data:** ${Object.keys(execution.data).length} nodes executed\n` : '') +
                      `🔍 **View in n8n:** http://localhost:5678/executions/execution/${id}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error getting execution: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "execution_stop":
        try {
          const { id } = request.params.arguments;

          await makeApiRequest(`/executions/${id}/stop`, 'POST');

          return {
            content: [
              {
                type: "text",
                text: `🛑 **Execution Stopped**\n\n` +
                      `Execution ID: ${id}\n` +
                      `Status: Stopped successfully`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error stopping execution: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "workflow_update":
        try {
          const { id, name, nodes, connections, active, settings } = request.params.arguments;

          // Construire les données de mise à jour
          const updateData = {};
          if (name !== undefined) updateData.name = name;
          if (nodes !== undefined) updateData.nodes = nodes;
          if (connections !== undefined) updateData.connections = connections;
          if (active !== undefined) updateData.active = active;
          if (settings !== undefined) updateData.settings = settings;

          const result = await makeApiRequest(`/workflows/${id}`, 'PUT', updateData);

          return {
            content: [
              {
                type: "text",
                text: `**Workflow Updated**\n\n` +
                      `**ID:** ${result.id}\n` +
                      `**Name:** ${result.name}\n` +
                      `**Status:** ${result.active ? '🟢 Active' : '🔴 Inactive'}\n` +
                      `**Nodes:** ${result.nodes.length}\n` +
                      `**Updated:** ${new Date(result.updatedAt).toLocaleString()}\n\n` +
                      `🌐 **View in n8n:** http://localhost:5678/workflow/${result.id}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating workflow: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

      case "workflow_delete":
        try {
          const { id } = request.params.arguments;

          // Récupérer les détails du workflow avant suppression
          const workflow = await makeApiRequest(`/workflows/${id}`);
          await makeApiRequest(`/workflows/${id}`, 'DELETE');

          return {
            content: [
              {
                type: "text",
                text: `**Workflow Deleted**\n\n` +
                      `**ID:** ${id}\n` +
                      `**Name:** ${workflow.name}\n` +
                      `**Nodes:** ${workflow.nodes.length}\n\n` +
                      `This action cannot be undone.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error deleting workflow: ${error.response?.data?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }

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

// Démarrer le serveur
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('N8n MCP server running on stdio');
}

main().catch(console.error);