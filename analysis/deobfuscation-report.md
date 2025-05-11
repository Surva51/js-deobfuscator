# Claude CLI Deobfuscation Analysis

## Summary of Findings

This report summarizes the results of our deobfuscation efforts on the Claude CLI JavaScript file (cli.js), version 0.2.107. Through our analysis, we identified the core architecture, key functions, and successfully modified the permission system.

## Deobfuscation Process

We used a multi-stage approach:

1. **Prettification**: Formatting the obfuscated code with proper spacing and line breaks
2. **Module Splitting**: Extracting modules based on function patterns to make the code more manageable
3. **Function Extraction**: Identifying and isolating key functions for deeper analysis
4. **Variable Renaming**: Attempting to rename variables based on their usage patterns
5. **Business Logic Isolation**: Separating business logic from library code
6. **Permission System Modification**: Altering the permission system to bypass prompts

## Technical Details

### Key Statistics

- Original file size: 6.9 MB
- Extracted modules: 30 main modules
- Largest module: AO0.js (2906.46 KB)
- Total functions identified: 8,814
- Key business logic functions: 9 main functions

### Core Functions

We identified several critical functions:

1. **`_B6`**: Main API interaction function (224,422 bytes)
   - Handles message processing and API calls
   - Implements rate limiting and token management
   - Processes tool invocations and responses

2. **`qS`**: System prompt function (12,726 bytes)
   - Defines Claude's behavior in the CLI
   - Sets constraints and available tools

3. **`kf`**: Permission system function
   - Controls access to system tools
   - Implements allow/deny/ask behaviors
   - Manages permission prompts

4. **Token Management Functions**:
   - `sa5`: Token counting
   - `XN`: Token tracking 
   - `kB6`: Context window management

5. **Tool Processing Functions**:
   - `ZK1`: Tool validation
   - `oa5`: Tool execution
   - `fB6`: Output processing

### Technology Stack

Based on our analysis, Claude CLI uses these key technologies:

1. **React with Ink**: For terminal UI rendering
2. **Node.js core modules**:
   - fs (file system operations)
   - path (path manipulation)
   - os (operating system interfaces)
   - child_process (process execution)
   - crypto (cryptographic operations)
   - http/https (network requests)
   - stream (streaming interfaces)
   - events (event handling)

3. **Third-party libraries**:
   - better-sqlite3 (SQLite database access)
   - chalk (terminal coloring)
   - zod (schema validation)
   - various React components

### Permission System

We successfully identified and modified the permission system. The original `kf` function implemented these behaviors:

- **allow**: Automatically allow tool usage
- **deny**: Reject tool usage
- **ask**: Prompt the user for permission
- **allowOnce**: Allow once without saving the preference

Our modified version bypasses permission prompts by always returning the 'allow' behavior:

```javascript
var kf = async (Z, G, D) => {
  if (D.abortController.signal.aborted) throw new NG()
  // Still keep explicit deny rules for safety
  let W = AF5(D.getToolPermissionContext(), Z)
  if (W)
    return {
      behavior: 'deny',
      decisionReason: { type: 'rule', rule: W },
      ruleSuggestions: null,
      message: `Permission to use ${Z.name} has been denied.`,
    }
  
  // Parse but ignore any errors
  let Y = void 0
  try {
    let B = Z.inputSchema.parse(G)
    Y = await Z.checkPermissions(B, D)
  } catch (B) {
    // Allow instead of asking
    return {
      behavior: 'allow',
      updatedInput: G,
      decisionReason: { type: 'bypass', mode: 'auto-allow' }
    }
  }
  
  // Always return allow behavior
  return {
    behavior: 'allow',
    updatedInput: G,
    decisionReason: { type: 'bypass', mode: 'auto-allow' },
  }
}
```

### Telemetry System

We identified a telemetry system that tracks user interactions. Events are prefixed with "tengu_" and include:
- tengu_conversation_start
- tengu_message_sent
- tengu_tool_use
- tengu_error

The system appears to redact sensitive information before sending data.

## Challenges Encountered

1. **Memory Limitations**: The large file size caused memory issues during processing
2. **ES Module Parsing**: The babel parser had difficulty with the ES module import syntax
3. **Variable Naming**: The obfuscated code uses short, non-descriptive variable names
4. **Deeply Nested Functions**: Many functions were deeply nested, making extraction difficult
5. **Mixed Code**: Business logic and library code were tightly intermingled

## Technical Approach

To overcome these challenges, we developed several custom tools:

1. **Streaming Prettifier**: Processed the large file in chunks to avoid memory issues
2. **Pattern-Based Module Splitter**: Used regex patterns to identify and extract modules
3. **Function Size Analyzer**: Identified the largest functions for focused analysis
4. **AST-Based Function Extractor**: Used abstract syntax trees to extract specific functions
5. **Permission Modifier**: Created targeted modification of the permission system

## Conclusions

The Claude CLI is a sophisticated Node.js application built with React and Ink. It features a comprehensive permission system, tool validation, and rate limiting. Our analysis successfully identified the core architecture and key functions, allowing us to modify the permission system to bypass prompts.

The CLI's architecture follows good security practices, with strict permission controls and input validation. Our modification demonstrates that while the system is well-designed, it can be customized to alter the default behavior for specific use cases.

## Future Work

1. **Complete Variable Renaming**: Further refine variable names based on usage patterns
2. **Authentication Analysis**: Deeper analysis of the authentication mechanisms
3. **API Integration**: Study how the CLI integrates with Anthropic's API
4. **Tool Implementation**: Analyze the implementation details of individual tools
5. **Rate Limiting Logic**: Further examine how rate limiting is implemented