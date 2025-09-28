#!/bin/bash

echo "🔨 Building n8n MCP Server..."

# Installer les dépendances
npm install

echo "✅ n8n MCP Server build complete!"
echo "📚 Available tools:"
echo "  - list_workflows: List all n8n workflows"
echo "  - get_workflow: Get workflow details"
echo "  - create_workflow: Create new workflow"
echo "  - execute_workflow: Execute a workflow"
echo "  - list_node_types: List available node types"
echo ""
echo "🚀 Ready to integrate with Claude Code!"