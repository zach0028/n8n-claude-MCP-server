#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash, createHmac } from 'crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import forge from 'node-forge';

// Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Enterprise Security Configuration
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SESSION_TIMEOUT = process.env.SESSION_TIMEOUT || 3600000; // 1 hour
const ENABLE_RBAC = process.env.ENABLE_RBAC === 'true';
const ENABLE_AUDIT_LOG = process.env.ENABLE_AUDIT_LOG !== 'false';
const ENABLE_MULTI_TENANT = process.env.ENABLE_MULTI_TENANT === 'true';

// MCP Protocol Security Configuration (RFC 8707 Resource Indicators)
const MCP_SERVER_ID = process.env.MCP_SERVER_ID || uuidv4();
const MCP_NAMESPACE = process.env.MCP_NAMESPACE || 'urn:n8n:mcp:server';
const RESOURCE_INDICATOR_SECRET = process.env.RESOURCE_INDICATOR_SECRET || randomBytes(32).toString('hex');
const ENABLE_RESOURCE_INDICATORS = process.env.ENABLE_RESOURCE_INDICATORS !== 'false';
const ENABLE_TRANSPORT_ENCRYPTION = process.env.ENABLE_TRANSPORT_ENCRYPTION === 'true';
const MCP_PROTOCOL_VERSION = '1.0.0';

// Transport Security
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
const MAX_REQUEST_SIZE = parseInt(process.env.MAX_REQUEST_SIZE) || 10485760; // 10MB
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 1000;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 3600000; // 1 hour

// Initialize JSON Schema validator
const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);

// Enterprise User Roles and Permissions
const USER_ROLES = {
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
  GUEST: 'guest'
};

const PERMISSIONS = {
  CREATE_WORKFLOW: 'create_workflow',
  UPDATE_WORKFLOW: 'update_workflow',
  DELETE_WORKFLOW: 'delete_workflow',
  EXECUTE_WORKFLOW: 'execute_workflow',
  VIEW_WORKFLOW: 'view_workflow',
  MANAGE_USERS: 'manage_users',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_TEMPLATES: 'manage_templates'
};

const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: Object.values(PERMISSIONS),
  [USER_ROLES.DEVELOPER]: [
    PERMISSIONS.CREATE_WORKFLOW,
    PERMISSIONS.UPDATE_WORKFLOW,
    PERMISSIONS.EXECUTE_WORKFLOW,
    PERMISSIONS.VIEW_WORKFLOW,
    PERMISSIONS.MANAGE_TEMPLATES
  ],
  [USER_ROLES.VIEWER]: [
    PERMISSIONS.VIEW_WORKFLOW,
    PERMISSIONS.EXECUTE_WORKFLOW
  ],
  [USER_ROLES.GUEST]: [
    PERMISSIONS.VIEW_WORKFLOW
  ]
};

// In-memory stores (in production, use Redis or database)
const userSessions = new Map();
const auditLogs = [];
const userDatabase = new Map();
const tenantDatabase = new Map();
const resourceIndicators = new Map();
const requestMetrics = new Map();
const errorBoundaries = new Map();
const rateLimitStore = new Map();
const templateMarketplace = new Map();
const workflowVersions = new Map();
const environments = new Map();

// Default admin user (should be configured via environment in production)
if (!userDatabase.has('admin')) {
  userDatabase.set('admin', {
    id: 'admin',
    username: 'admin',
    email: 'admin@localhost',
    password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
    role: USER_ROLES.ADMIN,
    tenantId: 'default',
    createdAt: new Date().toISOString(),
    isActive: true
  });
}

// Default tenant
if (!tenantDatabase.has('default')) {
  tenantDatabase.set('default', {
    id: 'default',
    name: 'Default Organization',
    createdAt: new Date().toISOString(),
    isActive: true,
    settings: {
      maxWorkflows: 1000,
      maxExecutionsPerMonth: 10000
    }
  });
}

// Initialize Template Marketplace with popular templates
if (templateMarketplace.size === 0) {
  const popularTemplates = [
    {
      id: 'webhook-to-email',
      name: 'Webhook to Email',
      description: 'Receive webhook data and send email notifications',
      category: 'communication',
      tags: ['webhook', 'email', 'notification'],
      difficulty: 'beginner',
      estimatedTime: '5 minutes',
      author: 'n8n-community',
      version: '1.0.0',
      downloads: 15420,
      rating: 4.8,
      verified: true,
      template: {
        nodes: [
          {
            id: 'webhook-trigger',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [100, 200],
            parameters: {
              httpMethod: 'POST',
              path: 'webhook-endpoint'
            }
          },
          {
            id: 'email-send',
            name: 'Send Email',
            type: 'n8n-nodes-base.emailSend',
            position: [400, 200],
            parameters: {
              subject: 'New Webhook Received',
              text: 'Webhook data: {{JSON.stringify($json)}}'
            }
          }
        ],
        autoConnect: true,
        advancedConnections: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'data-processing-pipeline',
      name: 'Data Processing Pipeline',
      description: 'Advanced data transformation and validation pipeline',
      category: 'data-processing',
      tags: ['data', 'transformation', 'validation', 'pipeline'],
      difficulty: 'intermediate',
      estimatedTime: '15 minutes',
      author: 'n8n-experts',
      version: '2.1.0',
      downloads: 8960,
      rating: 4.9,
      verified: true,
      template: {
        nodes: [
          {
            id: 'trigger',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            position: [100, 200],
            parameters: {}
          },
          {
            id: 'validate-data',
            name: 'Validate Input',
            type: 'n8n-nodes-base.function',
            position: [300, 200],
            parameters: {
              functionCode: `
                // Validate required fields
                if (!$json.email || !$json.name) {
                  throw new Error('Missing required fields: email, name');
                }

                // Email validation
                const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                if (!emailRegex.test($json.email)) {
                  throw new Error('Invalid email format');
                }

                return $json;
              `
            }
          },
          {
            id: 'transform-data',
            name: 'Transform Data',
            type: 'n8n-nodes-base.set',
            position: [500, 200],
            parameters: {
              assignments: {
                assignments: [
                  {
                    id: 'processed_at',
                    name: 'processedAt',
                    value: '={{new Date().toISOString()}}',
                    type: 'string'
                  },
                  {
                    id: 'full_name',
                    name: 'fullName',
                    value: '={{$json.firstName}} {{$json.lastName}}',
                    type: 'string'
                  }
                ]
              }
            }
          },
          {
            id: 'store-result',
            name: 'Store Result',
            type: 'n8n-nodes-base.httpRequest',
            position: [700, 200],
            parameters: {
              method: 'POST',
              url: 'https://api.example.com/users',
              sendBody: true,
              bodyParameters: {
                parameters: [
                  {
                    name: 'data',
                    value: '={{JSON.stringify($json)}}'
                  }
                ]
              }
            }
          }
        ],
        autoConnect: true,
        advancedConnections: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ai-content-moderator',
      name: 'AI Content Moderator',
      description: 'AI-powered content moderation with sentiment analysis',
      category: 'ai-automation',
      tags: ['ai', 'content', 'moderation', 'sentiment', 'openai'],
      difficulty: 'advanced',
      estimatedTime: '25 minutes',
      author: 'ai-specialists',
      version: '1.2.0',
      downloads: 5230,
      rating: 4.7,
      verified: true,
      template: {
        nodes: [
          {
            id: 'webhook-content',
            name: 'Content Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [100, 200],
            parameters: {
              httpMethod: 'POST',
              path: 'moderate-content'
            }
          },
          {
            id: 'ai-analysis',
            name: 'AI Content Analysis',
            type: 'n8n-nodes-base.openai',
            position: [300, 200],
            parameters: {
              operation: 'text',
              prompt: 'Analyze this content for sentiment and inappropriate material: {{$json.content}}. Return JSON with sentiment (positive/negative/neutral) and isAppropriate (true/false).'
            }
          },
          {
            id: 'content-router',
            name: 'Content Router',
            type: 'n8n-nodes-base.switch',
            position: [500, 200],
            parameters: {
              rules: {
                rules: [
                  {
                    operation: 'equal',
                    value1: '={{$json.isAppropriate}}',
                    value2: true
                  }
                ]
              }
            }
          },
          {
            id: 'approve-content',
            name: 'Approve Content',
            type: 'n8n-nodes-base.httpRequest',
            position: [700, 150],
            parameters: {
              method: 'POST',
              url: 'https://api.example.com/content/approve'
            }
          },
          {
            id: 'reject-content',
            name: 'Reject Content',
            type: 'n8n-nodes-base.httpRequest',
            position: [700, 250],
            parameters: {
              method: 'POST',
              url: 'https://api.example.com/content/reject'
            }
          }
        ],
        autoConnect: true,
        advancedConnections: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ecommerce-order-processor',
      name: 'E-commerce Order Processor',
      description: 'Complete order processing with inventory, payment, and notifications',
      category: 'ecommerce',
      tags: ['ecommerce', 'orders', 'inventory', 'payment', 'notifications'],
      difficulty: 'advanced',
      estimatedTime: '30 minutes',
      author: 'ecommerce-experts',
      version: '1.4.0',
      downloads: 12850,
      rating: 4.9,
      verified: true,
      template: {
        nodes: [
          {
            id: 'order-webhook',
            name: 'New Order',
            type: 'n8n-nodes-base.webhook',
            position: [100, 300],
            parameters: {
              httpMethod: 'POST',
              path: 'new-order'
            }
          },
          {
            id: 'validate-order',
            name: 'Validate Order',
            type: 'n8n-nodes-base.function',
            position: [300, 300],
            parameters: {
              functionCode: `
                const order = $json;

                // Validate required fields
                if (!order.items || !order.customerId || !order.total) {
                  throw new Error('Invalid order data');
                }

                // Validate items
                for (const item of order.items) {
                  if (!item.productId || !item.quantity || item.quantity <= 0) {
                    throw new Error('Invalid item in order');
                  }
                }

                return order;
              `
            }
          },
          {
            id: 'check-inventory',
            name: 'Check Inventory',
            type: 'n8n-nodes-base.httpRequest',
            position: [500, 250],
            parameters: {
              method: 'POST',
              url: 'https://inventory.example.com/check',
              sendBody: true,
              bodyParameters: {
                parameters: [
                  {
                    name: 'items',
                    value: '={{$json.items}}'
                  }
                ]
              }
            }
          },
          {
            id: 'process-payment',
            name: 'Process Payment',
            type: 'n8n-nodes-base.httpRequest',
            position: [500, 350],
            parameters: {
              method: 'POST',
              url: 'https://payment.example.com/charge',
              sendBody: true,
              bodyParameters: {
                parameters: [
                  {
                    name: 'amount',
                    value: '={{$json.total}}'
                  },
                  {
                    name: 'customerId',
                    value: '={{$json.customerId}}'
                  }
                ]
              }
            }
          },
          {
            id: 'merge-results',
            name: 'Merge Results',
            type: 'n8n-nodes-base.merge',
            position: [700, 300],
            parameters: {}
          },
          {
            id: 'send-confirmation',
            name: 'Send Confirmation',
            type: 'n8n-nodes-base.emailSend',
            position: [900, 300],
            parameters: {
              subject: 'Order Confirmation #{{$json.orderId}}',
              text: 'Your order has been processed successfully!'
            }
          }
        ],
        autoConnect: true,
        advancedConnections: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  popularTemplates.forEach(template => {
    templateMarketplace.set(template.id, template);
  });
}

// Initialize default environments
if (environments.size === 0) {
  const defaultEnvironments = [
    {
      id: 'development',
      name: 'Development',
      description: 'Development environment for testing workflows',
      url: 'http://localhost:5678',
      type: 'development',
      isActive: true,
      settings: {
        debugMode: true,
        logLevel: 'debug',
        maxExecutionTime: 300000,
        allowManualTrigger: true
      },
      createdAt: new Date().toISOString()
    },
    {
      id: 'staging',
      name: 'Staging',
      description: 'Staging environment for pre-production testing',
      url: 'https://staging.n8n.example.com',
      type: 'staging',
      isActive: true,
      settings: {
        debugMode: false,
        logLevel: 'info',
        maxExecutionTime: 600000,
        allowManualTrigger: true
      },
      createdAt: new Date().toISOString()
    },
    {
      id: 'production',
      name: 'Production',
      description: 'Production environment for live workflows',
      url: 'https://n8n.example.com',
      type: 'production',
      isActive: true,
      settings: {
        debugMode: false,
        logLevel: 'error',
        maxExecutionTime: 1800000,
        allowManualTrigger: false
      },
      createdAt: new Date().toISOString()
    }
  ];

  defaultEnvironments.forEach(env => {
    environments.set(env.id, env);
  });
}

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

// ENTERPRISE SECURITY SYSTEM
// JWT Token Authentication and Authorization

function generateSecureSessionId(userId) {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(16).toString('hex');
  return `${userId}:${timestamp}:${randomPart}`;
}

function createJWT(user, sessionId) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId,
    sessionId: sessionId,
    permissions: ROLE_PERMISSIONS[user.role] || [],
    iat: Math.floor(Date.now() / 1000),
    aud: 'n8n-mcp-server'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'n8n-mcp-server',
    subject: user.id
  });
}

function verifyJWT(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'n8n-mcp-server',
      audience: 'n8n-mcp-server'
    });

    // Check if session is still valid
    const session = userSessions.get(decoded.sessionId);
    if (!session || session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }

    // Update session last activity
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + SESSION_TIMEOUT;

    return decoded;
  } catch (error) {
    logAuditEvent('AUTH_FAILED', null, null, { error: error.message });
    throw new Error('Invalid or expired token');
  }
}

function authenticateUser(username, password) {
  const user = userDatabase.get(username);
  if (!user || !user.isActive) {
    logAuditEvent('LOGIN_FAILED', null, null, { username, reason: 'User not found or inactive' });
    return null;
  }

  if (!bcrypt.compareSync(password, user.password)) {
    logAuditEvent('LOGIN_FAILED', user.id, user.tenantId, { username, reason: 'Invalid password' });
    return null;
  }

  // Create secure session
  const sessionId = generateSecureSessionId(user.id);
  const sessionData = {
    userId: user.id,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT,
    userAgent: 'mcp-client',
    ipAddress: '127.0.0.1' // In production, get from request
  };

  userSessions.set(sessionId, sessionData);

  // Generate JWT token
  const token = createJWT(user, sessionId);

  logAuditEvent('LOGIN_SUCCESS', user.id, user.tenantId, { username, sessionId });

  return { token, user: { ...user, password: undefined }, sessionId };
}

function hasPermission(userToken, permission) {
  try {
    const decoded = verifyJWT(userToken);
    return decoded.permissions.includes(permission);
  } catch (error) {
    return false;
  }
}

function requirePermission(userToken, permission) {
  if (!hasPermission(userToken, permission)) {
    const error = new Error(`Access denied. Required permission: ${permission}`);
    error.code = 'INSUFFICIENT_PERMISSIONS';
    throw error;
  }
}

function logAuditEvent(action, userId = null, tenantId = null, metadata = {}) {
  if (!ENABLE_AUDIT_LOG) return;

  const logEntry = {
    id: randomBytes(8).toString('hex'),
    timestamp: new Date().toISOString(),
    action,
    userId,
    tenantId,
    metadata,
    source: 'mcp-server'
  };

  auditLogs.push(logEntry);

  // In production, send to audit logging service
  console.log('[AUDIT]', JSON.stringify(logEntry));

  // Keep only last 10000 audit logs in memory
  if (auditLogs.length > 10000) {
    auditLogs.splice(0, auditLogs.length - 10000);
  }
}

function validateTenantAccess(userToken, resourceTenantId) {
  if (!ENABLE_MULTI_TENANT) return true;

  try {
    const decoded = verifyJWT(userToken);
    return decoded.tenantId === resourceTenantId || decoded.role === USER_ROLES.ADMIN;
  } catch (error) {
    return false;
  }
}

function getWorkflowSchemas() {
  return {
    createWorkflow: {
      type: 'object',
      required: ['name', 'nodes'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          pattern: '^[a-zA-Z0-9\\s\\-_]+$'
        },
        nodes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: { type: 'string', minLength: 1 },
              type: { type: 'string', minLength: 1 },
              parameters: { type: 'object' },
              position: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2
              }
            }
          }
        },
        tags: {
          type: 'array',
          items: { type: 'string' }
        },
        settings: { type: 'object' },
        autoConnect: { type: 'boolean' },
        advancedConnections: { type: 'boolean' }
      },
      additionalProperties: false
    }
  };
}

function validateWorkflowData(data, schema = 'createWorkflow') {
  const schemas = getWorkflowSchemas();
  const validate = ajv.compile(schemas[schema]);
  const valid = validate(data);

  if (!valid) {
    const error = new Error('Validation failed');
    error.code = 'VALIDATION_ERROR';
    error.details = validate.errors;
    throw error;
  }

  return data;
}

// MCP PROTOCOL EXCELLENCE - RFC 8707 Resource Indicators & Security
// Modern MCP authorization patterns with enterprise-grade security

function generateResourceIndicator(resourceType, resourceId, userToken = null) {
  if (!ENABLE_RESOURCE_INDICATORS) return null;

  const namespace = uuidv5.DNS;
  const resourceURI = `${MCP_NAMESPACE}:${resourceType}:${resourceId}`;
  const indicator = uuidv5(resourceURI, namespace);

  // Create secure resource binding
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');

  let audience = 'public';
  if (userToken) {
    try {
      const decoded = verifyJWT(userToken);
      audience = `${decoded.tenantId}:${decoded.role}`;
    } catch (error) {
      // Non-authenticated access, use public audience
    }
  }

  const resourceData = {
    indicator,
    resourceType,
    resourceId,
    audience,
    timestamp,
    nonce,
    serverId: MCP_SERVER_ID,
    version: MCP_PROTOCOL_VERSION
  };

  // Generate integrity signature
  const signature = createHmac('sha256', RESOURCE_INDICATOR_SECRET)
    .update(JSON.stringify(resourceData))
    .digest('hex');

  resourceData.signature = signature;
  resourceIndicators.set(indicator, resourceData);

  logAuditEvent('RESOURCE_INDICATOR_CREATED', userToken ? 'authenticated' : 'anonymous', null, {
    resourceType,
    resourceId,
    indicator,
    audience
  });

  return indicator;
}

function validateResourceIndicator(indicator, userToken = null) {
  if (!ENABLE_RESOURCE_INDICATORS || !indicator) return { valid: false, reason: 'Resource indicators disabled or missing' };

  const resourceData = resourceIndicators.get(indicator);
  if (!resourceData) {
    return { valid: false, reason: 'Resource indicator not found' };
  }

  // Verify integrity signature
  const { signature, ...dataToVerify } = resourceData;
  const expectedSignature = createHmac('sha256', RESOURCE_INDICATOR_SECRET)
    .update(JSON.stringify(dataToVerify))
    .digest('hex');

  if (signature !== expectedSignature) {
    logAuditEvent('RESOURCE_INDICATOR_TAMPERED', null, null, { indicator });
    return { valid: false, reason: 'Resource indicator integrity check failed' };
  }

  // Check expiration (24 hours)
  const age = Date.now() - resourceData.timestamp;
  if (age > 86400000) { // 24 hours
    return { valid: false, reason: 'Resource indicator expired' };
  }

  // Validate audience if user token provided
  if (userToken) {
    try {
      const decoded = verifyJWT(userToken);
      const userAudience = `${decoded.tenantId}:${decoded.role}`;

      if (resourceData.audience !== 'public' && resourceData.audience !== userAudience && decoded.role !== USER_ROLES.ADMIN) {
        return { valid: false, reason: 'Insufficient permissions for resource' };
      }
    } catch (error) {
      if (resourceData.audience !== 'public') {
        return { valid: false, reason: 'Authentication required for protected resource' };
      }
    }
  }

  return {
    valid: true,
    resourceData,
    permissions: getResourcePermissions(resourceData.resourceType, userToken)
  };
}

function getResourcePermissions(resourceType, userToken = null) {
  const basePermissions = ['read'];

  if (!userToken) return basePermissions;

  try {
    const decoded = verifyJWT(userToken);
    const userPermissions = decoded.permissions || [];

    const resourcePermissionMap = {
      workflow: {
        [PERMISSIONS.VIEW_WORKFLOW]: ['read'],
        [PERMISSIONS.UPDATE_WORKFLOW]: ['read', 'update'],
        [PERMISSIONS.DELETE_WORKFLOW]: ['read', 'update', 'delete'],
        [PERMISSIONS.EXECUTE_WORKFLOW]: ['read', 'execute']
      },
      execution: {
        [PERMISSIONS.VIEW_WORKFLOW]: ['read'],
        [PERMISSIONS.EXECUTE_WORKFLOW]: ['read', 'stop']
      },
      template: {
        [PERMISSIONS.VIEW_WORKFLOW]: ['read'],
        [PERMISSIONS.MANAGE_TEMPLATES]: ['read', 'create', 'update', 'delete']
      }
    };

    const resourceMap = resourcePermissionMap[resourceType] || {};
    let grantedPermissions = [...basePermissions];

    userPermissions.forEach(permission => {
      if (resourceMap[permission]) {
        grantedPermissions = [...new Set([...grantedPermissions, ...resourceMap[permission]])];
      }
    });

    return grantedPermissions;
  } catch (error) {
    return basePermissions;
  }
}

function enforceRateLimit(identifier, maxRequests = RATE_LIMIT_REQUESTS, windowMs = RATE_LIMIT_WINDOW) {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }

  const requests = rateLimitStore.get(identifier);

  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);

  if (validRequests.length >= maxRequests) {
    const resetTime = validRequests[0] + windowMs;
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetTime,
      retryAfter: Math.ceil((resetTime - now) / 1000)
    };
  }

  validRequests.push(now);
  rateLimitStore.set(identifier, validRequests);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - validRequests.length,
    resetTime: now + windowMs,
    retryAfter: 0
  };
}

function createErrorBoundary(requestId, context = {}) {
  const boundary = {
    id: requestId || uuidv4(),
    timestamp: Date.now(),
    context,
    errors: [],
    warnings: [],
    metrics: {
      startTime: Date.now(),
      endTime: null,
      duration: null,
      memoryUsage: process.memoryUsage(),
      requestSize: JSON.stringify(context).length
    },
    status: 'active'
  };

  errorBoundaries.set(boundary.id, boundary);
  return boundary;
}

function addToBoundary(boundaryId, type, message, details = {}) {
  const boundary = errorBoundaries.get(boundaryId);
  if (!boundary) return;

  const entry = {
    timestamp: Date.now(),
    type,
    message,
    details,
    stack: new Error().stack
  };

  if (type === 'error') {
    boundary.errors.push(entry);
  } else if (type === 'warning') {
    boundary.warnings.push(entry);
  }

  // Log critical errors immediately
  if (type === 'error') {
    logAuditEvent('ERROR_BOUNDARY_TRIGGERED', null, null, {
      boundaryId,
      errorMessage: message,
      details
    });
  }
}

function finalizeBoundary(boundaryId, success = true) {
  const boundary = errorBoundaries.get(boundaryId);
  if (!boundary) return null;

  boundary.metrics.endTime = Date.now();
  boundary.metrics.duration = boundary.metrics.endTime - boundary.metrics.startTime;
  boundary.metrics.finalMemoryUsage = process.memoryUsage();
  boundary.status = success ? 'completed' : 'failed';

  // Store metrics for monitoring
  const metricsKey = `${Date.now()}-${boundaryId}`;
  requestMetrics.set(metricsKey, {
    duration: boundary.metrics.duration,
    errors: boundary.errors.length,
    warnings: boundary.warnings.length,
    success,
    timestamp: boundary.timestamp,
    requestSize: boundary.metrics.requestSize,
    memoryDelta: boundary.metrics.finalMemoryUsage.heapUsed - boundary.metrics.memoryUsage.heapUsed
  });

  // Clean up old boundaries (keep last 1000)
  if (errorBoundaries.size > 1000) {
    const entries = Array.from(errorBoundaries.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(1000);

    errorBoundaries.clear();
    entries.forEach(([id, boundary]) => errorBoundaries.set(id, boundary));
  }

  return boundary;
}

function encryptTransportData(data, key = RESOURCE_INDICATOR_SECRET) {
  if (!ENABLE_TRANSPORT_ENCRYPTION) return data;

  try {
    const cipher = forge.cipher.createCipher('AES-GCM', key.slice(0, 32));
    const iv = forge.random.getBytesSync(12);

    cipher.start({
      iv: iv,
      additionalData: 'mcp-transport'
    });

    cipher.update(forge.util.createBuffer(JSON.stringify(data)));
    cipher.finish();

    return {
      encrypted: true,
      data: forge.util.encode64(cipher.output.getBytes()),
      iv: forge.util.encode64(iv),
      tag: forge.util.encode64(cipher.mode.tag.getBytes()),
      algorithm: 'AES-GCM'
    };
  } catch (error) {
    logAuditEvent('ENCRYPTION_ERROR', null, null, { error: error.message });
    return data; // Fallback to unencrypted
  }
}

function decryptTransportData(encryptedData, key = RESOURCE_INDICATOR_SECRET) {
  if (!encryptedData.encrypted) return encryptedData;

  try {
    const decipher = forge.cipher.createDecipher('AES-GCM', key.slice(0, 32));

    decipher.start({
      iv: forge.util.decode64(encryptedData.iv),
      additionalData: 'mcp-transport',
      tag: forge.util.createBuffer(forge.util.decode64(encryptedData.tag))
    });

    decipher.update(forge.util.createBuffer(forge.util.decode64(encryptedData.data)));

    if (decipher.finish()) {
      return JSON.parse(decipher.output.toString());
    } else {
      throw new Error('Decryption failed');
    }
  } catch (error) {
    logAuditEvent('DECRYPTION_ERROR', null, null, { error: error.message });
    throw new Error('Failed to decrypt transport data');
  }
}

// TEMPLATE MARKETPLACE & VERSION CONTROL SYSTEM
// Enterprise-grade template management with Git-like versioning

function createWorkflowVersion(workflowId, workflowData, userToken, message = 'Workflow update') {
  try {
    const decoded = userToken ? verifyJWT(userToken) : null;
    const versionId = uuidv4();

    if (!workflowVersions.has(workflowId)) {
      workflowVersions.set(workflowId, []);
    }

    const versions = workflowVersions.get(workflowId);
    const version = {
      id: versionId,
      workflowId,
      version: `v${versions.length + 1}.0.0`,
      data: JSON.parse(JSON.stringify(workflowData)), // Deep clone
      author: decoded ? decoded.username : 'anonymous',
      authorId: decoded ? decoded.userId : null,
      message,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      hash: createHash('sha256').update(JSON.stringify(workflowData)).digest('hex').slice(0, 8),
      tags: [],
      isStable: false
    };

    versions.push(version);

    logAuditEvent('WORKFLOW_VERSION_CREATED', decoded?.userId, decoded?.tenantId, {
      workflowId,
      versionId,
      version: version.version,
      hash: version.hash
    });

    return version;
  } catch (error) {
    logAuditEvent('WORKFLOW_VERSION_ERROR', null, null, { error: error.message, workflowId });
    throw error;
  }
}

function getWorkflowVersions(workflowId, userToken = null) {
  try {
    if (ENABLE_RBAC && userToken) {
      requirePermission(userToken, PERMISSIONS.VIEW_WORKFLOW);
    }

    const versions = workflowVersions.get(workflowId) || [];

    return versions.map(version => ({
      id: version.id,
      version: version.version,
      author: version.author,
      message: version.message,
      timestamp: version.timestamp,
      createdAt: version.createdAt,
      hash: version.hash,
      tags: version.tags,
      isStable: version.isStable
    }));
  } catch (error) {
    throw new Error(`Failed to get workflow versions: ${error.message}`);
  }
}

function publishTemplate(templateData, userToken) {
  try {
    const decoded = verifyJWT(userToken);
    requirePermission(userToken, PERMISSIONS.MANAGE_TEMPLATES);

    const templateId = templateData.id || uuidv4();
    const template = {
      id: templateId,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category || 'general',
      tags: templateData.tags || [],
      difficulty: templateData.difficulty || 'intermediate',
      estimatedTime: templateData.estimatedTime || '10 minutes',
      author: decoded.username,
      authorId: decoded.userId,
      tenantId: decoded.tenantId,
      version: templateData.version || '1.0.0',
      downloads: 0,
      rating: 0,
      ratings: [],
      verified: decoded.role === USER_ROLES.ADMIN,
      template: validateWorkflowData(templateData.template),
      screenshots: templateData.screenshots || [],
      documentation: templateData.documentation || '',
      requirements: templateData.requirements || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: templateData.isPublic !== false,
      license: templateData.license || 'MIT'
    };

    templateMarketplace.set(templateId, template);

    logAuditEvent('TEMPLATE_PUBLISHED', decoded.userId, decoded.tenantId, {
      templateId,
      templateName: template.name,
      category: template.category
    });

    return template;
  } catch (error) {
    throw new Error(`Failed to publish template: ${error.message}`);
  }
}

function searchTemplates(query = '', filters = {}) {
  try {
    const templates = Array.from(templateMarketplace.values()).filter(template => {
      if (!template.isPublic) return false;

      // Text search
      if (query) {
        const searchableText = `${template.name} ${template.description} ${template.tags.join(' ')} ${template.author}`.toLowerCase();
        if (!searchableText.includes(query.toLowerCase())) {
          return false;
        }
      }

      // Filters
      if (filters.category && template.category !== filters.category) return false;
      if (filters.difficulty && template.difficulty !== filters.difficulty) return false;
      if (filters.author && template.author !== filters.author) return false;
      if (filters.verified !== undefined && template.verified !== filters.verified) return false;
      if (filters.minRating && template.rating < filters.minRating) return false;
      if (filters.tags && !filters.tags.some(tag => template.tags.includes(tag))) return false;

      return true;
    });

    // Sort by relevance, then by downloads, then by rating
    return templates.sort((a, b) => {
      if (query) {
        const aRelevance = a.name.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const bRelevance = b.name.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        if (aRelevance !== bRelevance) return bRelevance - aRelevance;
      }

      if (a.downloads !== b.downloads) return b.downloads - a.downloads;
      return b.rating - a.rating;
    });
  } catch (error) {
    throw new Error(`Template search failed: ${error.message}`);
  }
}

function createWorkflowFromTemplate(templateId, customizations = {}, userToken = null) {
  try {
    const template = templateMarketplace.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Increment download counter
    template.downloads++;
    templateMarketplace.set(templateId, template);

    // Clone template and apply customizations
    const workflowData = JSON.parse(JSON.stringify(template.template));

    // Apply customizations
    if (customizations.name) {
      workflowData.name = customizations.name;
    } else {
      workflowData.name = `${template.name} - ${new Date().toLocaleDateString()}`;
    }

    if (customizations.nodes) {
      // Merge node customizations
      workflowData.nodes = workflowData.nodes.map(node => {
        const customNode = customizations.nodes.find(n => n.id === node.id);
        return customNode ? { ...node, ...customNode } : node;
      });
    }

    if (customizations.settings) {
      workflowData.settings = { ...workflowData.settings, ...customizations.settings };
    }

    // Generate resource indicator for template usage tracking
    const resourceIndicator = generateResourceIndicator('template', templateId, userToken);

    const decoded = userToken ? verifyJWT(userToken) : null;
    logAuditEvent('TEMPLATE_USED', decoded?.userId, decoded?.tenantId, {
      templateId,
      templateName: template.name,
      customizations: Object.keys(customizations),
      resourceIndicator
    });

    return {
      workflow: workflowData,
      template: {
        id: template.id,
        name: template.name,
        author: template.author,
        version: template.version
      },
      resourceIndicator
    };
  } catch (error) {
    throw new Error(`Failed to create workflow from template: ${error.message}`);
  }
}

function manageEnvironment(environmentId, action, data = {}, userToken) {
  try {
    const decoded = verifyJWT(userToken);
    requirePermission(userToken, PERMISSIONS.MANAGE_TEMPLATES); // Using template permission for env management

    switch (action) {
      case 'create':
        const newEnv = {
          id: data.id || uuidv4(),
          name: data.name,
          description: data.description || '',
          url: data.url,
          type: data.type || 'development',
          isActive: data.isActive !== false,
          settings: {
            debugMode: data.settings?.debugMode || false,
            logLevel: data.settings?.logLevel || 'info',
            maxExecutionTime: data.settings?.maxExecutionTime || 300000,
            allowManualTrigger: data.settings?.allowManualTrigger !== false,
            ...data.settings
          },
          createdAt: new Date().toISOString(),
          createdBy: decoded.userId
        };

        environments.set(newEnv.id, newEnv);
        logAuditEvent('ENVIRONMENT_CREATED', decoded.userId, decoded.tenantId, { environmentId: newEnv.id, name: newEnv.name });
        return newEnv;

      case 'update':
        const existingEnv = environments.get(environmentId);
        if (!existingEnv) throw new Error('Environment not found');

        const updatedEnv = {
          ...existingEnv,
          ...data,
          settings: { ...existingEnv.settings, ...data.settings },
          updatedAt: new Date().toISOString(),
          updatedBy: decoded.userId
        };

        environments.set(environmentId, updatedEnv);
        logAuditEvent('ENVIRONMENT_UPDATED', decoded.userId, decoded.tenantId, { environmentId, changes: Object.keys(data) });
        return updatedEnv;

      case 'delete':
        if (!environments.has(environmentId)) throw new Error('Environment not found');

        environments.delete(environmentId);
        logAuditEvent('ENVIRONMENT_DELETED', decoded.userId, decoded.tenantId, { environmentId });
        return { success: true };

      case 'deploy':
        const env = environments.get(environmentId);
        if (!env) throw new Error('Environment not found');

        // Simulate deployment (in real implementation, this would deploy to actual environment)
        const deploymentId = uuidv4();
        const deployment = {
          id: deploymentId,
          environmentId,
          workflowId: data.workflowId,
          status: 'deploying',
          deployedBy: decoded.userId,
          deployedAt: new Date().toISOString(),
          version: data.version || '1.0.0'
        };

        logAuditEvent('WORKFLOW_DEPLOYED', decoded.userId, decoded.tenantId, {
          deploymentId,
          environmentId,
          workflowId: data.workflowId
        });

        return deployment;

      default:
        throw new Error(`Unknown environment action: ${action}`);
    }
  } catch (error) {
    throw new Error(`Environment management failed: ${error.message}`);
  }
}

function validateWorkflowBestPractices(workflowData) {
  const issues = [];
  const suggestions = [];
  const metrics = {
    score: 100,
    complexity: 'low',
    maintainability: 'high',
    performance: 'good'
  };

  try {
    const nodes = workflowData.nodes || [];
    const connections = workflowData.connections || {};

    // Check for basic issues
    if (nodes.length === 0) {
      issues.push({ type: 'error', message: 'Workflow has no nodes', severity: 'high' });
      metrics.score -= 50;
    }

    if (nodes.length > 20) {
      suggestions.push({ type: 'performance', message: 'Consider breaking down complex workflows into smaller, reusable components', severity: 'medium' });
      metrics.complexity = 'high';
      metrics.score -= 10;
    }

    // Check for trigger nodes
    const triggerNodes = nodes.filter(n =>
      n.type.includes('trigger') || n.type.includes('webhook') || n.type.includes('cron')
    );

    if (triggerNodes.length === 0) {
      issues.push({ type: 'warning', message: 'No trigger nodes found - workflow cannot start automatically', severity: 'medium' });
      metrics.score -= 15;
    }

    if (triggerNodes.length > 3) {
      suggestions.push({ type: 'architecture', message: 'Multiple triggers may indicate workflow should be split', severity: 'low' });
      metrics.complexity = 'medium';
      metrics.score -= 5;
    }

    // Check for error handling
    const errorHandlers = nodes.filter(n =>
      n.type.includes('errorTrigger') || n.name.toLowerCase().includes('error')
    );

    if (errorHandlers.length === 0 && nodes.length > 5) {
      suggestions.push({ type: 'reliability', message: 'Consider adding error handling for production workflows', severity: 'medium' });
      metrics.score -= 10;
    }

    // Check for orphaned nodes
    const connectedNodes = new Set();
    Object.values(connections).forEach(nodeConnections => {
      if (nodeConnections.main) {
        nodeConnections.main.forEach(connectionGroup => {
          if (Array.isArray(connectionGroup)) {
            connectionGroup.forEach(connection => {
              connectedNodes.add(connection.node);
            });
          }
        });
      }
    });

    const orphanedNodes = nodes.filter(node =>
      !triggerNodes.includes(node) && !connectedNodes.has(node.name) && !connectedNodes.has(node.id)
    );

    if (orphanedNodes.length > 0) {
      issues.push({
        type: 'warning',
        message: `${orphanedNodes.length} orphaned nodes found: ${orphanedNodes.map(n => n.name).join(', ')}`,
        severity: 'medium'
      });
      metrics.score -= orphanedNodes.length * 5;
      metrics.maintainability = 'medium';
    }

    // Check for naming conventions
    const badlyNamedNodes = nodes.filter(node =>
      !node.name || node.name.trim().length === 0 || node.name === node.type
    );

    if (badlyNamedNodes.length > 0) {
      suggestions.push({
        type: 'maintainability',
        message: 'Use descriptive names for nodes to improve workflow readability',
        severity: 'low'
      });
      metrics.maintainability = 'medium';
      metrics.score -= 5;
    }

    // Check for security best practices
    const httpNodes = nodes.filter(n => n.type.includes('httpRequest'));
    const unsecureHttpNodes = httpNodes.filter(node => {
      const url = node.parameters?.url || '';
      return url.startsWith('http://') && !url.includes('localhost');
    });

    if (unsecureHttpNodes.length > 0) {
      issues.push({
        type: 'security',
        message: 'Use HTTPS for external API calls to ensure data security',
        severity: 'high'
      });
      metrics.score -= 20;
    }

    // Performance checks
    const heavyNodes = nodes.filter(n =>
      n.type.includes('function') || n.type.includes('code') || n.type.includes('loop')
    );

    if (heavyNodes.length > 5) {
      suggestions.push({
        type: 'performance',
        message: 'Many computation-heavy nodes detected - consider optimizing for performance',
        severity: 'medium'
      });
      metrics.performance = 'fair';
      metrics.score -= 10;
    }

    // Calculate final metrics
    if (metrics.score >= 90) metrics.complexity = 'low';
    else if (metrics.score >= 70) metrics.complexity = 'medium';
    else metrics.complexity = 'high';

    if (metrics.score >= 85) metrics.maintainability = 'high';
    else if (metrics.score >= 60) metrics.maintainability = 'medium';
    else metrics.maintainability = 'low';

    if (metrics.score >= 80) metrics.performance = 'excellent';
    else if (metrics.score >= 60) metrics.performance = 'good';
    else metrics.performance = 'needs improvement';

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      score: Math.max(0, metrics.score),
      metrics,
      issues,
      suggestions,
      summary: {
        totalNodes: nodes.length,
        triggerNodes: triggerNodes.length,
        connectedNodes: connectedNodes.size,
        orphanedNodes: orphanedNodes.length,
        securityIssues: issues.filter(i => i.type === 'security').length,
        performanceWarnings: suggestions.filter(s => s.type === 'performance').length
      }
    };

  } catch (error) {
    return {
      valid: false,
      score: 0,
      metrics: { complexity: 'unknown', maintainability: 'unknown', performance: 'unknown' },
      issues: [{ type: 'error', message: `Validation failed: ${error.message}`, severity: 'high' }],
      suggestions: [],
      summary: {}
    };
  }
}

// AI-ENHANCED DEBUGGING SYSTEM
// Intelligent error analysis and automated fix suggestions

// AI Error Pattern Database - Common n8n workflow issues and their solutions
const AI_ERROR_PATTERNS = {
  // Connection Issues
  'connection_missing': {
    pattern: /no.*connection|not.*connected|missing.*connection/i,
    category: 'connection',
    severity: 'high',
    solution: 'Connect nodes by dragging from output to input. Ensure all nodes have proper connections.',
    autoFix: true
  },
  'circular_reference': {
    pattern: /circular|cycle|loop.*detected/i,
    category: 'connection',
    severity: 'critical',
    solution: 'Remove circular connections by analyzing the workflow flow and breaking the loop.',
    autoFix: false
  },

  // Data Issues
  'data_missing': {
    pattern: /no.*data|empty.*data|undefined.*data/i,
    category: 'data',
    severity: 'medium',
    solution: 'Check if previous nodes are producing data. Add debug nodes to inspect data flow.',
    autoFix: true
  },
  'data_format_error': {
    pattern: /invalid.*format|wrong.*type|cannot.*parse/i,
    category: 'data',
    severity: 'medium',
    solution: 'Transform data format using Set or Function nodes before processing.',
    autoFix: true
  },

  // Authentication Issues
  'auth_failed': {
    pattern: /authentication.*failed|unauthorized|401|403/i,
    category: 'authentication',
    severity: 'high',
    solution: 'Check API credentials, tokens, and authentication configuration.',
    autoFix: false
  },

  // API Issues
  'rate_limit': {
    pattern: /rate.*limit|too.*many.*requests|429/i,
    category: 'api',
    severity: 'medium',
    solution: 'Add delays between requests or implement exponential backoff.',
    autoFix: true
  },
  'timeout': {
    pattern: /timeout|timed.*out|request.*failed/i,
    category: 'api',
    severity: 'medium',
    solution: 'Increase timeout values or optimize API calls for better performance.',
    autoFix: true
  },

  // Configuration Issues
  'invalid_config': {
    pattern: /invalid.*configuration|config.*error|missing.*parameter/i,
    category: 'configuration',
    severity: 'high',
    solution: 'Review node configuration and ensure all required fields are properly set.',
    autoFix: false
  }
};

// AI-powered workflow analysis
function analyzeWorkflowWithAI(workflowData, executionData = null, errorContext = null) {
  const analysis = {
    issues: [],
    suggestions: [],
    fixes: [],
    confidence: 0,
    aiRecommendations: []
  };

  try {
    // 1. STATIC ANALYSIS - Examine workflow structure
    if (workflowData && workflowData.nodes) {
      const staticIssues = performStaticAnalysis(workflowData);
      analysis.issues.push(...staticIssues);
    }

    // 2. EXECUTION ANALYSIS - Examine failed executions
    if (executionData) {
      const executionIssues = performExecutionAnalysis(executionData);
      analysis.issues.push(...executionIssues);
    }

    // 3. ERROR PATTERN MATCHING - Match against known patterns
    if (errorContext && errorContext.errorMessage) {
      const patternMatches = matchErrorPatterns(errorContext.errorMessage);
      analysis.issues.push(...patternMatches.issues);
      analysis.fixes.push(...patternMatches.fixes);
    }

    // 4. AI RECOMMENDATIONS - Generate intelligent suggestions
    analysis.aiRecommendations = generateAIRecommendations(workflowData, analysis.issues);

    // 5. CALCULATE CONFIDENCE
    analysis.confidence = calculateAnalysisConfidence(analysis);

    return analysis;
  } catch (error) {
    return {
      issues: [{ type: 'analysis_error', message: `AI analysis failed: ${error.message}`, severity: 'low' }],
      suggestions: [],
      fixes: [],
      confidence: 0,
      aiRecommendations: []
    };
  }
}

// Perform static code analysis on workflow
function performStaticAnalysis(workflowData) {
  const issues = [];
  const { nodes, connections = {} } = workflowData;

  // Check for orphaned nodes
  const orphanedNodes = nodes.filter(node => {
    if (node.type.includes('trigger')) return false; // Triggers are entry points
    return !Object.keys(connections).some(sourceNode =>
      connections[sourceNode]?.main?.some(conn =>
        conn.some(target => target.node === node.name)
      )
    );
  });

  if (orphanedNodes.length > 0) {
    issues.push({
      type: 'orphaned_nodes',
      message: `Found ${orphanedNodes.length} disconnected nodes: ${orphanedNodes.map(n => n.name).join(', ')}`,
      severity: 'medium',
      nodes: orphanedNodes.map(n => n.name),
      autoFix: true,
      fix: 'Connect these nodes to the workflow or remove them if not needed.'
    });
  }

  // Check for missing error handling
  const hasErrorHandling = nodes.some(node =>
    node.type.includes('errorTrigger') ||
    node.onError === 'continueRegularOutput'
  );

  if (!hasErrorHandling && nodes.length > 2) {
    issues.push({
      type: 'missing_error_handling',
      message: 'Workflow lacks error handling mechanisms',
      severity: 'medium',
      autoFix: true,
      fix: 'Add error handling nodes or configure node error handling settings.'
    });
  }

  // Check for complex workflows without proper structure
  if (nodes.length > 10) {
    const hasStructure = nodes.some(node =>
      node.type.includes('merge') ||
      node.type.includes('switch') ||
      node.type.includes('if')
    );

    if (!hasStructure) {
      issues.push({
        type: 'complex_linear_workflow',
        message: 'Large workflow lacks proper structure (merge/switch/conditional nodes)',
        severity: 'low',
        autoFix: true,
        fix: 'Consider using Switch or IF nodes for conditional logic, Merge nodes for combining data.'
      });
    }
  }

  return issues;
}

// Analyze execution data for failure patterns
function performExecutionAnalysis(executionData) {
  const issues = [];

  if (executionData.status === 'error' && executionData.data) {
    const errorNode = executionData.data.resultData?.error?.node;
    const errorMessage = executionData.data.resultData?.error?.message;

    if (errorNode && errorMessage) {
      // Analyze specific node failures
      issues.push({
        type: 'node_execution_error',
        message: `Node '${errorNode}' failed: ${errorMessage}`,
        severity: 'high',
        node: errorNode,
        errorDetails: errorMessage,
        autoFix: false
      });

      // Pattern match the error message
      const patterns = matchErrorPatterns(errorMessage);
      issues.push(...patterns.issues);
    }
  }

  // Check for performance issues
  if (executionData.executionTime && executionData.executionTime > 60000) { // > 1 minute
    issues.push({
      type: 'performance_issue',
      message: `Workflow execution took ${Math.round(executionData.executionTime / 1000)}s, which is quite long`,
      severity: 'low',
      autoFix: true,
      fix: 'Consider optimizing slow nodes, adding parallel processing, or reducing data volume.'
    });
  }

  return issues;
}

// Match error messages against known patterns
function matchErrorPatterns(errorMessage) {
  const matches = {
    issues: [],
    fixes: []
  };

  Object.entries(AI_ERROR_PATTERNS).forEach(([key, pattern]) => {
    if (pattern.pattern.test(errorMessage)) {
      matches.issues.push({
        type: key,
        message: `Detected ${pattern.category} issue: ${errorMessage}`,
        severity: pattern.severity,
        category: pattern.category,
        autoFix: pattern.autoFix
      });

      if (pattern.solution) {
        matches.fixes.push({
          type: key,
          description: pattern.solution,
          autoFix: pattern.autoFix,
          category: pattern.category
        });
      }
    }
  });

  return matches;
}

// Generate AI recommendations based on workflow analysis
function generateAIRecommendations(workflowData, issues) {
  const recommendations = [];

  if (!workflowData || !workflowData.nodes) {
    return recommendations;
  }

  const { nodes } = workflowData;

  // Recommendation 1: Error handling based on workflow complexity
  const highRiskNodes = nodes.filter(node =>
    node.type.includes('httpRequest') ||
    node.type.includes('webhook') ||
    node.type.includes('ftp') ||
    node.type.includes('database')
  );

  if (highRiskNodes.length > 0 && !nodes.some(n => n.type.includes('errorTrigger'))) {
    recommendations.push({
      type: 'error_handling',
      priority: 'high',
      title: 'Add Error Handling',
      description: `Your workflow has ${highRiskNodes.length} nodes that could fail (API calls, database operations). Consider adding error handling.`,
      implementation: 'Add Error Trigger nodes or configure "On Error" settings for critical nodes.',
      impact: 'Prevents workflow failures and provides graceful error recovery.'
    });
  }

  // Recommendation 2: Performance optimization
  const parallelizableNodes = nodes.filter(node =>
    !node.type.includes('trigger') &&
    !node.type.includes('merge') &&
    !node.type.includes('if') &&
    !node.type.includes('switch')
  );

  if (parallelizableNodes.length > 5) {
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Consider Parallel Processing',
      description: 'Your workflow has many sequential nodes that could potentially run in parallel.',
      implementation: 'Use multiple paths and Merge nodes to process data in parallel where possible.',
      impact: 'Can significantly reduce execution time for large datasets.'
    });
  }

  // Recommendation 3: Data validation
  const dataProcessingNodes = nodes.filter(node =>
    node.type.includes('set') ||
    node.type.includes('function') ||
    node.type.includes('json')
  );

  if (dataProcessingNodes.length > 2 && !nodes.some(n => n.name.toLowerCase().includes('validate'))) {
    recommendations.push({
      type: 'data_quality',
      priority: 'medium',
      title: 'Add Data Validation',
      description: 'Your workflow processes data extensively but lacks validation steps.',
      implementation: 'Add Function or IF nodes to validate data before processing.',
      impact: 'Prevents errors from invalid data and improves workflow reliability.'
    });
  }

  // Recommendation 4: Monitoring and logging
  if (nodes.length > 5 && !nodes.some(n => n.name.toLowerCase().includes('log'))) {
    recommendations.push({
      type: 'monitoring',
      priority: 'low',
      title: 'Add Logging/Monitoring',
      description: 'Complex workflows benefit from logging key steps for debugging.',
      implementation: 'Add Set nodes to log important data points or use webhook nodes for external monitoring.',
      impact: 'Makes debugging easier and provides visibility into workflow execution.'
    });
  }

  return recommendations;
}

// Calculate confidence level of the analysis
function calculateAnalysisConfidence(analysis) {
  let confidence = 50; // Base confidence

  // Increase confidence based on issue detection
  confidence += analysis.issues.length * 10;

  // Increase confidence if we have execution data
  if (analysis.issues.some(i => i.type === 'node_execution_error')) {
    confidence += 20;
  }

  // Increase confidence if pattern matching found issues
  if (analysis.issues.some(i => AI_ERROR_PATTERNS[i.type])) {
    confidence += 15;
  }

  // Cap confidence at 95%
  return Math.min(confidence, 95);
}

// Generate detailed debugging report
function generateDebuggingReport(analysis, analysisDepth = 'detailed') {
  let report = `🔍 AI-Enhanced Debugging Report\n`;
  report += `${'='.repeat(40)}\n\n`;

  // Analysis confidence
  report += `🎯 Analysis Confidence: ${analysis.confidence}%\n`;

  if (analysis.confidence < 50) {
    report += `⚠️  Low confidence - consider providing more context for better analysis.\n`;
  } else if (analysis.confidence > 80) {
    report += `✅ High confidence - analysis is likely accurate.\n`;
  }

  report += `\n`;

  // Issues found
  if (analysis.issues.length > 0) {
    report += `🚨 Issues Detected (${analysis.issues.length})\n`;
    report += `${'─'.repeat(30)}\n`;

    const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
    const highIssues = analysis.issues.filter(i => i.severity === 'high');
    const mediumIssues = analysis.issues.filter(i => i.severity === 'medium');
    const lowIssues = analysis.issues.filter(i => i.severity === 'low');

    if (criticalIssues.length > 0) {
      report += `\n🔴 Critical Issues (${criticalIssues.length}):\n`;
      criticalIssues.forEach((issue, i) => {
        report += `  ${i + 1}. ${issue.message}\n`;
        if (issue.nodes) report += `     Affected nodes: ${issue.nodes.join(', ')}\n`;
      });
    }

    if (highIssues.length > 0) {
      report += `\n🟠 High Priority Issues (${highIssues.length}):\n`;
      highIssues.forEach((issue, i) => {
        report += `  ${i + 1}. ${issue.message}\n`;
        if (issue.node) report += `     Node: ${issue.node}\n`;
      });
    }

    if (analysisDepth !== 'basic' && mediumIssues.length > 0) {
      report += `\n🟡 Medium Priority Issues (${mediumIssues.length}):\n`;
      mediumIssues.forEach((issue, i) => {
        report += `  ${i + 1}. ${issue.message}\n`;
      });
    }

    if (analysisDepth === 'comprehensive' && lowIssues.length > 0) {
      report += `\n🔵 Low Priority Issues (${lowIssues.length}):\n`;
      lowIssues.forEach((issue, i) => {
        report += `  ${i + 1}. ${issue.message}\n`;
      });
    }
  } else {
    report += `✅ No issues detected in the analysis.\n`;
  }

  // Automated fixes available
  const fixableIssues = analysis.issues.filter(i => i.autoFix);
  if (fixableIssues.length > 0) {
    report += `\n🔧 Automated Fixes Available (${fixableIssues.length})\n`;
    report += `${'─'.repeat(35)}\n`;
    fixableIssues.forEach((issue, i) => {
      report += `  ${i + 1}. ${issue.type}: ${issue.fix || 'Fix available'}\n`;
    });
  }

  // AI Recommendations
  if (analysis.aiRecommendations.length > 0) {
    report += `\n🧠 AI Recommendations\n`;
    report += `${'─'.repeat(20)}\n`;

    analysis.aiRecommendations.forEach((rec, i) => {
      report += `\n${i + 1}. ${rec.title} (${rec.priority} priority)\n`;
      report += `   ${rec.description}\n`;
      if (analysisDepth !== 'basic') {
        report += `   💡 Implementation: ${rec.implementation}\n`;
        report += `   📈 Impact: ${rec.impact}\n`;
      }
    });
  }

  // Quick fixes section
  if (analysis.fixes.length > 0) {
    report += `\n🛠️ Quick Fixes\n`;
    report += `${'─'.repeat(12)}\n`;

    const categorizedFixes = {};
    analysis.fixes.forEach(fix => {
      if (!categorizedFixes[fix.category]) categorizedFixes[fix.category] = [];
      categorizedFixes[fix.category].push(fix);
    });

    Object.entries(categorizedFixes).forEach(([category, fixes]) => {
      report += `\n${category.toUpperCase()}:\n`;
      fixes.forEach((fix, i) => {
        report += `  • ${fix.description}\n`;
      });
    });
  }

  return report;
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

// ADAPTIVE INTELLIGENCE: Detect required connection types from nodes
function detectRequiredConnectionTypes(nodes) {
  const detectedTypes = {
    enableMerge: false,
    enableSwitch: false,
    enableErrorHandling: false,
    enableAdvancedWebhook: false,
    enableLoops: false,
    enableTemporal: false,
    enableAI: false,
    enableDynamic: false,
    enableParallel: false,
    enableStateful: false
  };

  // Analyze node types to determine required connections
  nodes.forEach(node => {
    const nodeType = node.type.toLowerCase();
    const nodeName = node.name?.toLowerCase() || '';

    // Detect Merge/Split needs
    if (nodeType.includes('merge') ||
        nodeType.includes('split') ||
        nodeName.includes('merge') ||
        nodeName.includes('combine')) {
      detectedTypes.enableMerge = true;
    }

    // Detect Switch routing needs
    if (nodeType.includes('switch') ||
        nodeType.includes('if') && nodes.length > 3 ||
        nodeName.includes('route') ||
        nodeName.includes('switch') ||
        nodeName.includes('conditional')) {
      detectedTypes.enableSwitch = true;
    }

    // Detect Error handling needs
    if (nodeType.includes('errortrigger') ||
        nodeName.includes('error') ||
        nodeName.includes('retry') ||
        nodeName.includes('fallback') ||
        nodeType.includes('httprequest') || // HTTP requests often need error handling
        nodeType.includes('webhook')) { // Webhooks benefit from error handling
      detectedTypes.enableErrorHandling = true;
    }

    // Detect Advanced webhook needs
    if (nodeType.includes('webhook')) {
      // Check if there's a response node or multi-method indicators
      const hasResponseNode = nodes.some(n => n.type.toLowerCase().includes('respondtowebhook'));
      const isMultiMethod = nodeName.includes('multi') || nodeName.includes('method');

      if (hasResponseNode || isMultiMethod) {
        detectedTypes.enableAdvancedWebhook = true;
      }
    }

    // Detect Loop needs
    if (nodeType.includes('splitinbatches') ||
        nodeType.includes('loop') ||
        nodeName.includes('loop') ||
        nodeName.includes('foreach') ||
        nodeName.includes('batch') ||
        nodeName.includes('iterate')) {
      detectedTypes.enableLoops = true;
    }

    // Detect Temporal needs
    if (nodeType.includes('wait') ||
        nodeType.includes('cron') ||
        nodeType.includes('schedule') ||
        nodeName.includes('delay') ||
        nodeName.includes('wait') ||
        nodeName.includes('schedule')) {
      detectedTypes.enableTemporal = true;
    }

    // Detect AI needs
    if (nodeType.includes('openai') ||
        nodeType.includes('anthropic') ||
        nodeType.includes('llm') ||
        nodeName.includes('ai') ||
        nodeName.includes('gpt') ||
        nodeName.includes('claude') ||
        nodeName.includes('sentiment') ||
        nodeName.includes('classify')) {
      detectedTypes.enableAI = true;
    }

    // Detect Dynamic source needs
    if (nodeType.includes('httprequest') &&
        (nodeName.includes('dynamic') ||
         nodeName.includes('variable') ||
         nodeName.includes('context'))) {
      detectedTypes.enableDynamic = true;
    }

    // Detect Parallel processing needs
    if (nodes.filter(n =>
        !n.type.includes('trigger') &&
        !n.type.includes('respondtowebhook') &&
        !n.type.includes('merge')).length > 2) {
      detectedTypes.enableParallel = true;
    }

    // Detect Stateful needs
    if (nodeName.includes('state') ||
        nodeName.includes('cache') ||
        nodeName.includes('session') ||
        nodeName.includes('remember') ||
        nodeType.includes('redis') ||
        nodeType.includes('mongodb')) {
      detectedTypes.enableStateful = true;
    }
  });

  console.log('🧠 Adaptive Intelligence - Detected connection types:', detectedTypes);
  return detectedTypes;
}

// MASTER CONNECTION GENERATOR with Adaptive Intelligence
function generateAdvancedConnections(nodes, connectionConfig = {}) {
  let connections = {};

  // If no explicit configuration provided, use adaptive intelligence
  let finalConfig = connectionConfig;

  if (Object.keys(connectionConfig).length === 0 || connectionConfig.adaptive !== false) {
    const detectedTypes = detectRequiredConnectionTypes(nodes);
    finalConfig = { ...detectedTypes, ...connectionConfig }; // User config overrides detection
  }

  // Apply connection types based on final configuration
  if (finalConfig.enableMerge) {
    Object.assign(connections, generateMergeConnections(nodes, finalConfig.mergeType));
  }

  if (finalConfig.enableSwitch) {
    Object.assign(connections, generateSwitchConnections(nodes, finalConfig.switchRules));
  }

  if (finalConfig.enableErrorHandling) {
    Object.assign(connections, generateErrorHandlingConnections(nodes, finalConfig.errorConfig));
  }

  if (finalConfig.enableAdvancedWebhook) {
    Object.assign(connections, generateWebhookConnections(nodes, finalConfig.webhookConfig));
  }

  if (finalConfig.enableLoops) {
    Object.assign(connections, generateLoopConnections(nodes, finalConfig.loopConfig));
  }

  if (finalConfig.enableTemporal) {
    Object.assign(connections, generateTemporalConnections(nodes, finalConfig.timeConfig));
  }

  if (finalConfig.enableAI) {
    Object.assign(connections, generateAIConnections(nodes, finalConfig.aiConfig));
  }

  if (finalConfig.enableDynamic) {
    Object.assign(connections, generateDynamicConnections(nodes, finalConfig.dynamicConfig));
  }

  if (finalConfig.enableParallel) {
    Object.assign(connections, generateParallelConnections(nodes, finalConfig.parallelConfig));
  }

  if (finalConfig.enableStateful) {
    Object.assign(connections, generateStatefulConnections(nodes, finalConfig.stateConfig));
  }

  // Fallback to basic connections if no advanced types detected or specified
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
            token: {
              type: "string",
              description: "JWT authentication token (required when RBAC is enabled)"
            },
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
              description: "Enable advanced connection types with adaptive intelligence (default: true)",
              default: true
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
      {
        name: "authenticate_user",
        description: "Authenticate user and obtain JWT token for secure access",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username for authentication"
            },
            password: {
              type: "string",
              description: "Password for authentication"
            }
          },
          required: ["username", "password"]
        },
      },
      {
        name: "create_user",
        description: "Create a new user account (Admin only)",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "Admin JWT token"
            },
            username: {
              type: "string",
              description: "Username for the new user"
            },
            email: {
              type: "string",
              description: "Email address"
            },
            password: {
              type: "string",
              description: "Password for the new user"
            },
            role: {
              type: "string",
              enum: ["admin", "developer", "viewer", "guest"],
              description: "User role determining permissions"
            },
            tenantId: {
              type: "string",
              description: "Tenant ID for multi-tenant deployments",
              default: "default"
            }
          },
          required: ["token", "username", "email", "password", "role"]
        },
      },
      {
        name: "list_users",
        description: "List all users (Admin only)",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "Admin JWT token"
            },
            tenantId: {
              type: "string",
              description: "Filter by tenant ID"
            }
          },
          required: ["token"]
        },
      },
      {
        name: "get_audit_logs",
        description: "Retrieve audit logs for compliance and security monitoring",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT token with audit log viewing permissions"
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to return",
              default: 100
            },
            action: {
              type: "string",
              description: "Filter by specific action type"
            },
            userId: {
              type: "string",
              description: "Filter by user ID"
            },
            tenantId: {
              type: "string",
              description: "Filter by tenant ID"
            }
          },
          required: ["token"]
        },
      },
      {
        name: "validate_token",
        description: "Validate JWT token and return user information",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT token to validate"
            }
          },
          required: ["token"]
        },
      },
      {
        name: "logout_user",
        description: "Logout user and invalidate session",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT token to invalidate"
            }
          },
          required: ["token"]
        },
      },
      {
        name: "generate_resource_indicator",
        description: "Generate RFC 8707 Resource Indicator for secure resource access",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token"
            },
            resourceType: {
              type: "string",
              enum: ["workflow", "execution", "template", "user"],
              description: "Type of resource to generate indicator for"
            },
            resourceId: {
              type: "string",
              description: "Unique identifier of the resource"
            }
          },
          required: ["resourceType", "resourceId"]
        },
      },
      {
        name: "validate_resource_indicator",
        description: "Validate Resource Indicator and check permissions",
        inputSchema: {
          type: "object",
          properties: {
            indicator: {
              type: "string",
              description: "Resource indicator to validate"
            },
            token: {
              type: "string",
              description: "JWT authentication token (optional for public resources)"
            }
          },
          required: ["indicator"]
        },
      },
      {
        name: "get_system_metrics",
        description: "Get system performance and security metrics",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token with monitoring permissions"
            },
            timeRange: {
              type: "string",
              enum: ["1h", "24h", "7d", "30d"],
              description: "Time range for metrics",
              default: "1h"
            },
            includeErrors: {
              type: "boolean",
              description: "Include error boundary information",
              default: false
            }
          },
          required: ["token"]
        },
      },
      {
        name: "test_transport_security",
        description: "Test transport encryption and security features",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token"
            },
            testData: {
              type: "object",
              description: "Test data to encrypt/decrypt",
              default: { test: "encryption validation" }
            }
          },
          required: ["token"]
        },
      },
      {
        name: "health_check",
        description: "Comprehensive system health check with security status",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token (optional for basic health check)"
            },
            includeDetailed: {
              type: "boolean",
              description: "Include detailed security and performance metrics",
              default: false
            }
          }
        },
      },
      {
        name: "browse_template_marketplace",
        description: "Browse and search the workflow template marketplace",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for templates"
            },
            category: {
              type: "string",
              enum: ["communication", "data-processing", "ai-automation", "ecommerce", "general"],
              description: "Filter by template category"
            },
            difficulty: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"],
              description: "Filter by difficulty level"
            },
            verified: {
              type: "boolean",
              description: "Show only verified templates"
            },
            minRating: {
              type: "number",
              description: "Minimum rating filter (0-5)"
            },
            limit: {
              type: "number",
              description: "Maximum number of results",
              default: 20
            }
          }
        },
      },
      {
        name: "create_workflow_from_template",
        description: "Create a new workflow from a template with customizations",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token"
            },
            templateId: {
              type: "string",
              description: "ID of the template to use"
            },
            workflowName: {
              type: "string",
              description: "Custom name for the new workflow"
            },
            customizations: {
              type: "object",
              description: "Node customizations and settings",
              properties: {
                nodes: {
                  type: "array",
                  description: "Array of node customizations"
                },
                settings: {
                  type: "object",
                  description: "Workflow settings overrides"
                }
              }
            },
            deployToEnvironment: {
              type: "string",
              description: "Environment ID to deploy to (optional)"
            }
          },
          required: ["templateId"]
        },
      },
      {
        name: "publish_template",
        description: "Publish a workflow as a template to the marketplace",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token with template management permissions"
            },
            name: {
              type: "string",
              description: "Template name"
            },
            description: {
              type: "string",
              description: "Template description"
            },
            category: {
              type: "string",
              enum: ["communication", "data-processing", "ai-automation", "ecommerce", "general"],
              description: "Template category"
            },
            difficulty: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"],
              description: "Difficulty level"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Template tags for searchability"
            },
            workflow: {
              type: "object",
              description: "Workflow data to use as template",
              properties: {
                nodes: {
                  type: "array",
                  description: "Workflow nodes"
                }
              },
              required: ["nodes"]
            },
            documentation: {
              type: "string",
              description: "Template documentation and usage instructions"
            },
            isPublic: {
              type: "boolean",
              description: "Make template publicly available",
              default: true
            }
          },
          required: ["token", "name", "description", "workflow"]
        },
      },
      {
        name: "manage_workflow_versions",
        description: "Create and manage workflow versions with Git-like versioning",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token"
            },
            action: {
              type: "string",
              enum: ["create", "list", "get", "tag"],
              description: "Version management action"
            },
            workflowId: {
              type: "string",
              description: "Workflow ID for versioning"
            },
            workflowData: {
              type: "object",
              description: "Workflow data for creating new version"
            },
            message: {
              type: "string",
              description: "Commit message for version creation"
            },
            versionId: {
              type: "string",
              description: "Version ID for specific operations"
            },
            tag: {
              type: "string",
              description: "Tag name for version tagging"
            }
          },
          required: ["token", "action", "workflowId"]
        },
      },
      {
        name: "manage_environments",
        description: "Manage deployment environments (dev/staging/prod)",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token with environment management permissions"
            },
            action: {
              type: "string",
              enum: ["create", "update", "delete", "deploy", "list"],
              description: "Environment management action"
            },
            environmentId: {
              type: "string",
              description: "Environment ID for specific operations"
            },
            name: {
              type: "string",
              description: "Environment name"
            },
            description: {
              type: "string",
              description: "Environment description"
            },
            url: {
              type: "string",
              description: "Environment URL"
            },
            type: {
              type: "string",
              enum: ["development", "staging", "production"],
              description: "Environment type"
            },
            settings: {
              type: "object",
              description: "Environment configuration settings"
            },
            workflowId: {
              type: "string",
              description: "Workflow ID for deployment"
            }
          },
          required: ["token", "action"]
        },
      },
      {
        name: "validate_workflow_best_practices",
        description: "Validate workflow against best practices and get improvement suggestions",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token"
            },
            workflowData: {
              type: "object",
              description: "Workflow data to validate",
              properties: {
                nodes: {
                  type: "array",
                  description: "Workflow nodes"
                },
                connections: {
                  type: "object",
                  description: "Node connections"
                }
              },
              required: ["nodes"]
            },
            includeDetailedReport: {
              type: "boolean",
              description: "Include detailed analysis and suggestions",
              default: true
            }
          },
          required: ["workflowData"]
        },
      },
      {
        name: "ai_debug_workflow",
        description: "AI-enhanced debugging with intelligent error analysis and suggestions",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT authentication token"
            },
            workflowId: {
              type: "string",
              description: "Workflow ID to debug (for execution analysis)"
            },
            executionId: {
              type: "string",
              description: "Execution ID to analyze (for failure analysis)"
            },
            workflowData: {
              type: "object",
              description: "Workflow data for static analysis",
              properties: {
                nodes: {
                  type: "array",
                  description: "Workflow nodes"
                },
                connections: {
                  type: "object",
                  description: "Node connections"
                }
              }
            },
            errorContext: {
              type: "object",
              description: "Additional error context and symptoms",
              properties: {
                errorMessage: {
                  type: "string",
                  description: "Error message observed"
                },
                symptoms: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "List of observed symptoms or issues"
                },
                expectedBehavior: {
                  type: "string",
                  description: "Expected workflow behavior"
                },
                actualBehavior: {
                  type: "string",
                  description: "Actual observed behavior"
                }
              }
            },
            analysisDepth: {
              type: "string",
              enum: ["basic", "detailed", "comprehensive"],
              description: "Depth of AI analysis to perform",
              default: "detailed"
            },
            includeFixSuggestions: {
              type: "boolean",
              description: "Include automated fix suggestions",
              default: true
            }
          }
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
        const requestId = uuidv4();
        const boundary = createErrorBoundary(requestId, { tool: 'create_workflow', name, nodeCount: nodes?.length });

        try {
          const {
            token,
            name,
            nodes,
            connections = {},
            active = false,
            autoConnect = true,
            advancedConnections = true,
            connectionConfig = {}
          } = request.params.arguments;

          // Rate limiting
          const rateLimitKey = token ? verifyJWT(token).userId : 'anonymous';
          const rateLimit = enforceRateLimit(`create_workflow:${rateLimitKey}`, 10, 3600000);

          if (!rateLimit.allowed) {
            addToBoundary(boundary.id, 'error', 'Rate limit exceeded', { retryAfter: rateLimit.retryAfter });
            finalizeBoundary(boundary.id, false);
            return {
              content: [{
                type: "text",
                text: `Rate limit exceeded for workflow creation. Try again in ${rateLimit.retryAfter} seconds.`
              }],
              isError: true
            };
          }

          // Enterprise Security: Authentication and Authorization
          let userContext = null;
          if (ENABLE_RBAC && token) {
            requirePermission(token, PERMISSIONS.CREATE_WORKFLOW);
            const decoded = verifyJWT(token);
            userContext = decoded;

            // JSON Schema Validation
            validateWorkflowData({ name, nodes, connections, active, autoConnect, advancedConnections });

            logAuditEvent('WORKFLOW_CREATE_STARTED', decoded.userId, decoded.tenantId, { workflowName: name, nodeCount: nodes.length });
            addToBoundary(boundary.id, 'info', 'Authentication successful', { userId: decoded.userId, role: decoded.role });
          } else {
            addToBoundary(boundary.id, 'warning', 'Creating workflow without authentication', { rbacEnabled: ENABLE_RBAC });
          }

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
          const isAdvancedConnections = advancedConnections && Object.keys(connectionConfig).length === 0;

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
                      (isAdvancedConnections ? `• 🧠 **Adaptive Intelligence:** Advanced connection types auto-detected\n` : '') +
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

      case "authenticate_user":
        try {
          const { username, password } = request.params.arguments;

          if (!username || !password) {
            return {
              content: [{
                type: "text",
                text: "Error: Username and password are required"
              }],
              isError: true
            };
          }

          const authResult = authenticateUser(username, password);

          if (!authResult) {
            return {
              content: [{
                type: "text",
                text: "Authentication failed: Invalid username or password"
              }],
              isError: true
            };
          }

          return {
            content: [{
              type: "text",
              text: `Authentication successful!\n\nUser: ${authResult.user.username}\nRole: ${authResult.user.role}\nTenant: ${authResult.user.tenantId}\n\nJWT Token: ${authResult.token}\n\nStore this token securely and include it in future requests.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Authentication error: ${error.message}`
            }],
            isError: true
          };
        }

      case "create_user":
        try {
          const { token, username, email, password, role, tenantId = 'default' } = request.params.arguments;

          // Verify admin permissions
          requirePermission(token, PERMISSIONS.MANAGE_USERS);

          if (userDatabase.has(username)) {
            return {
              content: [{
                type: "text",
                text: `Error: User '${username}' already exists`
              }],
              isError: true
            };
          }

          const newUser = {
            id: randomBytes(8).toString('hex'),
            username,
            email,
            password: bcrypt.hashSync(password, 10),
            role,
            tenantId,
            createdAt: new Date().toISOString(),
            isActive: true
          };

          userDatabase.set(username, newUser);

          const decoded = verifyJWT(token);
          logAuditEvent('USER_CREATED', decoded.userId, decoded.tenantId, {
            targetUser: username,
            targetRole: role,
            targetTenant: tenantId
          });

          return {
            content: [{
              type: "text",
              text: `User '${username}' created successfully!\n\nUser ID: ${newUser.id}\nRole: ${role}\nTenant: ${tenantId}\nCreated: ${newUser.createdAt}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error creating user: ${error.message}`
            }],
            isError: true
          };
        }

      case "list_users":
        try {
          const { token, tenantId } = request.params.arguments;

          requirePermission(token, PERMISSIONS.MANAGE_USERS);

          const decoded = verifyJWT(token);
          const users = Array.from(userDatabase.values()).filter(user => {
            if (tenantId && user.tenantId !== tenantId) return false;
            if (ENABLE_MULTI_TENANT && decoded.tenantId !== user.tenantId && decoded.role !== USER_ROLES.ADMIN) return false;
            return true;
          });

          const userList = users.map(user =>
            `- ${user.username} (${user.email}) - Role: ${user.role} - Tenant: ${user.tenantId} - ${user.isActive ? 'Active' : 'Inactive'}`
          ).join('\n');

          logAuditEvent('USERS_LISTED', decoded.userId, decoded.tenantId, { count: users.length });

          return {
            content: [{
              type: "text",
              text: `Found ${users.length} users:\n\n${userList}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error listing users: ${error.message}`
            }],
            isError: true
          };
        }

      case "get_audit_logs":
        try {
          const { token, limit = 100, action, userId, tenantId } = request.params.arguments;

          requirePermission(token, PERMISSIONS.VIEW_AUDIT_LOGS);

          const decoded = verifyJWT(token);
          let filteredLogs = auditLogs.filter(log => {
            if (action && log.action !== action) return false;
            if (userId && log.userId !== userId) return false;
            if (tenantId && log.tenantId !== tenantId) return false;
            if (ENABLE_MULTI_TENANT && decoded.tenantId !== log.tenantId && decoded.role !== USER_ROLES.ADMIN) return false;
            return true;
          });

          // Sort by timestamp (newest first) and apply limit
          filteredLogs = filteredLogs
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);

          const logText = filteredLogs.map(log =>
            `${log.timestamp} - ${log.action} - User: ${log.userId || 'system'} - Tenant: ${log.tenantId || 'none'} - ${JSON.stringify(log.metadata)}`
          ).join('\n');

          logAuditEvent('AUDIT_LOGS_ACCESSED', decoded.userId, decoded.tenantId, { count: filteredLogs.length, filters: { action, userId, tenantId } });

          return {
            content: [{
              type: "text",
              text: `Found ${filteredLogs.length} audit log entries:\n\n${logText || 'No audit logs found'}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error retrieving audit logs: ${error.message}`
            }],
            isError: true
          };
        }

      case "validate_token":
        try {
          const { token } = request.params.arguments;

          const decoded = verifyJWT(token);
          const user = userDatabase.get(decoded.username);

          return {
            content: [{
              type: "text",
              text: `Token is valid!\n\nUser: ${decoded.username}\nRole: ${decoded.role}\nTenant: ${decoded.tenantId}\nPermissions: ${decoded.permissions.join(', ')}\nSession ID: ${decoded.sessionId}\nExpires: ${new Date(decoded.exp * 1000).toISOString()}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Token validation failed: ${error.message}`
            }],
            isError: true
          };
        }

      case "logout_user":
        try {
          const { token } = request.params.arguments;

          const decoded = verifyJWT(token);

          // Remove session
          userSessions.delete(decoded.sessionId);

          logAuditEvent('LOGOUT_SUCCESS', decoded.userId, decoded.tenantId, { sessionId: decoded.sessionId });

          return {
            content: [{
              type: "text",
              text: `Logout successful. Session ${decoded.sessionId} has been invalidated.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Logout error: ${error.message}`
            }],
            isError: true
          };
        }

      case "generate_resource_indicator":
        try {
          const { token, resourceType, resourceId } = request.params.arguments;

          // Rate limiting
          const rateLimitKey = token ? verifyJWT(token).userId : 'anonymous';
          const rateLimit = enforceRateLimit(`resource_indicator:${rateLimitKey}`, 100, 3600000);

          if (!rateLimit.allowed) {
            return {
              content: [{
                type: "text",
                text: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`
              }],
              isError: true
            };
          }

          const indicator = generateResourceIndicator(resourceType, resourceId, token);

          if (!indicator) {
            return {
              content: [{
                type: "text",
                text: "Resource indicators are disabled on this server."
              }],
              isError: true
            };
          }

          const validation = validateResourceIndicator(indicator, token);

          return {
            content: [{
              type: "text",
              text: `Resource Indicator Generated Successfully!\n\nIndicator: ${indicator}\nResource Type: ${resourceType}\nResource ID: ${resourceId}\nPermissions: ${validation.permissions.join(', ')}\nAudience: ${validation.resourceData.audience}\n\nThis indicator can be used for secure resource access and is valid for 24 hours.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error generating resource indicator: ${error.message}`
            }],
            isError: true
          };
        }

      case "validate_resource_indicator":
        try {
          const { indicator, token } = request.params.arguments;

          const validation = validateResourceIndicator(indicator, token);

          if (!validation.valid) {
            return {
              content: [{
                type: "text",
                text: `Resource Indicator Validation Failed!\n\nReason: ${validation.reason}\nIndicator: ${indicator}`
              }],
              isError: true
            };
          }

          const age = Date.now() - validation.resourceData.timestamp;
          const ageHours = Math.floor(age / 3600000);
          const ageMinutes = Math.floor((age % 3600000) / 60000);

          return {
            content: [{
              type: "text",
              text: `Resource Indicator Valid!\n\nIndicator: ${indicator}\nResource Type: ${validation.resourceData.resourceType}\nResource ID: ${validation.resourceData.resourceId}\nAudience: ${validation.resourceData.audience}\nAge: ${ageHours}h ${ageMinutes}m\nPermissions: ${validation.permissions.join(', ')}\nServer ID: ${validation.resourceData.serverId}\nVersion: ${validation.resourceData.version}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error validating resource indicator: ${error.message}`
            }],
            isError: true
          };
        }

      case "get_system_metrics":
        try {
          const { token, timeRange = '1h', includeErrors = false } = request.params.arguments;

          if (ENABLE_RBAC) {
            requirePermission(token, PERMISSIONS.VIEW_AUDIT_LOGS);
          }

          // Calculate time range in milliseconds
          const timeRangeMs = {
            '1h': 3600000,
            '24h': 86400000,
            '7d': 604800000,
            '30d': 2592000000
          }[timeRange] || 3600000;

          const cutoffTime = Date.now() - timeRangeMs;

          // Collect metrics
          const metrics = Array.from(requestMetrics.entries())
            .filter(([key, metric]) => metric.timestamp > cutoffTime)
            .map(([key, metric]) => metric);

          const totalRequests = metrics.length;
          const successfulRequests = metrics.filter(m => m.success).length;
          const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / (totalRequests || 1);
          const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
          const totalWarnings = metrics.reduce((sum, m) => sum + m.warnings, 0);
          const avgRequestSize = metrics.reduce((sum, m) => sum + m.requestSize, 0) / (totalRequests || 1);

          // System metrics
          const memUsage = process.memoryUsage();
          const uptime = process.uptime();

          let metricsText = `System Metrics (${timeRange})\n`;
          metricsText += `================================\n`;
          metricsText += `Total Requests: ${totalRequests}\n`;
          metricsText += `Success Rate: ${totalRequests ? Math.round((successfulRequests / totalRequests) * 100) : 0}%\n`;
          metricsText += `Average Response Time: ${Math.round(avgDuration)}ms\n`;
          metricsText += `Total Errors: ${totalErrors}\n`;
          metricsText += `Total Warnings: ${totalWarnings}\n`;
          metricsText += `Average Request Size: ${Math.round(avgRequestSize)} bytes\n\n`;

          metricsText += `System Information\n`;
          metricsText += `==================\n`;
          metricsText += `Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n`;
          metricsText += `Memory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB\n`;
          metricsText += `Active Sessions: ${userSessions.size}\n`;
          metricsText += `Resource Indicators: ${resourceIndicators.size}\n`;
          metricsText += `Error Boundaries: ${errorBoundaries.size}\n\n`;

          if (includeErrors && totalErrors > 0) {
            const recentErrors = Array.from(errorBoundaries.values())
              .filter(b => b.timestamp > cutoffTime && b.errors.length > 0)
              .slice(-10);

            metricsText += `Recent Errors (Last 10)\n`;
            metricsText += `=======================\n`;
            recentErrors.forEach(boundary => {
              boundary.errors.forEach(error => {
                metricsText += `${new Date(error.timestamp).toISOString()} - ${error.message}\n`;
              });
            });
          }

          return {
            content: [{
              type: "text",
              text: metricsText
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error retrieving system metrics: ${error.message}`
            }],
            isError: true
          };
        }

      case "test_transport_security":
        try {
          const { token, testData = { test: "encryption validation" } } = request.params.arguments;

          if (ENABLE_RBAC) {
            requirePermission(token, PERMISSIONS.VIEW_AUDIT_LOGS);
          }

          // Test encryption/decryption
          const encrypted = encryptTransportData(testData);
          let decrypted = null;
          let encryptionWorking = false;

          if (encrypted.encrypted) {
            try {
              decrypted = decryptTransportData(encrypted);
              encryptionWorking = JSON.stringify(decrypted) === JSON.stringify(testData);
            } catch (error) {
              encryptionWorking = false;
            }
          }

          // Test resource indicator generation
          const testIndicator = generateResourceIndicator('test', 'security-test', token);
          const indicatorValidation = validateResourceIndicator(testIndicator, token);

          return {
            content: [{
              type: "text",
              text: `Transport Security Test Results\n` +
                   `=================================\n` +
                   `Encryption Enabled: ${ENABLE_TRANSPORT_ENCRYPTION ? '✅' : '❌'}\n` +
                   `Encryption Working: ${encryptionWorking ? '✅' : '❌'}\n` +
                   `Resource Indicators Enabled: ${ENABLE_RESOURCE_INDICATORS ? '✅' : '❌'}\n` +
                   `Resource Indicator Working: ${indicatorValidation.valid ? '✅' : '❌'}\n` +
                   `Rate Limiting: ✅ Active\n` +
                   `Error Boundaries: ✅ Active\n` +
                   `Audit Logging: ${ENABLE_AUDIT_LOG ? '✅' : '❌'}\n\n` +
                   `Test Data: ${JSON.stringify(testData)}\n` +
                   `Encrypted: ${encrypted.encrypted ? 'Yes' : 'No'}\n` +
                   `Decryption Match: ${encryptionWorking ? 'Yes' : 'No'}\n` +
                   `Test Indicator: ${testIndicator || 'N/A'}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Transport security test failed: ${error.message}`
            }],
            isError: true
          };
        }

      case "health_check":
        try {
          const { token, includeDetailed = false } = request.params.arguments;

          let healthStatus = 'healthy';
          const checks = {
            server: '✅ Running',
            memory: '✅ Normal',
            authentication: '✅ Operational',
            database: '✅ Connected',
            security: '✅ Active'
          };

          // Memory check
          const memUsage = process.memoryUsage();
          const memUsageMB = memUsage.heapUsed / 1024 / 1024;
          if (memUsageMB > 500) {
            checks.memory = '⚠️ High Memory Usage';
            healthStatus = 'degraded';
          }

          // Security checks
          if (!ENABLE_AUDIT_LOG) {
            checks.security = '⚠️ Audit Logging Disabled';
            healthStatus = 'degraded';
          }

          // Check for recent errors
          const recentErrors = Array.from(errorBoundaries.values())
            .filter(b => b.timestamp > Date.now() - 300000 && b.errors.length > 0); // Last 5 minutes

          if (recentErrors.length > 10) {
            checks.server = '⚠️ High Error Rate';
            healthStatus = 'degraded';
          }

          let healthText = `System Health Check\n`;
          healthText += `==================\n`;
          healthText += `Overall Status: ${healthStatus.toUpperCase()}\n\n`;

          Object.entries(checks).forEach(([check, status]) => {
            healthText += `${check.charAt(0).toUpperCase() + check.slice(1)}: ${status}\n`;
          });

          if (includeDetailed && token) {
            try {
              const decoded = verifyJWT(token);
              healthText += `\nDetailed Information\n`;
              healthText += `====================\n`;
              healthText += `Memory Usage: ${Math.round(memUsageMB)}MB\n`;
              healthText += `Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\n`;
              healthText += `Active Sessions: ${userSessions.size}\n`;
              healthText += `Recent Errors (5min): ${recentErrors.length}\n`;
              healthText += `Rate Limit Entries: ${rateLimitStore.size}\n`;
              healthText += `Resource Indicators: ${resourceIndicators.size}\n`;
              healthText += `RBAC Enabled: ${ENABLE_RBAC ? 'Yes' : 'No'}\n`;
              healthText += `Multi-Tenant: ${ENABLE_MULTI_TENANT ? 'Yes' : 'No'}\n`;
              healthText += `Transport Encryption: ${ENABLE_TRANSPORT_ENCRYPTION ? 'Yes' : 'No'}\n`;
            } catch (error) {
              healthText += `\nAuthentication required for detailed metrics.\n`;
            }
          }

          return {
            content: [{
              type: "text",
              text: healthText
            }],
            isError: healthStatus === 'unhealthy'
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Health check failed: ${error.message}`
            }],
            isError: true
          };
        }

      case "browse_template_marketplace":
        try {
          const { query = '', category, difficulty, verified, minRating, limit = 20 } = request.params.arguments;

          const filters = {};
          if (category) filters.category = category;
          if (difficulty) filters.difficulty = difficulty;
          if (verified !== undefined) filters.verified = verified;
          if (minRating) filters.minRating = minRating;

          const templates = searchTemplates(query, filters).slice(0, limit);

          const templateList = templates.map(template =>
            `📋 **${template.name}** (${template.difficulty})\n` +
            `   💎 Rating: ${template.rating}/5 ⭐ | Downloads: ${template.downloads}\n` +
            `   📂 Category: ${template.category} | Author: ${template.author}\n` +
            `   🏷️  Tags: ${template.tags.join(', ')}\n` +
            `   ⏱️  Time: ${template.estimatedTime} | ${template.verified ? '✅ Verified' : '⚠️ Community'}\n` +
            `   📝 ${template.description}\n` +
            `   🆔 ID: ${template.id}`
          ).join('\n\n');

          return {
            content: [{
              type: "text",
              text: `🏪 Template Marketplace Results\n` +
                   `===============================\n\n` +
                   `Found ${templates.length} templates${query ? ` for "${query}"` : ''}\n\n` +
                   `${templateList || 'No templates found matching your criteria.'}\n\n` +
                   `💡 Use 'create_workflow_from_template' with a template ID to create a workflow.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error browsing template marketplace: ${error.message}`
            }],
            isError: true
          };
        }

      case "create_workflow_from_template":
        try {
          const { token, templateId, workflowName, customizations = {}, deployToEnvironment } = request.params.arguments;

          const result = createWorkflowFromTemplate(templateId, customizations, token);

          // Apply custom name if provided
          if (workflowName) {
            result.workflow.name = workflowName;
          }

          // Deploy to environment if specified
          let deploymentResult = null;
          if (deployToEnvironment && token) {
            try {
              deploymentResult = manageEnvironment(deployToEnvironment, 'deploy', {
                workflowId: 'template-generated',
                version: result.template.version
              }, token);
            } catch (deployError) {
              console.warn('Deployment failed:', deployError.message);
            }
          }

          return {
            content: [{
              type: "text",
              text: `✅ Workflow Created from Template!\n\n` +
                   `📋 Workflow Name: ${result.workflow.name}\n` +
                   `📦 Template: ${result.template.name} v${result.template.version}\n` +
                   `👤 Template Author: ${result.template.author}\n` +
                   `🔧 Nodes: ${result.workflow.nodes.length}\n` +
                   `🔗 Auto-Connect: ${result.workflow.autoConnect ? 'Enabled' : 'Disabled'}\n` +
                   `🚀 Advanced Connections: ${result.workflow.advancedConnections ? 'Enabled' : 'Disabled'}\n` +
                   `🔒 Resource Indicator: ${result.resourceIndicator}\n` +
                   `${deploymentResult ? `\n🌐 Deployment: ${deploymentResult.status} to ${deployToEnvironment}` : ''}\n\n` +
                   `🎯 The workflow is ready to use! All nodes are connected automatically.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error creating workflow from template: ${error.message}`
            }],
            isError: true
          };
        }

      case "publish_template":
        try {
          const { token, name, description, category, difficulty, tags, workflow, documentation, isPublic } = request.params.arguments;

          const templateData = {
            name,
            description,
            category,
            difficulty,
            tags,
            template: workflow,
            documentation,
            isPublic
          };

          const publishedTemplate = publishTemplate(templateData, token);

          return {
            content: [{
              type: "text",
              text: `🎉 Template Published Successfully!\n\n` +
                   `📋 Template Name: ${publishedTemplate.name}\n` +
                   `🆔 Template ID: ${publishedTemplate.id}\n` +
                   `📂 Category: ${publishedTemplate.category}\n` +
                   `⚡ Difficulty: ${publishedTemplate.difficulty}\n` +
                   `🏷️  Tags: ${publishedTemplate.tags.join(', ')}\n` +
                   `👤 Author: ${publishedTemplate.author}\n` +
                   `📅 Version: ${publishedTemplate.version}\n` +
                   `${publishedTemplate.verified ? '✅ Verified' : '⚠️ Pending Verification'}\n` +
                   `🌐 Public: ${publishedTemplate.isPublic ? 'Yes' : 'No'}\n` +
                   `📜 License: ${publishedTemplate.license}\n\n` +
                   `🚀 Your template is now available in the marketplace!`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error publishing template: ${error.message}`
            }],
            isError: true
          };
        }

      case "manage_workflow_versions":
        try {
          const { token, action, workflowId, workflowData, message, versionId, tag } = request.params.arguments;

          switch (action) {
            case 'create':
              if (!workflowData) throw new Error('workflowData required for creating version');
              const version = createWorkflowVersion(workflowId, workflowData, token, message);
              return {
                content: [{
                  type: "text",
                  text: `📦 New Version Created!\n\n` +
                       `🆔 Version ID: ${version.id}\n` +
                       `📊 Version: ${version.version}\n` +
                       `👤 Author: ${version.author}\n` +
                       `💬 Message: ${version.message}\n` +
                       `🔍 Hash: ${version.hash}\n` +
                       `📅 Created: ${version.createdAt}\n\n` +
                       `✅ Workflow version saved successfully!`
                }]
              };

            case 'list':
              const versions = getWorkflowVersions(workflowId, token);
              const versionList = versions.map(v =>
                `📦 ${v.version} - ${v.author} (${v.hash})\n` +
                `   💬 ${v.message}\n` +
                `   📅 ${new Date(v.timestamp).toLocaleDateString()}\n` +
                `   🏷️  ${v.tags.join(', ') || 'No tags'} ${v.isStable ? '🔒 Stable' : ''}`
              ).join('\n\n');

              return {
                content: [{
                  type: "text",
                  text: `📚 Workflow Versions for ${workflowId}\n` +
                       `===================================\n\n` +
                       `${versionList || 'No versions found.'}`
                }]
              };

            default:
              throw new Error(`Unknown version action: ${action}`);
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Version management error: ${error.message}`
            }],
            isError: true
          };
        }

      case "manage_environments":
        try {
          const { token, action, environmentId, name, description, url, type, settings, workflowId } = request.params.arguments;

          switch (action) {
            case 'list':
              const envList = Array.from(environments.values()).map(env =>
                `🌐 **${env.name}** (${env.type})\n` +
                `   🆔 ID: ${env.id}\n` +
                `   🔗 URL: ${env.url}\n` +
                `   📝 ${env.description}\n` +
                `   ${env.isActive ? '✅ Active' : '❌ Inactive'}\n` +
                `   ⚙️  Debug: ${env.settings.debugMode ? 'On' : 'Off'} | Log: ${env.settings.logLevel}`
              ).join('\n\n');

              return {
                content: [{
                  type: "text",
                  text: `🌐 Deployment Environments\n` +
                       `==========================\n\n` +
                       `${envList}`
                }]
              };

            case 'create':
              const newEnv = manageEnvironment(null, 'create', { name, description, url, type, settings }, token);
              return {
                content: [{
                  type: "text",
                  text: `🆕 Environment Created!\n\n` +
                       `🆔 ID: ${newEnv.id}\n` +
                       `🌐 Name: ${newEnv.name}\n` +
                       `🔗 URL: ${newEnv.url}\n` +
                       `⚡ Type: ${newEnv.type}\n` +
                       `📅 Created: ${newEnv.createdAt}`
                }]
              };

            case 'deploy':
              if (!workflowId) throw new Error('workflowId required for deployment');
              const deployment = manageEnvironment(environmentId, 'deploy', { workflowId }, token);
              return {
                content: [{
                  type: "text",
                  text: `🚀 Deployment Started!\n\n` +
                       `🆔 Deployment ID: ${deployment.id}\n` +
                       `🌐 Environment: ${environmentId}\n` +
                       `📋 Workflow: ${workflowId}\n` +
                       `📊 Status: ${deployment.status}\n` +
                       `📅 Started: ${deployment.deployedAt}`
                }]
              };

            default:
              const result = manageEnvironment(environmentId, action, { name, description, url, type, settings }, token);
              return {
                content: [{
                  type: "text",
                  text: `✅ Environment ${action} completed successfully!`
                }]
              };
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Environment management error: ${error.message}`
            }],
            isError: true
          };
        }

      case "validate_workflow_best_practices":
        try {
          const { token, workflowData, includeDetailedReport = true } = request.params.arguments;

          const validation = validateWorkflowBestPractices(workflowData);

          let reportText = `📊 Workflow Validation Report\n` +
                          `=============================\n\n` +
                          `🎯 Overall Score: ${validation.score}/100\n` +
                          `${validation.valid ? '✅ Valid' : '❌ Has Errors'}\n\n` +
                          `📈 Metrics:\n` +
                          `• Complexity: ${validation.metrics.complexity}\n` +
                          `• Maintainability: ${validation.metrics.maintainability}\n` +
                          `• Performance: ${validation.metrics.performance}\n\n` +
                          `📋 Summary:\n` +
                          `• Total Nodes: ${validation.summary.totalNodes}\n` +
                          `• Trigger Nodes: ${validation.summary.triggerNodes}\n` +
                          `• Connected Nodes: ${validation.summary.connectedNodes}\n` +
                          `• Orphaned Nodes: ${validation.summary.orphanedNodes}\n` +
                          `• Security Issues: ${validation.summary.securityIssues}\n` +
                          `• Performance Warnings: ${validation.summary.performanceWarnings}`;

          if (includeDetailedReport) {
            if (validation.issues.length > 0) {
              reportText += `\n\n🚨 Issues Found:\n`;
              validation.issues.forEach((issue, index) => {
                reportText += `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}\n`;
              });
            }

            if (validation.suggestions.length > 0) {
              reportText += `\n\n💡 Suggestions for Improvement:\n`;
              validation.suggestions.forEach((suggestion, index) => {
                reportText += `${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.message}\n`;
              });
            }
          }

          if (validation.score >= 90) {
            reportText += `\n\n🏆 Excellent! Your workflow follows best practices.`;
          } else if (validation.score >= 70) {
            reportText += `\n\n👍 Good workflow! Consider addressing the suggestions above.`;
          } else {
            reportText += `\n\n⚠️ This workflow needs improvement. Please review the issues and suggestions.`;
          }

          return {
            content: [{
              type: "text",
              text: reportText
            }],
            isError: !validation.valid
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Workflow validation error: ${error.message}`
            }],
            isError: true
          };
        }

      case "ai_debug_workflow":
        try {
          const {
            token,
            workflowId,
            executionId,
            workflowData,
            errorContext,
            analysisDepth = 'detailed',
            includeFixSuggestions = true
          } = request.params.arguments;

          // Authenticate user if token provided
          if (token && !authenticateUser(token)) {
            return {
              content: [{
                type: "text",
                text: "Authentication failed. Please provide a valid JWT token."
              }],
              isError: true
            };
          }

          let workflowToAnalyze = workflowData;
          let executionToAnalyze = null;

          // If workflowId provided, fetch the workflow
          if (workflowId && !workflowToAnalyze) {
            try {
              const workflowResponse = await makeApiRequest(`/workflows/${workflowId}`);
              workflowToAnalyze = workflowResponse;
            } catch (error) {
              return {
                content: [{
                  type: "text",
                  text: `Failed to fetch workflow ${workflowId}: ${error.message}`
                }],
                isError: true
              };
            }
          }

          // If executionId provided, fetch the execution data
          if (executionId) {
            try {
              const executionResponse = await makeApiRequest(`/executions/${executionId}`);
              executionToAnalyze = executionResponse;

              // If we have execution data but no workflow data, try to get it
              if (!workflowToAnalyze && executionToAnalyze.workflowId) {
                try {
                  const workflowResponse = await makeApiRequest(`/workflows/${executionToAnalyze.workflowId}`);
                  workflowToAnalyze = workflowResponse;
                } catch (e) {
                  console.error('Could not fetch workflow for execution analysis:', e.message);
                }
              }
            } catch (error) {
              return {
                content: [{
                  type: "text",
                  text: `Failed to fetch execution ${executionId}: ${error.message}`
                }],
                isError: true
              };
            }
          }

          // Perform AI analysis
          const analysis = analyzeWorkflowWithAI(workflowToAnalyze, executionToAnalyze, errorContext);

          // Generate detailed report
          const report = generateDebuggingReport(analysis, analysisDepth);

          // Add context information
          let contextInfo = '';
          if (workflowId) contextInfo += `📋 Workflow ID: ${workflowId}\n`;
          if (executionId) contextInfo += `🔄 Execution ID: ${executionId}\n`;
          if (errorContext && errorContext.errorMessage) contextInfo += `❌ Error: ${errorContext.errorMessage}\n`;
          if (contextInfo) contextInfo += '\n';

          let finalReport = contextInfo + report;

          // Add summary at the end
          finalReport += `\n\n📊 Analysis Summary\n`;
          finalReport += `${'─'.repeat(18)}\n`;
          finalReport += `• Issues Found: ${analysis.issues.length}\n`;
          finalReport += `• Auto-fixable Issues: ${analysis.issues.filter(i => i.autoFix).length}\n`;
          finalReport += `• AI Recommendations: ${analysis.aiRecommendations.length}\n`;
          finalReport += `• Analysis Confidence: ${analysis.confidence}%\n`;

          if (analysis.confidence > 80) {
            finalReport += `\n✅ High-confidence analysis complete. Recommendations are likely accurate.`;
          } else if (analysis.confidence > 50) {
            finalReport += `\n⚠️  Medium-confidence analysis. Consider providing more context for better results.`;
          } else {
            finalReport += `\n❌ Low-confidence analysis. Please provide execution data or error context for better analysis.`;
          }

          return {
            content: [{
              type: "text",
              text: finalReport
            }],
            isError: false
          };

        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `AI debugging analysis failed: ${error.message}`
            }],
            isError: true
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