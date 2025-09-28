#!/usr/bin/env node

// Test des connexions corrigées (avec names au lieu d'ids)
import fs from 'fs';

// Fonction corrigée de génération de connexions
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

  console.log('🔍 Node categorization:');
  console.log(`  Triggers: ${triggerNodes.map(n => n.name).join(', ')}`);
  console.log(`  Actions: ${actionNodes.map(n => n.name).join(', ')}`);
  console.log(`  Responses: ${responseNodes.map(n => n.name).join(', ')}`);

  // Pattern 1: Trigger -> Actions -> Response (workflow linéaire)
  if (triggerNodes.length > 0) {
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

  return connections;
}

// Test avec des nodes ayant des noms réalistes
const testNodes = [
  {
    id: "node-1-webhook",
    name: "Webhook Trigger",
    type: "n8n-nodes-base.webhook"
  },
  {
    id: "node-2-set",
    name: "Process Data",
    type: "n8n-nodes-base.set"
  },
  {
    id: "node-3-respondToWebhook",
    name: "Send Response",
    type: "n8n-nodes-base.respondToWebhook"
  }
];

console.log('🧪 Testing corrected auto-connect with names...\n');

const connections = generateSmartConnections(testNodes);

console.log('\n🔗 Generated connections:');
console.log(JSON.stringify(connections, null, 2));

// Validation que les connexions utilisent bien les noms
const expectedConnections = {
  "Webhook Trigger": {
    "main": [[{ "node": "Process Data", "type": "main", "index": 0 }]]
  },
  "Process Data": {
    "main": [[{ "node": "Send Response", "type": "main", "index": 0 }]]
  }
};

const isCorrect = JSON.stringify(connections) === JSON.stringify(expectedConnections);
console.log(`\n[SUCCESS] Name-based connections test: ${isCorrect ? 'PASSED' : 'FAILED'}`);

if (isCorrect) {
  console.log(' SUCCESS: Connections now use node names instead of IDs!');
  console.log('[RUNNING] Flow: Webhook Trigger → Process Data → Send Response');
} else {
  console.log('[FAILED] FAILED: Connections format incorrect');
  console.log('Expected:', JSON.stringify(expectedConnections, null, 2));
  console.log('Actual:', JSON.stringify(connections, null, 2));
}