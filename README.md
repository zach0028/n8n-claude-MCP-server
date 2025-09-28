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
| `list_node_types` | Browse available nodes | Discover automation possibilities |

## 💡 Usage Examples

### Create a Simple Webhook Workflow
```
"Create a webhook workflow that receives POST data and sends an email notification"
```

### Use a Template
```
"Create a workflow from the webhook_to_email template"
```

### Monitor Executions
```
"Show me the last 10 executions and their status"
```

### Validate Before Creating
```
"Validate this workflow structure before I create it"
```

## 🏗️ Architecture

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

**Made with ❤️ for the automation community**

*Transform your workflow automation with the power of AI!* 🤖✨