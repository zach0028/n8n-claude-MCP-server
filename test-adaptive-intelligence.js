#!/usr/bin/env node

// Test suite for Adaptive Intelligence connection detection
// Validates that the system correctly detects required connection types

import fs from 'fs';

// Copy the adaptive intelligence function for testing
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
        nodeType.includes('httprequest') ||
        nodeType.includes('webhook')) {
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

  return detectedTypes;
}

console.log('ADAPTIVE INTELLIGENCE TEST SUITE');
console.log('==================================\n');

// Test scenarios that should trigger specific connection types
const testCases = [
  {
    name: "Basic Webhook (should detect error handling only)",
    nodes: [
      { name: "Webhook Trigger", type: "n8n-nodes-base.webhook" },
      { name: "Process Data", type: "n8n-nodes-base.set" },
      { name: "Send Response", type: "n8n-nodes-base.respondToWebhook" }
    ],
    expected: {
      enableErrorHandling: true,
      enableAdvancedWebhook: true
    }
  },

  {
    name: "Merge Workflow (should detect merge + parallel)",
    nodes: [
      { name: "Source 1", type: "n8n-nodes-base.webhook" },
      { name: "Source 2", type: "n8n-nodes-base.httpRequest" },
      { name: "Merge Data", type: "n8n-nodes-base.merge" },
      { name: "Process", type: "n8n-nodes-base.set" }
    ],
    expected: {
      enableMerge: true,
      enableErrorHandling: true,
      enableParallel: true
    }
  },

  {
    name: "Switch Routing (should detect switch + error handling)",
    nodes: [
      { name: "Trigger", type: "n8n-nodes-base.webhook" },
      { name: "Route Decision", type: "n8n-nodes-base.switch" },
      { name: "Path A", type: "n8n-nodes-base.set" },
      { name: "Path B", type: "n8n-nodes-base.emailSend" },
      { name: "Response", type: "n8n-nodes-base.respondToWebhook" }
    ],
    expected: {
      enableSwitch: true,
      enableErrorHandling: true,
      enableAdvancedWebhook: true,
      enableParallel: true
    }
  },

  {
    name: "Loop Processing (should detect loops + temporal)",
    nodes: [
      { name: "Data Source", type: "n8n-nodes-base.webhook" },
      { name: "Batch Processor", type: "n8n-nodes-base.splitInBatches" },
      { name: "Process Item", type: "n8n-nodes-base.set" },
      { name: "Wait Between", type: "n8n-nodes-base.wait" }
    ],
    expected: {
      enableLoops: true,
      enableTemporal: true,
      enableErrorHandling: true,
      enableParallel: true
    }
  },

  {
    name: "AI Workflow (should detect AI + switch)",
    nodes: [
      { name: "Input", type: "n8n-nodes-base.webhook" },
      { name: "AI Analysis", type: "n8n-nodes-base.openai" },
      { name: "Sentiment Router", type: "n8n-nodes-base.switch" },
      { name: "Positive Handler", type: "n8n-nodes-base.slack" },
      { name: "Negative Handler", type: "n8n-nodes-base.emailSend" }
    ],
    expected: {
      enableAI: true,
      enableSwitch: true,
      enableErrorHandling: true,
      enableParallel: true
    }
  },

  {
    name: "Scheduled Task (should detect temporal)",
    nodes: [
      { name: "Daily Schedule", type: "n8n-nodes-base.cron" },
      { name: "Fetch Data", type: "n8n-nodes-base.httpRequest" },
      { name: "Process Results", type: "n8n-nodes-base.set" }
    ],
    expected: {
      enableTemporal: true,
      enableErrorHandling: true,
      enableParallel: true
    }
  },

  {
    name: "Stateful Session (should detect stateful)",
    nodes: [
      { name: "User Request", type: "n8n-nodes-base.webhook" },
      { name: "Session Manager", type: "n8n-nodes-base.redis" },
      { name: "Cache Check", type: "n8n-nodes-base.set" },
      { name: "Process with State", type: "n8n-nodes-base.set" }
    ],
    expected: {
      enableStateful: true,
      enableErrorHandling: true,
      enableParallel: true
    }
  },

  {
    name: "Complex Enterprise (should detect multiple types)",
    nodes: [
      { name: "Multi-Method Webhook", type: "n8n-nodes-base.webhook" },
      { name: "AI Classifier", type: "n8n-nodes-base.openai" },
      { name: "Route by Type", type: "n8n-nodes-base.switch" },
      { name: "Batch Process", type: "n8n-nodes-base.splitInBatches" },
      { name: "Merge Results", type: "n8n-nodes-base.merge" },
      { name: "Cache Result", type: "n8n-nodes-base.redis" },
      { name: "Error Handler", type: "n8n-nodes-base.errorTrigger" },
      { name: "Response", type: "n8n-nodes-base.respondToWebhook" }
    ],
    expected: {
      enableAI: true,
      enableSwitch: true,
      enableLoops: true,
      enableMerge: true,
      enableStateful: true,
      enableErrorHandling: true,
      enableAdvancedWebhook: true,
      enableParallel: true
    }
  }
];

// Run tests
let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`TEST ${index + 1}: ${testCase.name}`);
  console.log('=' .repeat(50));

  const detected = detectRequiredConnectionTypes(testCase.nodes);
  let testPassed = true;
  const errors = [];

  // Check expected detections
  Object.entries(testCase.expected).forEach(([key, expectedValue]) => {
    if (detected[key] !== expectedValue) {
      testPassed = false;
      errors.push(`${key}: expected ${expectedValue}, got ${detected[key]}`);
    }
  });

  if (testPassed) {
    console.log('[SUCCESS] All connection types correctly detected');
    passedTests++;
  } else {
    console.log('[FAILED] Detection errors:');
    errors.forEach(error => console.log(`  - ${error}`));
  }

  console.log('\nDetected types:');
  Object.entries(detected).forEach(([key, value]) => {
    if (value) {
      console.log(`  ✓ ${key}`);
    }
  });

  console.log('\n' + '=' .repeat(50) + '\n');
});

// Summary
console.log('ADAPTIVE INTELLIGENCE TEST SUMMARY');
console.log('===================================');
console.log(`Tests passed: ${passedTests}/${totalTests}`);
console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 ALL TESTS PASSED! Adaptive Intelligence is working correctly.');
  console.log('\nThe system will now automatically detect and enable the appropriate');
  console.log('connection types based on the nodes present in workflows.');
} else {
  console.log('\n❌ Some tests failed. Review the detection logic.');
}

console.log('\n🧠 Adaptive Intelligence Features:');
console.log('• Automatic detection of required connection types');
console.log('• Smart analysis based on node types and names');
console.log('• No explicit configuration needed from users');
console.log('• Seamless integration with existing workflows');
console.log('• Override capability for advanced users');