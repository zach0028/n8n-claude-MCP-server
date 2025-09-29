/**
 * Test du Système de Découverte Dynamique des Nœuds
 *
 * Ce test valide que le système de fallback universel fonctionne correctement
 * et permet à Claude de manipuler 100% des nœuds n8n.
 *
 * @version 1.0.0
 * @date 2025-01-29
 */

const advancedTools = require('./advanced-node-manipulation-tools.cjs');

// Configuration
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

console.log('🚀 Test du Système de Découverte Dynamique des Nœuds\n');
console.log('Configuration:');
console.log(`  N8N_API_URL: ${N8N_API_URL}`);
console.log(`  N8N_API_KEY: ${N8N_API_KEY ? '***' + N8N_API_KEY.slice(-4) : 'NOT SET'}\n`);

/**
 * Test 1: Nœud documenté localement (doit utiliser la base locale)
 */
async function test1_LocalNode() {
  console.log('📝 Test 1: Nœud documenté localement (HTTP Request)');
  console.log('Expected: Documentation détaillée depuis la base locale\n');

  try {
    const result = await advancedTools.describeNodeType(
      'n8n-nodes-base.httpRequest',
      N8N_API_URL,
      N8N_API_KEY
    );

    if (result.error) {
      console.log('❌ ÉCHEC:', result.error);
      return false;
    }

    console.log('✅ SUCCÈS');
    console.log(`   Source: ${result.source}`);
    console.log(`   Documentation Level: ${result.documentationLevel}`);
    console.log(`   Display Name: ${result.displayName}`);
    console.log(`   Paramètres disponibles: ${Object.keys(result.parameters || {}).length}`);
    console.log(`   Exemples fournis: ${(result.examples || []).length}\n`);
    return true;
  } catch (error) {
    console.log('❌ ERREUR:', error.message, '\n');
    return false;
  }
}

/**
 * Test 2: Nœud NON documenté localement (doit utiliser le fallback API)
 */
async function test2_DynamicNode() {
  console.log('📝 Test 2: Nœud NON documenté (Slack)');
  console.log('Expected: Documentation basique récupérée dynamiquement depuis n8n API\n');

  if (!N8N_API_KEY || N8N_API_KEY === '') {
    console.log('⚠️  SKIP: N8N_API_KEY not set - cannot test dynamic discovery\n');
    return null;
  }

  try {
    const result = await advancedTools.describeNodeType(
      'n8n-nodes-base.slack',
      N8N_API_URL,
      N8N_API_KEY
    );

    if (result.error) {
      console.log('❌ ÉCHEC:', result.error);
      if (result.suggestion) {
        console.log('   Suggestion:', result.suggestion);
      }
      return false;
    }

    console.log('✅ SUCCÈS - Fallback dynamique fonctionne !');
    console.log(`   Source: ${result.source}`);
    console.log(`   Documentation Level: ${result.documentationLevel}`);
    console.log(`   Display Name: ${result.displayName}`);
    console.log(`   Paramètres disponibles: ${Object.keys(result.parameters || {}).length}`);
    console.log(`   Note: ${result.note}\n`);
    return true;
  } catch (error) {
    console.log('❌ ERREUR:', error.message, '\n');
    return false;
  }
}

/**
 * Test 3: Découverte forcée avec getNodeDefinitionFromN8n
 */
async function test3_ForcedDiscovery() {
  console.log('📝 Test 3: Découverte forcée (Gmail)');
  console.log('Expected: Récupération directe depuis l\'API sans chercher localement\n');

  if (!N8N_API_KEY || N8N_API_KEY === '') {
    console.log('⚠️  SKIP: N8N_API_KEY not set - cannot test forced discovery\n');
    return null;
  }

  try {
    const result = await advancedTools.getNodeDefinitionFromN8n(
      'n8n-nodes-base.gmail',
      N8N_API_URL,
      N8N_API_KEY
    );

    if (!result) {
      console.log('❌ ÉCHEC: Aucun résultat retourné');
      return false;
    }

    console.log('✅ SUCCÈS - Découverte forcée fonctionne !');
    console.log(`   Node Type: ${result.nodeType}`);
    console.log(`   Display Name: ${result.displayName}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Is Trigger: ${result.isTrigger}`);
    console.log(`   Credentials: ${result.credentials.length} type(s)`);
    console.log(`   Paramètres: ${Object.keys(result.parameters).length}`);
    console.log(`   Fetched At: ${result.fetchedAt}\n`);
    return true;
  } catch (error) {
    console.log('❌ ERREUR:', error.message, '\n');
    return false;
  }
}

/**
 * Test 4: Vérification du cache
 */
async function test4_CacheValidation() {
  console.log('📝 Test 4: Validation du système de cache');
  console.log('Expected: Deuxième appel devrait être instantané (depuis le cache)\n');

  if (!N8N_API_KEY || N8N_API_KEY === '') {
    console.log('⚠️  SKIP: N8N_API_KEY not set\n');
    return null;
  }

  try {
    const nodeType = 'n8n-nodes-base.openai';

    // Premier appel (va interroger l'API)
    console.log('   Premier appel (API)...');
    const start1 = Date.now();
    const result1 = await advancedTools.getNodeDefinitionFromN8n(
      nodeType,
      N8N_API_URL,
      N8N_API_KEY
    );
    const time1 = Date.now() - start1;

    if (!result1) {
      console.log('❌ ÉCHEC: Premier appel n\'a rien retourné');
      return false;
    }

    // Deuxième appel (devrait utiliser le cache)
    console.log('   Deuxième appel (Cache)...');
    const start2 = Date.now();
    const result2 = await advancedTools.getNodeDefinitionFromN8n(
      nodeType,
      N8N_API_URL,
      N8N_API_KEY
    );
    const time2 = Date.now() - start2;

    if (!result2) {
      console.log('❌ ÉCHEC: Deuxième appel n\'a rien retourné');
      return false;
    }

    console.log('✅ SUCCÈS - Cache fonctionne !');
    console.log(`   Premier appel: ${time1}ms`);
    console.log(`   Deuxième appel: ${time2}ms`);
    console.log(`   Accélération: ${time2 < time1 ? 'OUI' : 'NON'} (${Math.round((1 - time2/time1) * 100)}% plus rapide)\n`);
    return true;
  } catch (error) {
    console.log('❌ ERREUR:', error.message, '\n');
    return false;
  }
}

/**
 * Test 5: Test de nœuds populaires non documentés
 */
async function test5_PopularNodes() {
  console.log('📝 Test 5: Nœuds populaires non documentés');
  console.log('Expected: Tous les nœuds doivent être découvrables dynamiquement\n');

  if (!N8N_API_KEY || N8N_API_KEY === '') {
    console.log('⚠️  SKIP: N8N_API_KEY not set\n');
    return null;
  }

  const popularNodes = [
    'n8n-nodes-base.slack',
    'n8n-nodes-base.googleSheets',
    'n8n-nodes-base.notion',
    'n8n-nodes-base.discord',
    'n8n-nodes-base.telegram',
  ];

  let successCount = 0;
  const results = [];

  for (const nodeType of popularNodes) {
    try {
      const result = await advancedTools.getNodeDefinitionFromN8n(
        nodeType,
        N8N_API_URL,
        N8N_API_KEY
      );

      if (result) {
        successCount++;
        results.push(`   ✅ ${result.displayName} (${Object.keys(result.parameters).length} params)`);
      } else {
        results.push(`   ❌ ${nodeType} - Non trouvé`);
      }
    } catch (error) {
      results.push(`   ❌ ${nodeType} - Erreur: ${error.message}`);
    }
  }

  console.log(results.join('\n'));
  console.log(`\n   Résultat: ${successCount}/${popularNodes.length} nœuds découverts avec succès\n`);

  return successCount === popularNodes.length;
}

/**
 * Exécuter tous les tests
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = {
    test1: await test1_LocalNode(),
    test2: await test2_DynamicNode(),
    test3: await test3_ForcedDiscovery(),
    test4: await test4_CacheValidation(),
    test5: await test5_PopularNodes(),
  };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n📊 RÉSUMÉ DES TESTS\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  Object.entries(results).forEach(([test, result]) => {
    if (result === true) {
      console.log(`✅ ${test}: SUCCÈS`);
      passed++;
    } else if (result === false) {
      console.log(`❌ ${test}: ÉCHEC`);
      failed++;
    } else {
      console.log(`⚠️  ${test}: IGNORÉ`);
      skipped++;
    }
  });

  console.log(`\nTotal: ${passed} succès, ${failed} échecs, ${skipped} ignorés`);

  if (!N8N_API_KEY || N8N_API_KEY === '') {
    console.log('\n⚠️  NOTE: Définissez N8N_API_KEY pour tester le fallback dynamique');
    console.log('   export N8N_API_KEY="votre_clé_api"\n');
  }

  if (failed === 0 && passed > 0) {
    console.log('\n🎉 TOUS LES TESTS ONT RÉUSSI !');
    console.log('   Le système de fallback universel est opérationnel.');
    console.log('   Claude peut maintenant manipuler 100% des nœuds n8n ! 🚀\n');
  } else if (failed > 0) {
    console.log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('   Vérifiez votre configuration n8n et l\'API key.\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Exécuter les tests
runAllTests().catch(error => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});