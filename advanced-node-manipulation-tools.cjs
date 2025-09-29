/**
 * Advanced Node Manipulation Tools for n8n MCP Server
 * 
 * Ces outils permettent à Claude de manipuler finement les nœuds n8n
 * avec validation complète, aide contextuelle et documentation intégrée.
 * 
 * @version 1.0.0
 * @date 2025-01-29
 */

const fs = require('fs');
const path = require('path');

// Load node parameters database
let nodeParametersDB = null;
let nodeParametersExtended = null;
let expressionsGuide = null;
let codeSnippets = null;

try {
  nodeParametersDB = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'node-parameters-database.json'), 'utf8')
  );
  nodeParametersExtended = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'node-parameters-extended.json'), 'utf8')
  );
  codeSnippets = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'node-code-snippets.json'), 'utf8')
  );
} catch (error) {
  console.error('Error loading node databases:', error.message);
}

// Cache pour les définitions de nœuds récupérées dynamiquement
const nodeDefinitionCache = new Map();

/**
 * NOUVEAU: Récupère la définition d'un nœud directement depuis l'API n8n
 * Système de fallback universel pour supporter 100% des nœuds n8n
 */
async function getNodeDefinitionFromN8n(nodeType, n8nApiUrl, n8nApiKey) {
  // Vérifier le cache d'abord
  if (nodeDefinitionCache.has(nodeType)) {
    return nodeDefinitionCache.get(nodeType);
  }

  try {
    const axios = require('axios');

    // Récupérer la liste complète des types de nœuds depuis n8n
    const response = await axios.get(
      `${n8nApiUrl}/api/v1/node-types`,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );

    // Trouver le nœud spécifique
    const nodeData = response.data[nodeType];

    if (!nodeData) {
      return null;
    }

    // Extraire et formater la définition du nœud
    const nodeDefinition = {
      nodeType: nodeType,
      displayName: nodeData.displayName || nodeType,
      description: nodeData.description || 'No description available',
      category: nodeData.codex?.categories?.[0] || 'Other',
      version: nodeData.version || 1,
      isTrigger: nodeData.trigger !== undefined,

      // Credentials supportées
      credentials: (nodeData.credentials || []).map(cred => ({
        name: cred.name,
        displayName: cred.displayName,
        required: cred.required || false
      })),

      // Paramètres du nœud
      parameters: parseNodeProperties(nodeData.properties || []),

      // Inputs/Outputs
      inputs: nodeData.inputs || [],
      outputs: nodeData.outputs || [],

      // Source de la définition
      source: 'n8n-api-dynamic',
      fetchedAt: new Date().toISOString()
    };

    // Mettre en cache
    nodeDefinitionCache.set(nodeType, nodeDefinition);

    return nodeDefinition;

  } catch (error) {
    console.error(`Error fetching node definition for ${nodeType}:`, error.message);
    return null;
  }
}

/**
 * Parse les propriétés d'un nœud depuis l'API n8n
 */
function parseNodeProperties(properties) {
  if (!Array.isArray(properties)) {
    return {};
  }

  const parameters = {};

  properties.forEach(prop => {
    parameters[prop.name] = {
      displayName: prop.displayName,
      type: prop.type,
      required: prop.required || false,
      default: prop.default,
      description: prop.description || '',
      options: prop.options || [],
      placeholder: prop.placeholder || '',
      expressionSupport: prop.noDataExpression === false || true
    };

    // Ajouter les sous-options si disponibles
    if (prop.options && Array.isArray(prop.options)) {
      parameters[prop.name].options = prop.options.map(opt => ({
        name: opt.name,
        value: opt.value,
        description: opt.description || ''
      }));
    }

    // Ajouter les typeOptions si disponibles
    if (prop.typeOptions) {
      parameters[prop.name].typeOptions = prop.typeOptions;
    }
  });

  return parameters;
}

/**
 * Tool 1: describe_node_type
 * Retourne la documentation complète d'un type de nœud
 * AMÉLIORÉ: Utilise le fallback dynamique pour supporter 100% des nœuds n8n
 */
async function describeNodeType(nodeType, n8nApiUrl, n8nApiKey) {
  // Chercher d'abord dans les bases de données locales (documentation détaillée)
  const nodeDoc = nodeParametersDB?.nodes?.[nodeType] ||
                  nodeParametersExtended?.nodes?.[nodeType];

  if (nodeDoc) {
    // Documentation détaillée disponible - retourner la version enrichie
    return {
      nodeType: nodeType,
      displayName: nodeDoc.displayName,
      description: nodeDoc.description,
      category: nodeDoc.category,
      version: nodeDoc.version,
      isTrigger: nodeDoc.isTrigger || false,

      // Credentials supportées
      credentials: nodeDoc.credentials || [],

      // Paramètres détaillés
      parameters: nodeDoc.parameters,

      // Connexions spéciales (pour IF, Switch, etc.)
      connections: {
        input: nodeDoc.inputConnections || { default: "Standard input" },
        output: nodeDoc.outputConnections || { default: "Standard output" }
      },

      // Exemples d'utilisation
      examples: nodeDoc.examples || [],

      // Variables disponibles (pour Function/Code nodes)
      availableVariables: nodeDoc.availableVariables || null,

      // Guide d'utilisation rapide
      quickStart: generateQuickStartGuide(nodeType, nodeDoc),

      // Source de la documentation
      source: 'local-database',
      documentationLevel: 'detailed'
    };
  }

  // Si non trouvé localement, essayer de récupérer depuis l'API n8n
  if (n8nApiUrl && n8nApiKey) {
    console.log(`Node '${nodeType}' not in local database, fetching from n8n API...`);

    const dynamicNode = await getNodeDefinitionFromN8n(nodeType, n8nApiUrl, n8nApiKey);

    if (dynamicNode) {
      // Ajouter le quickStart généré dynamiquement
      dynamicNode.quickStart = generateQuickStartGuide(nodeType, dynamicNode);
      dynamicNode.documentationLevel = 'basic';
      dynamicNode.note = 'This node was discovered dynamically from n8n API. Documentation may be less detailed than locally documented nodes.';

      return dynamicNode;
    }
  }

  // Aucune définition trouvée
  return {
    error: `Node type '${nodeType}' not found`,
    availableInLocalDatabase: [
      ...Object.keys(nodeParametersDB?.nodes || {}),
      ...Object.keys(nodeParametersExtended?.nodes || {})
    ].slice(0, 20),
    hint: "Use 'list_node_types' to see all available node types from your n8n instance",
    suggestion: n8nApiUrl && n8nApiKey
      ? "This node may exist in n8n but could not be fetched. Check your n8n instance and API key."
      : "Provide n8nApiUrl and n8nApiKey to enable dynamic node discovery from your n8n instance"
  };
}

/**
 * Génère un guide de démarrage rapide pour un nœud
 */
function generateQuickStartGuide(nodeType, nodeDoc) {
  const guide = {
    requiredFields: [],
    optionalFields: [],
    commonPatterns: []
  };

  // Extraire les champs requis
  if (nodeDoc.parameters) {
    Object.entries(nodeDoc.parameters).forEach(([key, param]) => {
      if (param.required) {
        guide.requiredFields.push({
          name: key,
          type: param.type,
          default: param.default,
          description: param.description
        });
      } else {
        guide.optionalFields.push({
          name: key,
          type: param.type,
          description: param.description
        });
      }
    });
  }

  // Ajouter des patterns courants si disponibles
  if (nodeDoc.examples && nodeDoc.examples.length > 0) {
    guide.commonPatterns = nodeDoc.examples.map(ex => ({
      name: ex.name,
      description: ex.description,
      parameters: ex.parameters
    }));
  }

  return guide;
}

/**
 * Tool 2: configure_node_parameters
 * Configure des paramètres spécifiques d'un nœud avec validation
 */
async function configureNodeParameters(workflowId, nodeId, parameterPath, value, n8nApiUrl, n8nApiKey) {
  try {
    // 1. Récupérer le workflow actuel
    const axios = require('axios');
    const workflowResponse = await axios.get(
      `${n8nApiUrl}/api/v1/workflows/${workflowId}`,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );
    
    const workflow = workflowResponse.data;
    
    // 2. Trouver le nœud
    const node = workflow.nodes.find(n => n.id === nodeId || n.name === nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' not found in workflow`);
    }

    // 3. Valider le type de nœud et les paramètres
    const nodeDoc = nodeParametersDB?.nodes?.[node.type] || 
                    nodeParametersExtended?.nodes?.[node.type];
    
    if (!nodeDoc) {
      console.warn(`No documentation found for node type ${node.type}, proceeding without validation`);
    }

    // 4. Appliquer la valeur au chemin spécifié
    const pathParts = parameterPath.split('.');
    let target = node.parameters;
    
    // Naviguer jusqu'au parent du champ à modifier
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      
      // Gérer les indices d'array
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        if (!target[arrayName]) target[arrayName] = [];
        if (!target[arrayName][index]) target[arrayName][index] = {};
        target = target[arrayName][index];
      } else {
        if (!target[part]) target[part] = {};
        target = target[part];
      }
    }
    
    // Définir la valeur finale
    const finalKey = pathParts[pathParts.length - 1];
    const arrayMatch = finalKey.match(/^(.+)\[(\d+)\]$/);
    
    if (arrayMatch) {
      const [, arrayName, index] = arrayMatch;
      if (!target[arrayName]) target[arrayName] = [];
      target[arrayName][index] = value;
    } else {
      target[finalKey] = value;
    }

    // 5. Valider le nœud mis à jour
    const validation = validateNodeConfiguration(node, nodeDoc);
    if (!validation.isValid) {
      return {
        success: false,
        validation: validation,
        warning: "Configuration may be invalid but will be applied",
        node: node
      };
    }

    // 6. Mettre à jour le workflow
    const updateResponse = await axios.patch(
      `${n8nApiUrl}/api/v1/workflows/${workflowId}`,
      workflow,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );

    return {
      success: true,
      message: `Parameter '${parameterPath}' updated successfully`,
      nodeId: node.id,
      nodeName: node.name,
      updatedValue: value,
      validation: validation,
      workflow: updateResponse.data
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Valide la configuration d'un nœud
 */
function validateNodeConfiguration(node, nodeDoc) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  if (!nodeDoc) {
    validation.warnings.push('No documentation available for validation');
    return validation;
  }

  // Vérifier les champs requis
  if (nodeDoc.parameters) {
    Object.entries(nodeDoc.parameters).forEach(([key, paramDoc]) => {
      if (paramDoc.required && !node.parameters[key]) {
        validation.isValid = false;
        validation.errors.push(`Missing required parameter: ${key}`);
        
        if (paramDoc.default !== undefined) {
          validation.suggestions.push(`Set ${key} to default value: ${JSON.stringify(paramDoc.default)}`);
        }
      }
    });
  }

  // Vérifier les credentials si nécessaires
  if (nodeDoc.credentials && nodeDoc.credentials.length > 0) {
    const requiredCreds = nodeDoc.credentials.filter(c => c.required);
    if (requiredCreds.length > 0 && !node.credentials) {
      validation.warnings.push(`This node may require credentials: ${requiredCreds.map(c => c.displayName).join(', ')}`);
    }
  }

  return validation;
}

/**
 * Tool 3: add_node_expression
 * Ajoute ou modifie une expression n8n dans un paramètre
 */
async function addNodeExpression(workflowId, nodeId, parameterPath, expression, contextHelp, n8nApiUrl, n8nApiKey) {
  try {
    // Valider la syntaxe de l'expression
    const expressionValidation = validateN8nExpression(expression);
    
    if (!expressionValidation.isValid) {
      return {
        success: false,
        error: 'Invalid n8n expression syntax',
        validation: expressionValidation,
        hint: 'Expressions must be wrapped in ={{...}}'
      };
    }

    // Utiliser configure_node_parameters pour appliquer l'expression
    const result = await configureNodeParameters(
      workflowId,
      nodeId,
      parameterPath,
      expression,
      n8nApiUrl,
      n8nApiKey
    );

    // Ajouter l'aide contextuelle si demandée
    if (contextHelp && result.success) {
      result.expressionHelp = getExpressionContextHelp(expression);
    }

    return result;

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Valide une expression n8n
 */
function validateN8nExpression(expression) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    usedVariables: []
  };

  // Vérifier le format de base
  if (typeof expression !== 'string') {
    validation.isValid = false;
    validation.errors.push('Expression must be a string');
    return validation;
  }

  // Vérifier si c'est une expression (commence par ={{)
  if (expression.startsWith('={{') && expression.endsWith('}}')) {
    const exprContent = expression.slice(3, -2);
    
    // Détecter les variables utilisées
    const variables = [
      '$json', '$binary', '$node', '$workflow', '$execution', 
      '$now', '$today', '$prevNode', '$input', '$item'
    ];
    
    variables.forEach(variable => {
      if (exprContent.includes(variable)) {
        validation.usedVariables.push(variable);
      }
    });

    // Vérifier les accolades équilibrées
    const openBraces = (exprContent.match(/{/g) || []).length;
    const closeBraces = (exprContent.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      validation.warnings.push('Unbalanced braces in expression');
    }

  } else if (expression.includes('{{') || expression.includes('}}')) {
    validation.warnings.push('Expression may be malformed. Use ={{...}} format');
  }

  return validation;
}

/**
 * Fournit l'aide contextuelle pour une expression
 */
function getExpressionContextHelp(expression) {
  const help = {
    expression: expression,
    detectedPatterns: [],
    suggestions: [],
    relatedFunctions: []
  };

  // Détecter les patterns courants
  if (expression.includes('$json.')) {
    help.detectedPatterns.push('Accessing JSON data from current item');
    help.suggestions.push('Use optional chaining: $json?.field for safe access');
  }

  if (expression.includes('$node[')) {
    help.detectedPatterns.push('Accessing data from another node');
    help.suggestions.push('Syntax: $node["Node Name"].json.field');
  }

  if (expression.includes('.map(')) {
    help.detectedPatterns.push('Array transformation with map');
    help.relatedFunctions.push('.filter()', '.reduce()', '.find()');
  }

  if (expression.includes('$now')) {
    help.detectedPatterns.push('Using current date/time');
    help.relatedFunctions.push('.format()', '.plus()', '.minus()', '.diff()');
  }

  return help;
}

/**
 * Tool 4: configure_node_code
 * Configure le code JavaScript pour Function ou Code nodes
 */
async function configureNodeCode(workflowId, nodeId, code, codeType, mode, n8nApiUrl, n8nApiKey) {
  try {
    // Valider le code JavaScript
    const codeValidation = validateJavaScriptCode(code, codeType, mode);
    
    if (!codeValidation.isValid) {
      return {
        success: false,
        error: 'Invalid JavaScript code',
        validation: codeValidation
      };
    }

    // Préparer les paramètres selon le type de nœud
    let parameters;
    
    if (codeType === 'function') {
      parameters = {
        functionCode: code
      };
    } else if (codeType === 'code') {
      parameters = {
        mode: mode || 'runOnceForAllItems',
        jsCode: code
      };
    } else {
      throw new Error(`Invalid codeType: ${codeType}. Must be 'function' or 'code'`);
    }

    // Récupérer et mettre à jour le workflow
    const axios = require('axios');
    const workflowResponse = await axios.get(
      `${n8nApiUrl}/api/v1/workflows/${workflowId}`,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );
    
    const workflow = workflowResponse.data;
    const node = workflow.nodes.find(n => n.id === nodeId || n.name === nodeId);
    
    if (!node) {
      throw new Error(`Node '${nodeId}' not found`);
    }

    // Vérifier le type de nœud
    const expectedType = codeType === 'function' ? 'n8n-nodes-base.function' : 'n8n-nodes-base.code';
    if (node.type !== expectedType) {
      return {
        success: false,
        error: `Node type mismatch. Expected ${expectedType}, got ${node.type}`,
        hint: `This node is of type ${node.type}. Use appropriate configuration method.`
      };
    }

    // Appliquer les paramètres
    node.parameters = { ...node.parameters, ...parameters };

    // Mettre à jour le workflow
    const updateResponse = await axios.patch(
      `${n8nApiUrl}/api/v1/workflows/${workflowId}`,
      workflow,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );

    return {
      success: true,
      message: 'Code updated successfully',
      nodeId: node.id,
      nodeName: node.name,
      codeType: codeType,
      mode: mode,
      validation: codeValidation,
      codePreview: code.substring(0, 200) + (code.length > 200 ? '...' : ''),
      workflow: updateResponse.data
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Valide du code JavaScript
 */
function validateJavaScriptCode(code, codeType, mode) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    detectedPatterns: []
  };

  if (typeof code !== 'string' || code.trim() === '') {
    validation.isValid = false;
    validation.errors.push('Code cannot be empty');
    return validation;
  }

  // Vérifier la syntaxe de base (très simplifié)
  try {
    // Tenter de créer une fonction à partir du code
    new Function(code);
  } catch (error) {
    validation.isValid = false;
    validation.errors.push(`Syntax error: ${error.message}`);
  }

  // Vérifications spécifiques au type
  if (codeType === 'function') {
    // Function node doit retourner items
    if (!code.includes('return')) {
      validation.warnings.push('Function should return items');
      validation.suggestions.push('Add: return items; or return item;');
    }
    
    if (code.includes('$input')) {
      validation.detectedPatterns.push('Using $input helper');
    }
  } else if (codeType === 'code') {
    // Code node doit retourner un array d'items
    if (!code.includes('return')) {
      validation.warnings.push('Code should return result');
    }
    
    if (mode === 'runOnceForAllItems' && !code.includes('$input.all()')) {
      validation.suggestions.push('Consider using $input.all() to get all items');
    } else if (mode === 'runOnceForEachItem' && !code.includes('$input.item')) {
      validation.suggestions.push('Use $input.item to get current item');
    }
  }

  // Détecter l'utilisation de variables n8n
  const n8nVariables = ['$json', '$binary', '$node', '$workflow', '$execution', '$input', '$item'];
  n8nVariables.forEach(variable => {
    if (code.includes(variable)) {
      validation.detectedPatterns.push(`Using ${variable}`);
    }
  });

  // Détecter les patterns JavaScript courants
  if (code.includes('.map(')) validation.detectedPatterns.push('Array.map transformation');
  if (code.includes('.filter(')) validation.detectedPatterns.push('Array.filter filtering');
  if (code.includes('.reduce(')) validation.detectedPatterns.push('Array.reduce aggregation');
  if (code.includes('try') && code.includes('catch')) validation.detectedPatterns.push('Error handling with try-catch');

  return validation;
}

/**
 * Tool 5: configure_node_credentials
 * Configure les credentials d'un nœud
 */
async function configureNodeCredentials(workflowId, nodeId, credentialType, credentialId, n8nApiUrl, n8nApiKey) {
  try {
    const axios = require('axios');
    
    // Récupérer le workflow
    const workflowResponse = await axios.get(
      `${n8nApiUrl}/api/v1/workflows/${workflowId}`,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );
    
    const workflow = workflowResponse.data;
    const node = workflow.nodes.find(n => n.id === nodeId || n.name === nodeId);
    
    if (!node) {
      throw new Error(`Node '${nodeId}' not found`);
    }

    // Vérifier que le nœud supporte ce type de credential
    const nodeDoc = nodeParametersDB?.nodes?.[node.type] || 
                    nodeParametersExtended?.nodes?.[node.type];
    
    if (nodeDoc && nodeDoc.credentials) {
      const supportedCred = nodeDoc.credentials.find(c => c.name === credentialType);
      if (!supportedCred) {
        return {
          success: false,
          error: `Node type ${node.type} does not support credential type ${credentialType}`,
          supportedCredentials: nodeDoc.credentials.map(c => ({
            name: c.name,
            displayName: c.displayName,
            required: c.required
          }))
        };
      }
    }

    // Configurer les credentials
    if (!node.credentials) {
      node.credentials = {};
    }
    
    node.credentials[credentialType] = {
      id: credentialId,
      name: credentialType
    };

    // Mettre à jour le workflow
    const updateResponse = await axios.patch(
      `${n8nApiUrl}/api/v1/workflows/${workflowId}`,
      workflow,
      { headers: { 'X-N8N-API-KEY': n8nApiKey } }
    );

    return {
      success: true,
      message: `Credential '${credentialType}' configured successfully`,
      nodeId: node.id,
      nodeName: node.name,
      credentialType: credentialType,
      credentialId: credentialId,
      workflow: updateResponse.data
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Tool 6: get_code_snippet
 * Retourne un snippet de code réutilisable
 */
function getCodeSnippet(category, snippetName) {
  if (!codeSnippets || !codeSnippets.categories) {
    return {
      error: 'Code snippets database not loaded',
      availableCategories: []
    };
  }

  // Lister toutes les catégories si aucune n'est spécifiée
  if (!category) {
    return {
      categories: Object.keys(codeSnippets.categories).map(cat => ({
        key: cat,
        displayName: codeSnippets.categories[cat].displayName,
        snippetCount: Object.keys(codeSnippets.categories[cat].snippets || {}).length
      }))
    };
  }

  const categoryData = codeSnippets.categories[category];
  
  if (!categoryData) {
    return {
      error: `Category '${category}' not found`,
      availableCategories: Object.keys(codeSnippets.categories)
    };
  }

  // Lister tous les snippets d'une catégorie si aucun n'est spécifié
  if (!snippetName) {
    return {
      category: category,
      displayName: categoryData.displayName,
      snippets: Object.keys(categoryData.snippets).map(key => ({
        key: key,
        name: categoryData.snippets[key].name,
        description: categoryData.snippets[key].description
      }))
    };
  }

  const snippet = categoryData.snippets[snippetName];
  
  if (!snippet) {
    return {
      error: `Snippet '${snippetName}' not found in category '${category}'`,
      availableSnippets: Object.keys(categoryData.snippets)
    };
  }

  return {
    category: category,
    snippetName: snippetName,
    snippet: snippet
  };
}

/**
 * Tool 7: validate_workflow_node
 * Valide un nœud complet avant de l'ajouter au workflow
 */
function validateWorkflowNode(nodeDefinition) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  // Vérifier les champs requis de base
  const requiredFields = ['name', 'type', 'position'];
  requiredFields.forEach(field => {
    if (!nodeDefinition[field]) {
      validation.isValid = false;
      validation.errors.push(`Missing required field: ${field}`);
    }
  });

  // Valider la position
  if (nodeDefinition.position) {
    if (!Array.isArray(nodeDefinition.position) || nodeDefinition.position.length !== 2) {
      validation.isValid = false;
      validation.errors.push('Position must be an array of 2 numbers [x, y]');
    }
  }

  // Valider le type de nœud
  if (nodeDefinition.type) {
    const nodeDoc = nodeParametersDB?.nodes?.[nodeDefinition.type] || 
                    nodeParametersExtended?.nodes?.[nodeDefinition.type];
    
    if (!nodeDoc) {
      validation.warnings.push(`Unknown node type: ${nodeDefinition.type}`);
      validation.suggestions.push('Use describe_node_type to see available parameters');
    } else {
      // Valider les paramètres du nœud
      const nodeValidation = validateNodeConfiguration(nodeDefinition, nodeDoc);
      validation.errors.push(...nodeValidation.errors);
      validation.warnings.push(...nodeValidation.warnings);
      validation.suggestions.push(...nodeValidation.suggestions);
      
      if (!nodeValidation.isValid) {
        validation.isValid = false;
      }
    }
  }

  return validation;
}

// Export des fonctions
module.exports = {
  describeNodeType,
  getNodeDefinitionFromN8n,  // NOUVEAU: Fallback dynamique
  configureNodeParameters,
  addNodeExpression,
  configureNodeCode,
  configureNodeCredentials,
  getCodeSnippet,
  validateWorkflowNode,
  validateN8nExpression,
  validateJavaScriptCode,
  validateNodeConfiguration
};
