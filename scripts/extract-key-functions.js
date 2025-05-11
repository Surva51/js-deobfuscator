#!/usr/bin/env node

/**
 * This script extracts the key business logic functions 
 * based on what we've identified in our previous analysis.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified/cli-pretty.js');
const outputDir = path.join(__dirname, 'core-functions');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the prettified code
console.log(`Reading file: ${inputFile}`);
const code = fs.readFileSync(inputFile, 'utf8');
console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

// Key business logic functions to extract
const keyFunctions = [
  // API interaction 
  "_B6",     // Main API interaction function
  "qS",      // System prompt for Claude
  
  // Token management
  "sa5",     // Token counting
  "XN",      // Token counting from conversation history
  "kB6",     // Cache token counting
  
  // Rate limiting
  "vB6",     // Rate limit state hook
  "xB6",     // Check quota status with API
  "yB6",     // Rate limit status change handler
  
  // Tools
  "ZK1",     // Tool response processing
  "oa5",     // Map tool responses
  "fB6",     // Format message content
];

// Extract a function by name from the code
function extractFunction(code, funcName) {
  const functionPattern = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const matches = [...code.matchAll(functionPattern)];
  
  if (matches.length === 0) {
    console.warn(`Function ${funcName} not found in code`);
    return null;
  }
  
  // Handle multiple matches - this could happen if function names are reused
  matches.forEach((match, index) => {
    const startPos = match.index;
    
    // Find the end of the function by tracking braces
    let braceCount = 1;
    let endPos = startPos + match[0].length;
    
    while (endPos < code.length && braceCount > 0) {
      if (code[endPos] === '{') {
        braceCount++;
      } else if (code[endPos] === '}') {
        braceCount--;
      }
      endPos++;
    }
    
    // Extract the function code
    const functionCode = code.substring(startPos, endPos);
    
    // If there are multiple matches, append an index to the filename
    const fileName = matches.length > 1 ? `${funcName}_${index + 1}.js` : `${funcName}.js`;
    const outputFile = path.join(outputDir, fileName);
    
    // Write to file
    fs.writeFileSync(outputFile, functionCode);
    console.log(`Extracted ${funcName}${matches.length > 1 ? ` (instance ${index + 1})` : ''} to ${outputFile} (${functionCode.length} bytes)`);
    
    // Also create a metadata file with information
    const metaFile = path.join(outputDir, `${path.basename(outputFile, '.js')}.meta.json`);
    fs.writeFileSync(metaFile, JSON.stringify({
      name: funcName,
      instance: matches.length > 1 ? index + 1 : 1,
      size: functionCode.length,
      startPosition: startPos,
      endPosition: endPos
    }, null, 2));
  });
  
  return matches.length;
}

// Main function to extract all key functions
function extractKeyFunctions() {
  console.log(`Extracting ${keyFunctions.length} key business logic functions...`);
  
  // Track successful extractions
  const extracted = [];
  const notFound = [];
  
  // Extract each function
  keyFunctions.forEach(funcName => {
    const count = extractFunction(code, funcName);
    if (count) {
      extracted.push({ name: funcName, instances: count });
    } else {
      notFound.push(funcName);
    }
  });
  
  // Generate a summary
  console.log('\nExtraction Summary:');
  console.log(`- Successfully extracted: ${extracted.length} functions`);
  console.log(`- Not found: ${notFound.length} functions`);
  
  if (notFound.length > 0) {
    console.log('Functions not found:');
    notFound.forEach(name => console.log(`  - ${name}`));
  }
  
  // Write a summary to file
  const summaryFile = path.join(outputDir, '_summary.md');
  let summary = '# Core Business Logic Functions\n\n';
  
  summary += 'These functions represent the core business logic of the Claude CLI.\n\n';
  summary += '## Extracted Functions\n\n';
  summary += '| Function | Instances | Purpose |\n';
  summary += '|----------|-----------|--------|\n';
  
  // Define function purposes
  const functionPurposes = {
    "_B6": "Main API interaction function",
    "qS": "System prompt for Claude",
    "sa5": "Token counting",
    "XN": "Token counting from conversation history",
    "kB6": "Cache token counting",
    "vB6": "Rate limit state hook",
    "xB6": "Check quota status with API",
    "yB6": "Rate limit status change handler",
    "ZK1": "Tool response processing",
    "oa5": "Map tool responses",
    "fB6": "Format message content"
  };
  
  extracted.forEach(func => {
    summary += `| ${func.name} | ${func.instances} | ${functionPurposes[func.name] || 'Unknown'} |\n`;
  });
  
  if (notFound.length > 0) {
    summary += '\n## Functions Not Found\n\n';
    notFound.forEach(name => {
      summary += `- ${name}: ${functionPurposes[name] || 'Unknown'}\n`;
    });
  }
  
  summary += '\n## Next Steps\n\n';
  summary += '1. Analyze each function to understand its purpose and behavior\n';
  summary += '2. Create a dependency graph to see how these functions interact\n';
  summary += '3. Document the API interaction flow\n';
  summary += '4. Create a clean, refactored version of the business logic\n';
  
  fs.writeFileSync(summaryFile, summary);
  console.log(`Summary written to ${summaryFile}`);
}

// Run the extraction
extractKeyFunctions();