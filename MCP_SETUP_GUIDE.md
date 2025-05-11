# Claude MCP (Multi-Component Protocol) Setup Guide

This guide explains how to set up and configure MCP servers for Claude Code projects.

## Overview

Claude Code uses the Multi-Component Protocol (MCP) system to interact with external services like GitHub. When starting a new project, you may need to configure these services to enable functionality like repository management.

## Configuration Steps

### 1. Understanding the Configuration Structure

Claude's MCP configuration is stored in two main locations:

- **Global configuration**: `/root/.claude.json` - Contains user-level settings
- **Project configuration**: Project-specific settings within the global config file

### 2. Setting Up GitHub MCP

To set up GitHub integration:

1. Ensure you have a GitHub Personal Access Token with the necessary permissions
2. Edit the root-level configuration at `/root/.claude.json`
3. Find the "projects" section and locate (or create) an entry for your project directory
4. Add the GitHub MCP server configuration with the proper token

### 3. Configuration Example

Here's what a proper GitHub MCP server configuration looks like:

```json
"mcpServers": {
  "github": {
    "type": "stdio",
    "command": "docker",
    "args": [
      "run",
      "-i",
      "--rm",
      "-e",
      "GITHUB_PERSONAL_ACCESS_TOKEN",
      "ghcr.io/github/github-mcp-server:latest"
    ],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
    }
  }
}
```

### 4. Adding to Project Configuration

To add this configuration to a new project:

1. Open `/root/.claude.json` in a text editor
2. Find or create the entry for your project under the "projects" section
3. Add the "mcpServers" section with the GitHub configuration
4. Save the file

Example of adding to a project:

```json
"projects": {
  "/root/your-new-project": {
    // Other project settings
    "mcpServers": {
      "github": {
        "type": "stdio",
        "command": "docker",
        "args": [
          "run",
          "-i",
          "--rm",
          "-e",
          "GITHUB_PERSONAL_ACCESS_TOKEN",
          "ghcr.io/github/github-mcp-server:latest"
        ],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
        }
      }
    }
  }
}
```

## Other MCP Servers

Besides GitHub, Claude Code supports other MCP servers as well. These can be added using a similar approach:

- **Calculator**: For mathematical operations
- **Restaurant**: For restaurant-related functionalities
- **Personality**: For personality assessment
- **Story**: For interactive story experiences

## Security Considerations

1. **Never commit your `.claude.json` file to version control**
2. Ensure `.gitignore` contains entries for `.claude.json` and `.mcp.json`
3. Rotate your GitHub tokens periodically for better security
4. Use tokens with minimal required permissions

## Verification

After setting up MCP, you can verify it's working:

1. Run Claude Code in your project directory
2. Type `/mcp` to see the status of configured MCP servers
3. Servers should show as "connected" if properly configured

## Troubleshooting

If your MCP servers aren't connecting:

1. Check that the token has the right permissions
2. Ensure Docker is running (for GitHub MCP)
3. Verify the JSON format in your configuration file is correct
4. Look at the logs in `/root/.cache/claude-cli-nodejs/[project-path]/mcp-logs-[server]/`