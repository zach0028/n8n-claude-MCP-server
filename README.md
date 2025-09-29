# 🚀 n8n Claude MCP Server

**Ultra-complete Model Context Protocol (MCP) server for seamless n8n integration with Claude Desktop**

> **Revolutionary workflow automation** - Create, manage, and execute n8n workflows directly from Claude with enterprise-grade reliability and advanced validation.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![n8n](https://img.shields.io/badge/n8n-1.0+-blue.svg)](https://n8n.io/)
[![MCP](https://img.shields.io/badge/MCP-1.18+-purple.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

### 🔧 **Complete Workflow Management**
- **Create workflows** with progressive fallback API handling
- **Update & Delete** workflows with safety validation
- **Activate/Deactivate** workflows on demand
- **Template system** with pre-built workflow patterns

### 📊 **Advanced Execution Control**
- **Execute workflows** manually with custom data
- **Monitor executions** with detailed status tracking
- **Stop running executions** for better control
- **List executions** with filtering capabilities

### 🛡️ **Enterprise-Grade Validation**
- **Pre-creation validation** with comprehensive error checking
- **Connection analysis** and orphan node detection
- **Best practices suggestions** based on GitHub patterns
- **Progressive error handling** with contextual debugging

### 📚 **Rich MCP Resources**
- **Dynamic workflow access** via `n8n://workflow/{id}`
- **Execution details** via `n8n://execution/{id}`
- **Node types database** with 20+ common nodes
- **Template catalog** for quick workflow creation

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **n8n running** on `http://localhost:5678`
- **n8n API key** configured
- **Claude Desktop** installed

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/n8n-claude-mcp-server.git
cd n8n-claude-mcp-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure Claude Desktop**

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/path/to/n8n-claude-mcp-server/index-minimal.js"],
      "env": {
        "N8N_API_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_n8n_api_key_here"
      }
    }
  }
}
```

4. **Restart Claude Desktop** and start automating! 🎉

## 🛠️ Available Tools

| Tool | Description | Usage |
|------|-------------|-------|
| `list_workflows` | List all n8n workflows | Browse existing workflows |
| `create_workflow` | Create new workflows | Build automation from scratch |
| `workflow_update` | Modify existing workflows | Update workflow logic |
| `workflow_delete` | Remove workflows | Clean up unused workflows |
| `activate_workflow` | Enable/disable workflows | Control workflow execution |
| `get_workflow` | Get workflow details | Inspect workflow configuration |
| `validate_workflow` | Validate before creation | Ensure workflow integrity |
| `execute_workflow` | Run workflows manually | Test and trigger workflows |
| `execution_list` | Monitor workflow runs | Track execution history |
| `execution_get` | Get execution details | Debug workflow runs |
| `execution_stop` | Stop running workflows | Emergency execution control |
| `create_workflow_template` | Use pre-built templates | Quick workflow deployment |
| `create_advanced_workflow` | Create workflows with advanced connections | Enterprise-grade automation patterns |
| `list_node_types` | Browse available nodes | Discover automation possibilities |

## 💡 Prompt Examples for Claude AI

### 🎯 **IMPORTANT: How to Create Workflows with Claude**

To create workflows successfully, you **MUST** explicitly ask Claude to:
1. **Create the workflow in n8n via MCP**
2. **Make the connections between components**

### ✅ **Correct Prompts Examples**

#### Create a Complete Webhook to Email Workflow
```
"Use the n8n MCP tools to create a new workflow in n8n that:
1. Receives webhook data via POST
2. Processes the incoming data
3. Sends an email notification
4. Returns a success response

Please create this workflow in n8n and ensure all nodes are properly connected."
```

#### Create a Data Processing Pipeline
```
"Create a workflow in n8n using the MCP server that:
1. Starts with a webhook trigger
2. Adds a function node to transform the data
3. Connects to a database to store results
4. Sends a Slack notification when complete

Make sure to create all connections between the nodes."
```

#### Create from Template and Customize
```
"Use the n8n MCP to create a workflow from the webhook_to_email template, then customize it to:
1. Add data validation before processing
2. Include error handling
3. Connect all nodes properly

Create this in n8n and verify all connections work."
```

#### Monitor and Debug Existing Workflows
```
"Use the n8n MCP tools to:
1. List all my current workflows
2. Show the execution history for the last workflow
3. Check if there are any failed executions

If there are issues, help me understand what went wrong."
```

### ❌ **Avoid These Incomplete Prompts**

```
❌ "Create a webhook workflow" (too vague)
❌ "Show me how to make a workflow" (doesn't use MCP)
❌ "I need email automation" (no action specified)
```

### 🔧 **Advanced Workflow Creation**

#### Complex Multi-Step Automation
```
"Create a comprehensive workflow in n8n via MCP that:
1. Webhook trigger for incoming customer data
2. Function node to validate and clean the data
3. Conditional logic to route based on customer type
4. Different email templates for different customer types
5. Database storage for all interactions
6. Slack notification to the sales team

Please create this workflow in n8n, ensure all nodes are connected properly, and activate it."
```

#### Error Handling and Monitoring
```
"Use the n8n MCP to create a robust workflow with:
1. HTTP request to external API
2. Error handling for failed requests
3. Retry logic with exponential backoff
4. Success/failure notifications
5. Data logging for monitoring

Create this in n8n with proper node connections and test it."
```

### 📊 **Workflow Management**

#### List and Analyze
```
"Use the n8n MCP tools to show me all my workflows, their status, and recent execution results. Help me identify which ones need attention."
```

#### Update Existing Workflow
```
"Use the n8n MCP to update workflow ID [123] by adding a new email notification step after the data processing node. Make sure all connections are maintained."
```

### 🚀 **Advanced Connection Types**

#### Create Workflow with Merge Connections
```
"Use create_advanced_workflow with connection type 'merge' to create a workflow that:
1. Receives data from multiple webhook sources
2. Merges all incoming data using append mode
3. Processes the combined dataset
4. Sends consolidated report

Include merge, error handling, and parallel processing connections."
```

#### Create Switch-Based Routing Workflow
```
"Create an advanced workflow using switch connections that:
1. Receives webhook data
2. Routes data to different processors based on content type
3. Applies different business logic per route
4. Handles errors with retry logic

Use connection type 'switch' with conditional routing rules."
```

#### Create AI-Enhanced Workflow
```
"Build an advanced workflow with AI enrichment connections:
1. Webhook receives customer feedback
2. AI analyzes sentiment and categorizes content
3. Routes positive feedback to success team
4. Routes negative feedback to support with priority
5. Stores insights in database with temporal scheduling

Use 'ai_enrichment' connection type with sentiment analysis."
```

#### Create Complex Loop Processing
```
"Create a workflow with loop connections that:
1. Fetches large dataset from API
2. Processes items in batches of 50
3. Applies transformations to each batch
4. Handles rate limiting with delays
5. Aggregates results with error recovery

Use 'loops' connection type with batch processing configuration."
```

#### Create Enterprise Error Handling
```
"Build a robust workflow with comprehensive error handling:
1. Multi-step data processing pipeline
2. Retry logic with exponential backoff
3. Circuit breaker patterns
4. Fallback data sources
5. Comprehensive error notifications

Use 'error_handling' connection type with retry configuration."
```

## 🏗️ Architecture

### 🔧 **Advanced Connection System**

Our MCP server now supports **25+ advanced connection types** based on analysis of 2000+ n8n workflows and official documentation:

#### **Priority 1: Critical Connections**
- **Merge/Split Connections**: Append, byKey, position, combinations
- **Switch Routing**: Multi-path conditional routing with rules
- **Error Handling**: Retry logic, circuit breakers, fallback patterns

#### **Priority 2: Important Connections**
- **Advanced Webhook**: Multi-method support (GET/POST/PUT/DELETE)
- **Loop Connections**: forEach, while, recursive with batch processing
- **Temporal Connections**: Delays, schedules, timeouts

#### **Priority 3: Advanced Features**
- **AI Enrichment**: Sentiment analysis, classification, dynamic routing
- **Dynamic Sources**: Context-aware, personalized, data-driven endpoints
- **Parallel Processing**: Load balancing, race conditions, synchronization
- **Stateful Connections**: Sessions, caching, cross-workflow state

### Progressive API Handling
The server uses a **3-tier fallback approach** for maximum compatibility:

1. **Minimal Structure** - Basic workflow creation
2. **Settings Added** - If API requires settings object
3. **Complete Structure** - Full n8n workflow format

### Robust Error Handling
- **Contextual error messages** with actionable solutions
- **Debug information** for troubleshooting
- **Connection diagnostics** for API issues
- **Validation suggestions** based on best practices

### MCP Resources Integration
- **Dynamic resource discovery** from live n8n instance
- **Template management** with categorized workflows
- **Node documentation** with usage examples
- **Real-time workflow access** for Claude context

## 🔧 Configuration

### Environment Variables
```bash
N8N_API_URL=http://localhost:5678  # Your n8n instance URL
N8N_API_KEY=your_api_key_here      # Your n8n API key
```

### n8n API Key Setup
1. Go to n8n Settings → API Keys
2. Create new API key
3. Copy the key to your configuration

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for Claude and MCP protocol
- **n8n.io** for the powerful automation platform
- **GitHub community** for n8n integration patterns
- **Contributors** who helped perfect this implementation

## 🔗 Links

- [n8n Documentation](https://docs.n8n.io/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/claude-code)
- [n8n API Reference](https://docs.n8n.io/api/)

---
