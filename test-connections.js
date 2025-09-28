#!/usr/bin/env node

// Test des fonctions de génération automatique de connexions
import fs from 'fs';

// Copier les fonctions du serveur principal
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

  console.log('🔍 Node analysis:');
  console.log(`  Triggers: ${triggerNodes.map(n => n.id).join(', ')}`);
  console.log(`  Actions: ${actionNodes.map(n => n.id).join(', ')}`);
  console.log(`  Responses: ${responseNodes.map(n => n.id).join(', ')}`);

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

// Test avec les données du fichier
const testData = JSON.parse(fs.readFileSync('test-auto-connect.json', 'utf8'));

console.log('🧪 Testing auto-connect logic...\n');
console.log('📋 Input nodes:', testData.nodes.map(n => `${n.id} (${n.type})`).join(', '));

const connections = generateSmartConnections(testData.nodes);

console.log('\n🔗 Generated connections:');
console.log(JSON.stringify(connections, null, 2));

console.log('\n✅ Connection test completed!');

// Vérifier que les connexions sont valides
const nodeIds = new Set(testData.nodes.map(n => n.id));
let isValid = true;

for (const [sourceId, sourceConnections] of Object.entries(connections)) {
  if (!nodeIds.has(sourceId)) {
    console.error(`❌ Source node '${sourceId}' not found`);
    isValid = false;
  }

  if (sourceConnections.main) {
    for (const connectionGroup of sourceConnections.main) {
      for (const connection of connectionGroup) {
        if (!nodeIds.has(connection.node)) {
          console.error(`❌ Target node '${connection.node}' not found`);
          isValid = false;
        }
      }
    }
  }
}

console.log(`\n${isValid ? '✅' : '❌'} Connection validation: ${isValid ? 'PASSED' : 'FAILED'}`);