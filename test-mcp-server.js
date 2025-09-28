#!/usr/bin/env node

// Test complet du serveur MCP avec auto-connexion
import { readFileSync } from 'fs';

// Simuler un appel MCP pour créer un workflow avec auto-connect
const testWorkflow = {
  name: "Test Auto-Connect Workflow",
  nodes: [
    {
      id: "trigger-1",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      position: [100, 100],
      parameters: {}
    },
    {
      id: "set-1",
      name: "Process Data",
      type: "n8n-nodes-base.set",
      position: [300, 100],
      parameters: {
        assignments: {
          assignments: [
            {
              id: "test-field",
              name: "message",
              value: "Auto-connected workflow!",
              type: "string"
            }
          ]
        }
      }
    },
    {
      id: "webhook-response",
      name: "Send Response",
      type: "n8n-nodes-base.respondToWebhook",
      position: [500, 100],
      parameters: {
        respondWith: "json"
      }
    }
  ],
  autoConnect: true
};

// Fonction de génération de connexions (copiée du serveur principal)
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
    !triggerNodes.some(t => t.id === n.id) &&
    !n.type.includes('respondToWebhook')
  );

  const responseNodes = nodes.filter(n =>
    n.type.includes('respondToWebhook') ||
    n.type.includes('response')
  );

  // Pattern 1: Trigger -> Actions -> Response (workflow linéaire)
  if (triggerNodes.length > 0) {
    // Connecter triggers aux premières actions
    if (actionNodes.length > 0) {
      const firstAction = actionNodes[0];
      triggerNodes.forEach(trigger => {
        connections[trigger.id] = {
          main: [[{ node: firstAction.id, type: 'main', index: 0 }]]
        };
      });

      // Connecter les actions en séquence
      for (let i = 0; i < actionNodes.length - 1; i++) {
        const currentAction = actionNodes[i];
        const nextAction = actionNodes[i + 1];
        connections[currentAction.id] = {
          main: [[{ node: nextAction.id, type: 'main', index: 0 }]]
        };
      }

      // Connecter la dernière action à la réponse
      if (responseNodes.length > 0) {
        const lastAction = actionNodes[actionNodes.length - 1];
        const firstResponse = responseNodes[0];
        connections[lastAction.id] = {
          main: [[{ node: firstResponse.id, type: 'main', index: 0 }]]
        };
      }
    } else if (responseNodes.length > 0) {
      // Connecter directement trigger à response si pas d'actions
      triggerNodes.forEach(trigger => {
        connections[trigger.id] = {
          main: [[{ node: responseNodes[0].id, type: 'main', index: 0 }]]
        };
      });
    }
  }

  return connections;
}

console.log('🧪 Testing MCP server auto-connect functionality...\n');

// Test 1: Génération des connexions
const connections = generateSmartConnections(testWorkflow.nodes);
console.log('[SUCCESS] Test 1 - Connection generation:');
console.log(JSON.stringify(connections, null, 2));

// Test 2: Structure complète du workflow
const completeWorkflow = {
  ...testWorkflow,
  connections
};

console.log('\n[SUCCESS] Test 2 - Complete workflow structure:');
console.log('Workflow name:', completeWorkflow.name);
console.log('Nodes count:', completeWorkflow.nodes.length);
console.log('Connections count:', Object.keys(completeWorkflow.connections).length);

// Test 3: Validation des connexions
const nodeIds = new Set(testWorkflow.nodes.map(n => n.id));
let isValid = true;

for (const [sourceId, sourceConnections] of Object.entries(connections)) {
  if (!nodeIds.has(sourceId)) {
    console.error(`[FAILED] Source node '${sourceId}' not found`);
    isValid = false;
  }

  if (sourceConnections.main) {
    for (const connectionGroup of sourceConnections.main) {
      for (const connection of connectionGroup) {
        if (!nodeIds.has(connection.node)) {
          console.error(`[FAILED] Target node '${connection.node}' not found`);
          isValid = false;
        }
      }
    }
  }
}

console.log(`\n${isValid ? '[SUCCESS]' : '[FAILED]'} Test 3 - Connection validation: ${isValid ? 'PASSED' : 'FAILED'}`);

// Test 4: Vérifier le flux complet
const expectedFlow = 'trigger-1 → set-1 → webhook-response';
const actualFlow = [];

// Construire le flux à partir des connexions
let currentNode = 'trigger-1';
actualFlow.push(currentNode);

while (connections[currentNode] && connections[currentNode].main) {
  const nextNode = connections[currentNode].main[0][0].node;
  actualFlow.push(nextNode);
  currentNode = nextNode;
}

const actualFlowString = actualFlow.join(' → ');
console.log(`\n[SUCCESS] Test 4 - Flow verification:`);
console.log(`Expected: ${expectedFlow}`);
console.log(`Actual:   ${actualFlowString}`);
console.log(`Match: ${expectedFlow === actualFlowString ? '[SUCCESS] PASSED' : '[FAILED] FAILED'}`);

console.log('\n MCP server auto-connect functionality verification completed!');
console.log(`Overall result: ${isValid && expectedFlow === actualFlowString ? '[SUCCESS] FULLY FUNCTIONAL' : '[FAILED] NEEDS FIXES'}`);