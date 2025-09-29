# n8n Claude MCP Server

**Professional Model Context Protocol (MCP) server for comprehensive n8n integration with Claude Desktop**

> Complete workflow automation solution - Create, analyze, modify, and manage n8n workflows with enterprise-grade tools and intelligent automation.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![n8n](https://img.shields.io/badge/n8n-1.0+-blue.svg)](https://n8n.io/)
[![MCP](https://img.shields.io/badge/MCP-1.18+-purple.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Overview

This MCP server provides Claude Desktop with comprehensive n8n workflow management capabilities, including granular modification tools, advanced analysis features, templating systems, and intelligent automation based on official n8n documentation and industry best practices.

## Features

### Core Workflow Management
- **Complete CRUD operations** with progressive API fallback handling
- **Intelligent workflow validation** with error detection and suggestions
- **Enterprise security features** including JWT authentication and RBAC
- **Progressive error handling** with 5-tier fallback strategy

### Advanced Analysis & Visualization
- **Structure analysis** with complexity metrics and performance insights
- **Security auditing** with credential usage and vulnerability detection
- **Visual workflow diagrams** in ASCII and Mermaid formats
- **Performance optimization suggestions** based on best practices

### Granular Modification Tools
- **Surgical node modification** without workflow recreation
- **Smart node addition** with automatic connection inference
- **Intelligent connection management** with validation and cleanup
- **Bulk workflow operations** with safety checks

### Templating & Versioning
- **Template creation** from existing workflows with parameterization
- **Workflow comparison** with detailed diff analysis
- **Rollback capabilities** with automatic backup creation
- **Template marketplace** with categorization and search

## Installation

### Prerequisites
- Node.js 20+ installed
- n8n running on `http://localhost:5678`
- Valid n8n API key configured
- Claude Desktop installed

### Setup Instructions

1. **Clone and install dependencies**
```bash
git clone https://github.com/YOUR_USERNAME/n8n-claude-mcp-server.git
cd n8n-claude-mcp-server
npm install
```

2. **Configure Claude Desktop**

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

3. **Restart Claude Desktop** to activate the MCP server

## Available Tools

### Workflow Management
| Tool | Description |
|------|-------------|
| `list_workflows` | List all workflows with filtering options |
| `get_workflow` | Retrieve detailed workflow information |
| `create_workflow` | Create new workflows with intelligent validation |
| `workflow_update` | Update existing workflows safely |
| `workflow_delete` | Remove workflows with confirmation |
| `activate_workflow` | Enable/disable workflow execution |

### Granular Modification Tools
| Tool | Description |
|------|-------------|
| `modify_single_node` | Modify specific node without affecting others |
| `add_nodes_to_workflow` | Add nodes with optional auto-connection |
| `remove_nodes_from_workflow` | Remove nodes with connection cleanup |
| `update_workflow_connections` | Modify only workflow connections |
| `clone_workflow_with_modifications` | Clone and modify workflows in one operation |

### Advanced Analysis
| Tool | Description |
|------|-------------|
| `analyze_workflow_structure` | Comprehensive workflow analysis (structure, performance, security) |
| `visualize_workflow_diagram` | Generate ASCII/Mermaid workflow diagrams |
| `get_workflow_statistics` | Detailed workflow metrics and complexity analysis |
| `validate_workflow_before_update` | Pre-validation before modifications |
| `suggest_workflow_improvements` | AI-powered optimization recommendations |

### Templating & Versioning
| Tool | Description |
|------|-------------|
| `create_workflow_template` | Create reusable templates from existing workflows |
| `apply_workflow_template` | Instantiate workflows from templates |
| `list_workflow_templates` | Browse available templates with search |
| `workflow_diff` | Compare workflows with detailed diff analysis |
| `rollback_workflow` | Revert workflows to previous states |

### Execution Management
| Tool | Description |
|------|-------------|
| `execute_workflow` | Run workflows manually with custom data |
| `execution_list` | Monitor workflow execution history |
| `execution_get` | Get detailed execution information |
| `execution_stop` | Stop running executions |

### Utility Tools
| Tool | Description |
|------|-------------|
| `list_node_types` | Browse available n8n node types |
| `validate_workflow` | Validate workflow structure |
| `create_smart_workflow` | AI-powered workflow creation |
| `create_advanced_workflow` | Create workflows with advanced connection patterns |

## Usage Examples

### Basic Workflow Operations
```
"Create a webhook to email workflow in n8n with proper error handling"
```

```
"Analyze the structure and performance of workflow ID 123 and suggest improvements"
```

### Granular Modifications
```
"Modify the HTTP Request node in workflow 456 to change the URL to https://api.example.com"
```

```
"Add a data transformation node between the webhook and email nodes in my workflow"
```

### Analysis & Optimization
```
"Generate a visual diagram of workflow 789 showing all connections"
```

```
"Compare workflows 123 and 456 to see what changed between versions"
```

### Templating & Reusability
```
"Create a template from workflow 321 that allows customizable email addresses and API endpoints"
```

```
"Apply the 'webhook-to-slack' template to create a new workflow with custom parameters"
```

## Technical Architecture

### API Compatibility
- **Official n8n REST API** endpoints (`/rest/workflows`)
- **Standard HTTP methods** (GET, POST, PUT, DELETE)
- **Authentication** via `X-N8N-API-KEY` header
- **Progressive fallback** strategy for maximum compatibility

### Data Validation
- **Comprehensive sanitization** for n8n API compliance
- **Node parameter validation** with type-specific rules
- **Connection integrity checking** with automatic fixes
- **Schema validation** using AJV with format extensions

### Error Handling
- **5-tier progressive retry** strategy with intelligent fallback
- **Contextual error messages** with actionable solutions
- **Automatic parameter correction** for common issues
- **Debug information** for troubleshooting

### Security Features
- **JWT authentication** with configurable expiration
- **Role-based access control** (RBAC) with permissions
- **Audit logging** for compliance tracking
- **Multi-tenant support** with isolated environments

## Configuration

### Environment Variables
```bash
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here

# Optional Enterprise Features
JWT_SECRET=your_jwt_secret
ENABLE_RBAC=true
ENABLE_AUDIT_LOG=true
ENABLE_MULTI_TENANT=false
```

### n8n API Key Setup
1. Access n8n Settings → API Keys
2. Generate new API key
3. Configure in environment variables

## Advanced Features

### Workflow Analysis Engine
- **Complexity metrics** calculation with industry standards
- **Performance bottleneck** detection and optimization
- **Security vulnerability** scanning and recommendations
- **Best practices** validation based on community patterns

### Intelligent Templating
- **Parameter extraction** for customizable workflows
- **Category-based organization** with search capabilities
- **Version control** with diff tracking and rollback
- **Marketplace integration** for template sharing

### Enterprise Integration
- **Multi-environment support** for development workflows
- **Batch operations** for large-scale workflow management
- **Backup and recovery** with automated scheduling
- **Monitoring and alerting** for workflow health

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository and create a feature branch
2. Follow existing code style and documentation standards
3. Add tests for new functionality
4. Update documentation for any changes
5. Submit a pull request with clear description

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- **Anthropic** for Claude and the MCP protocol
- **n8n.io** for the powerful automation platform
- **Open source community** for n8n integration patterns and best practices

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [n8n API Reference](https://docs.n8n.io/api/)
- [Claude Desktop](https://claude.ai/)

---

**Professional n8n integration for Claude Desktop - No limitations, complete control**