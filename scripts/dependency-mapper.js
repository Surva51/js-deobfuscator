#!/usr/bin/env node

/**
 * This script analyzes the dependencies between functions to help
 * understand the core application flow.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified/cli-pretty.js');
const extractedDir = path.join(__dirname, 'extracted-components');
const outputDir = path.join(__dirname, 'dependencies');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the prettified code
console.log(`Reading file: ${inputFile}`);
const code = fs.readFileSync(inputFile, 'utf8');
console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

// Find all function names in the code
function findAllFunctions(code) {
  const functionRegex = /function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/g;
  const functions = {};
  let match;
  
  while ((match = functionRegex.exec(code)) !== null) {
    const funcName = match[1];
    const startPos = match.index;
    
    // Find the end of the function by tracking braces
    let braceCount = 1;
    let endPos = startPos + match[0].length;
    
    while (braceCount > 0 && endPos < code.length) {
      if (code[endPos] === '{') braceCount++;
      else if (code[endPos] === '}') braceCount--;
      endPos++;
    }
    
    functions[funcName] = {
      start: startPos,
      end: endPos,
      code: code.substring(startPos, endPos)
    };
  }
  
  return functions;
}

// Find function calls within a function
function findFunctionCalls(funcCode, allFunctions) {
  const calls = new Set();
  
  // Check for each function name in the code
  Object.keys(allFunctions).forEach(calleeName => {
    // Avoid finding the function name in its own declaration
    if (funcCode.indexOf(`function ${calleeName}`) !== -1) {
      return;
    }
    
    // Look for patterns like: calleeName( or calleeName.call( or calleeName.apply(
    const callPattern1 = new RegExp(`\\b${calleeName}\\s*\\(`, 'g');
    const callPattern2 = new RegExp(`\\b${calleeName}\\.call\\s*\\(`, 'g');
    const callPattern3 = new RegExp(`\\b${calleeName}\\.apply\\s*\\(`, 'g');
    
    if (callPattern1.test(funcCode) || callPattern2.test(funcCode) || callPattern3.test(funcCode)) {
      calls.add(calleeName);
    }
  });
  
  return Array.from(calls);
}

// Build the dependency graph
function buildDependencyGraph(allFunctions) {
  const graph = {};
  
  Object.entries(allFunctions).forEach(([funcName, funcInfo]) => {
    const calls = findFunctionCalls(funcInfo.code, allFunctions);
    graph[funcName] = calls;
  });
  
  return graph;
}

// Categorize functions based on existing extraction
function categorizeFunction(funcName) {
  // Check business logic directory
  const businessDir = path.join(extractedDir, 'business-logic');
  if (fs.existsSync(businessDir)) {
    const businessFeatures = fs.readdirSync(businessDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const feature of businessFeatures) {
      const featureDir = path.join(businessDir, feature);
      const featureFiles = fs.readdirSync(featureDir);
      
      if (featureFiles.includes(`${funcName}.js`)) {
        return { type: 'business', feature };
      }
    }
  }
  
  // Check libraries directory
  const libDir = path.join(extractedDir, 'libraries');
  if (fs.existsSync(libDir)) {
    const libraries = fs.readdirSync(libDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const lib of libraries) {
      const libFiles = fs.readdirSync(path.join(libDir, lib));
      
      if (libFiles.includes(`${funcName}.js`)) {
        return { type: 'library', library: lib };
      }
    }
  }
  
  // Check mixed directory
  const mixedDir = path.join(extractedDir, 'mixed');
  if (fs.existsSync(mixedDir)) {
    const mixedFiles = fs.readdirSync(mixedDir);
    
    if (mixedFiles.includes(`${funcName}.js`)) {
      const metaFile = path.join(mixedDir, `${funcName}.meta.json`);
      if (fs.existsSync(metaFile)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
          return { 
            type: 'mixed', 
            libraries: meta.libraries, 
            features: meta.businessFeatures 
          };
        } catch (err) {
          // Fall back to just mixed if can't read meta
          return { type: 'mixed' };
        }
      }
      
      return { type: 'mixed' };
    }
  }
  
  return { type: 'unknown' };
}

// Generate a DOT graph for visualization
function generateDotGraph(graph, outputFile, functionCategories) {
  let dot = 'digraph G {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style=filled];\n\n';
  
  // Add nodes with color based on category
  Object.keys(graph).forEach(funcName => {
    const category = functionCategories[funcName] || { type: 'unknown' };
    let color, label, tooltip;
    
    switch (category.type) {
      case 'business':
        color = 'lightblue';
        label = `${funcName}\\n(${category.feature || 'business'})`;
        tooltip = `Business Logic: ${category.feature || 'unknown feature'}`;
        break;
      case 'library':
        color = 'lightgrey';
        label = `${funcName}\\n(${category.library || 'library'})`;
        tooltip = `Library: ${category.library || 'unknown library'}`;
        break;
      case 'mixed':
        color = 'lightgreen';
        const libs = category.libraries ? category.libraries.join(', ') : '';
        const features = category.features ? category.features.join(', ') : '';
        label = `${funcName}\\n(mixed)`;
        tooltip = `Mixed: ${libs} / ${features}`;
        break;
      default:
        color = 'white';
        label = funcName;
        tooltip = 'Unknown category';
    }
    
    dot += `  "${funcName}" [fillcolor="${color}", label="${label}", tooltip="${tooltip}"];\n`;
  });
  
  dot += '\n';
  
  // Add edges
  Object.entries(graph).forEach(([caller, callees]) => {
    callees.forEach(callee => {
      dot += `  "${caller}" -> "${callee}";\n`;
    });
  });
  
  dot += '}\n';
  
  fs.writeFileSync(outputFile, dot);
  console.log(`Dot graph written to ${outputFile}`);
}

// Generate a summary of dependencies
function generateDependencySummary(graph, functionCategories) {
  // Count incoming and outgoing edges
  const stats = {};
  
  Object.keys(graph).forEach(funcName => {
    stats[funcName] = {
      outgoing: graph[funcName].length,
      incoming: 0,
      category: functionCategories[funcName] || { type: 'unknown' }
    };
  });
  
  // Count incoming edges
  Object.entries(graph).forEach(([caller, callees]) => {
    callees.forEach(callee => {
      if (stats[callee]) {
        stats[callee].incoming++;
      }
    });
  });
  
  // Identify potential entry points (lots of outgoing, few incoming)
  const entryPoints = Object.entries(stats)
    .filter(([_, info]) => info.outgoing > 5 && info.incoming < 3)
    .sort((a, b) => b[1].outgoing - a[1].outgoing);
  
  // Identify potential core functions (lots of incoming, lots of outgoing)
  const coreFunctions = Object.entries(stats)
    .filter(([_, info]) => info.incoming > 5 && info.outgoing > 5)
    .sort((a, b) => (b[1].incoming + b[1].outgoing) - (a[1].incoming + a[1].outgoing));
  
  // Identify utility functions (lots of incoming, few outgoing)
  const utilityFunctions = Object.entries(stats)
    .filter(([_, info]) => info.incoming > 5 && info.outgoing < 3)
    .sort((a, b) => b[1].incoming - a[1].incoming);
  
  // Generate the summary text
  let summary = '# Dependency Analysis Summary\n\n';
  
  summary += '## Potential Entry Points\n\n';
  summary += 'These functions have many outgoing calls but few incoming calls, suggesting they might be entry points to the application.\n\n';
  summary += '| Function | Outgoing Calls | Incoming Calls | Category |\n';
  summary += '|----------|----------------|---------------|----------|\n';
  entryPoints.slice(0, 20).forEach(([funcName, info]) => {
    const category = info.category.type === 'business' 
      ? info.category.feature 
      : info.category.type === 'library' 
        ? `Library: ${info.category.library}` 
        : info.category.type;
    
    summary += `| ${funcName} | ${info.outgoing} | ${info.incoming} | ${category} |\n`;
  });
  
  summary += '\n## Core Functions\n\n';
  summary += 'These functions have many incoming and outgoing calls, suggesting they are core to the application logic.\n\n';
  summary += '| Function | Outgoing Calls | Incoming Calls | Category |\n';
  summary += '|----------|----------------|---------------|----------|\n';
  coreFunctions.slice(0, 20).forEach(([funcName, info]) => {
    const category = info.category.type === 'business' 
      ? info.category.feature 
      : info.category.type === 'library' 
        ? `Library: ${info.category.library}` 
        : info.category.type;
    
    summary += `| ${funcName} | ${info.outgoing} | ${info.incoming} | ${category} |\n`;
  });
  
  summary += '\n## Utility Functions\n\n';
  summary += 'These functions have many incoming calls but few outgoing calls, suggesting they provide utility functionality.\n\n';
  summary += '| Function | Outgoing Calls | Incoming Calls | Category |\n';
  summary += '|----------|----------------|---------------|----------|\n';
  utilityFunctions.slice(0, 20).forEach(([funcName, info]) => {
    const category = info.category.type === 'business' 
      ? info.category.feature 
      : info.category.type === 'library' 
        ? `Library: ${info.category.library}` 
        : info.category.type;
    
    summary += `| ${funcName} | ${info.outgoing} | ${info.incoming} | ${category} |\n`;
  });
  
  summary += '\n## Category Distribution\n\n';
  
  // Count by category
  const categoryCounts = {
    business: 0,
    library: 0,
    mixed: 0,
    unknown: 0
  };
  
  Object.values(functionCategories).forEach(category => {
    categoryCounts[category.type]++;
  });
  
  summary += '| Category | Count |\n';
  summary += '|----------|-------|\n';
  summary += `| Business Logic | ${categoryCounts.business} |\n`;
  summary += `| Library | ${categoryCounts.library} |\n`;
  summary += `| Mixed | ${categoryCounts.mixed} |\n`;
  summary += `| Unknown | ${categoryCounts.unknown} |\n`;
  
  return summary;
}

// Main function
async function analyzeDependencies() {
  console.log('Finding all functions...');
  const allFunctions = findAllFunctions(code);
  console.log(`Found ${Object.keys(allFunctions).length} functions`);
  
  console.log('Building dependency graph...');
  const graph = buildDependencyGraph(allFunctions);
  
  console.log('Categorizing functions...');
  const functionCategories = {};
  Object.keys(graph).forEach(funcName => {
    functionCategories[funcName] = categorizeFunction(funcName);
  });
  
  // Generate the DOT graph
  const dotFile = path.join(outputDir, 'dependency-graph.dot');
  generateDotGraph(graph, dotFile, functionCategories);
  
  // Generate summary
  const summaryFile = path.join(outputDir, 'dependency-summary.md');
  const summary = generateDependencySummary(graph, functionCategories);
  fs.writeFileSync(summaryFile, summary);
  console.log(`Summary written to ${summaryFile}`);
  
  // Save the raw graph data
  const graphFile = path.join(outputDir, 'dependency-graph.json');
  fs.writeFileSync(graphFile, JSON.stringify({
    graph,
    categories: functionCategories
  }, null, 2));
  console.log(`Raw graph data written to ${graphFile}`);
  
  console.log('\nDependency analysis complete!');
  console.log('To visualize the graph, you can use Graphviz:');
  console.log(`dot -Tpng ${dotFile} -o ${path.join(outputDir, 'dependency-graph.png')}`);
}

// Run the analysis
analyzeDependencies();