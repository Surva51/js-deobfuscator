#!/usr/bin/env node

/**
 * This script analyzes the core functions and documents their relationships
 * and how they work together to form the business logic of the Claude CLI.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const coreFunctionsDir = path.join(__dirname, 'core-functions');
const outputFile = path.join(__dirname, 'core-functions', 'business-logic-flow.md');

// Function to read the content of all extracted functions
function readCoreFunctions() {
  const files = fs.readdirSync(coreFunctionsDir)
    .filter(file => file.endsWith('.js'))
    .map(file => ({
      name: path.basename(file, '.js'),
      path: path.join(coreFunctionsDir, file)
    }));
  
  const functions = {};
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      functions[file.name] = {
        content,
        size: content.length
      };
    } catch (error) {
      console.error(`Error reading file ${file.path}:`, error.message);
    }
  });
  
  return functions;
}

// Find function calls within a function's content
function findFunctionCalls(content, functionNames) {
  const calls = {};
  
  functionNames.forEach(name => {
    // Skip checking for calls to itself
    if (content.includes(`function ${name}`)) {
      return;
    }
    
    // Look for calls to this function
    const pattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
    const matches = content.match(pattern);
    
    if (matches) {
      calls[name] = matches.length;
    }
  });
  
  return calls;
}

// Build a dependency graph between functions
function buildDependencyGraph(functions) {
  const graph = {};
  const functionNames = Object.keys(functions);
  
  functionNames.forEach(name => {
    graph[name] = {
      calls: findFunctionCalls(functions[name].content, functionNames),
      size: functions[name].size
    };
  });
  
  return graph;
}

// Document the core business logic
function documentBusinessLogic() {
  console.log('Reading core functions...');
  const functions = readCoreFunctions();
  console.log(`Read ${Object.keys(functions).length} functions`);
  
  console.log('Building dependency graph...');
  const graph = buildDependencyGraph(functions);
  
  console.log('Generating documentation...');
  
  // Start building the documentation
  let doc = '# Claude CLI Business Logic Flow\n\n';
  doc += 'This document describes how the core business logic functions of the Claude CLI work together.\n\n';
  
  // Function descriptions
  const functionDescriptions = {
    "_B6": "Main API interaction handler that processes message content, particularly handling tool_use content.",
    "qS": "Generates the system prompt used to set Claude's behavior, containing instructions and rules.",
    "sa5": "Calculates total token usage from various token sources (input, cache, output).",
    "XN": "Counts tokens from conversation history.",
    "kB6": "Specifically counts cached tokens from conversation history.",
    "vB6": "React hook that subscribes to rate limit state changes.",
    "xB6": "Makes a minimal API call to check quota status and update rate limit state.",
    "yB6": "Handles rate limit status changes, notifying subscribers and logging events.",
    "ZK1": "Processes and transforms tool inputs recursively.",
    "oa5": "Maps over message content and transforms tool results and inputs.",
    "fB6": "Formats message content for display, handling different content types."
  };
  
  // Function categories
  const functionCategories = {
    "API Interaction": ["_B6", "xB6", "yB6", "vB6"],
    "System Configuration": ["qS"],
    "Token Management": ["sa5", "XN", "kB6"],
    "Tool Handling": ["ZK1", "oa5", "fB6"]
  };
  
  // Document function categories
  doc += '## Function Categories\n\n';
  
  Object.entries(functionCategories).forEach(([category, funcs]) => {
    doc += `### ${category}\n\n`;
    doc += '| Function | Description | Size |\n';
    doc += '|----------|-------------|------|\n';
    
    funcs.forEach(func => {
      doc += `| ${func} | ${functionDescriptions[func] || 'Unknown'} | ${(functions[func]?.size || 0).toLocaleString()} |\n`;
    });
    
    doc += '\n';
  });
  
  // Document dependencies
  doc += '## Function Dependencies\n\n';
  doc += 'This section shows which functions call other functions.\n\n';
  
  Object.entries(graph).forEach(([funcName, info]) => {
    doc += `### ${funcName}\n\n`;
    doc += `**Description**: ${functionDescriptions[funcName] || 'Unknown'}\n\n`;
    
    if (Object.keys(info.calls).length > 0) {
      doc += '**Calls**:\n';
      Object.entries(info.calls)
        .sort((a, b) => b[1] - a[1])
        .forEach(([callee, count]) => {
          doc += `- ${callee} (${count} times)\n`;
        });
    } else {
      doc += '**Calls**: No other core functions\n';
    }
    
    // Find which functions call this one
    const callers = Object.entries(graph)
      .filter(([caller, callerInfo]) => caller !== funcName && callerInfo.calls[funcName])
      .map(([caller, callerInfo]) => `${caller} (${callerInfo.calls[funcName]} times)`);
    
    if (callers.length > 0) {
      doc += '\n**Called by**:\n';
      callers.forEach(caller => {
        doc += `- ${caller}\n`;
      });
    } else {
      doc += '\n**Called by**: No other core functions\n';
    }
    
    doc += '\n';
  });
  
  // Document the main flow
  doc += '## Main Business Logic Flow\n\n';
  doc += 'The Claude CLI business logic follows these main steps:\n\n';
  
  doc += '1. **System Prompt Configuration**:\n';
  doc += '   - The `qS` function generates the system prompt that controls Claude\'s behavior.\n';
  doc += '   - This includes instructions, rules, and example interactions.\n\n';
  
  doc += '2. **API Rate Limit Management**:\n';
  doc += '   - The `xB6` function checks quota status with a minimal API call.\n';
  doc += '   - The `yB6` function handles rate limit status changes and notifications.\n';
  doc += '   - The `vB6` hook allows components to subscribe to rate limit state.\n\n';
  
  doc += '3. **Message Processing**:\n';
  doc += '   - The `_B6` function is the main handler for processing messages.\n';
  doc += '   - It normalizes tool inputs and handles various message types.\n\n';
  
  doc += '4. **Token Counting**:\n';
  doc += '   - The `sa5` function calculates total token usage.\n';
  doc += '   - The `XN` function counts tokens from conversation history.\n';
  doc += '   - The `kB6` function specifically counts cached tokens.\n\n';
  
  doc += '5. **Tool Handling**:\n';
  doc += '   - The `ZK1` function processes tool inputs recursively.\n';
  doc += '   - The `oa5` function maps over message content and transforms it.\n';
  doc += '   - The `fB6` function formats message content for display.\n\n';
  
  // Write the documentation file
  fs.writeFileSync(outputFile, doc);
  console.log(`Documentation written to ${outputFile}`);
}

// Run the documentation
documentBusinessLogic();