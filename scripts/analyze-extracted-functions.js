#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const extractedDir = path.join(__dirname, 'extracted-functions');
const outputFile = path.join(__dirname, 'analysis', 'extracted-functions-analysis.md');

// Ensure the analysis directory exists
const analysisDir = path.join(__dirname, 'analysis');
if (!fs.existsSync(analysisDir)) {
  fs.mkdirSync(analysisDir, { recursive: true });
}

// Get all extracted functions
const files = fs.readdirSync(extractedDir)
  .filter(file => file.endsWith('.js'))
  .map(file => ({
    name: file.replace('.js', ''),
    path: path.join(extractedDir, file)
  }));

// Sort by file size
files.sort((a, b) => {
  const sizeA = fs.statSync(a.path).size;
  const sizeB = fs.statSync(b.path).size;
  return sizeB - sizeA;
});

// Analyze the top 10 functions
const topFunctions = files.slice(0, 10);

let output = '# Analysis of Extracted Functions\n\n';
output += 'This report provides analysis of the top 10 largest extracted functions.\n\n';

output += '## Overview\n\n';
output += '| # | Name | Size (bytes) | Lines | Parameters | Notable Features |\n';
output += '|---|------|--------------|-------|------------|-----------------|\n';

topFunctions.forEach((file, index) => {
  const content = fs.readFileSync(file.path, 'utf8');
  const lines = content.split('\n');
  const size = fs.statSync(file.path).size;
  
  // Extract parameters
  const paramMatch = content.match(/function\s+[^(]*\(([^)]*)\)/);
  const params = paramMatch && paramMatch[1].trim() ? paramMatch[1].split(',').length : 0;
  
  // Analyze notable features
  const features = [];
  
  // Check for API calls
  if (content.includes('fetch(') || content.includes('axios.')) {
    features.push('API calls');
  }
  
  // Check for file operations
  if (content.includes('fs.') || content.includes('readFile') || content.includes('writeFile')) {
    features.push('File operations');
  }
  
  // Check for crypto operations
  if (content.includes('crypto.') || content.includes('createHash') || content.includes('encrypt')) {
    features.push('Crypto operations');
  }
  
  // Check for command execution
  if (content.includes('exec(') || content.includes('spawn(') || content.includes('child_process')) {
    features.push('Command execution');
  }
  
  // Check for DOM manipulation
  if (content.includes('document.') || content.includes('getElementById') || content.includes('querySelector')) {
    features.push('DOM manipulation');
  }
  
  // Check for event handling
  if (content.includes('addEventListener') || content.includes('on(') || content.includes('emit(')) {
    features.push('Event handling');
  }
  
  // Check for error handling
  if (content.includes('try {') || content.includes('catch(') || content.includes('throw new')) {
    features.push('Error handling');
  }
  
  // Count conditionals
  const ifCount = (content.match(/if\s*\(/g) || []).length;
  if (ifCount > 20) {
    features.push(`${ifCount} conditionals`);
  }
  
  // Count loops
  const loopCount = (content.match(/for\s*\(/g) || []).length + (content.match(/while\s*\(/g) || []).length;
  if (loopCount > 10) {
    features.push(`${loopCount} loops`);
  }
  
  // Function calls
  const functionCallMatches = content.match(/\w+\s*\(/g) || [];
  const uniqueFunctionCalls = new Set();
  functionCallMatches.forEach(match => {
    const funcName = match.trim().replace('(', '');
    if (funcName && !funcName.match(/^(if|for|while|switch|function|return|typeof|instanceof)$/)) {
      uniqueFunctionCalls.add(funcName);
    }
  });
  
  const notableFeatures = features.length > 0 ? features.join(', ') : 'Simple function';
  
  output += `| ${index + 1} | ${file.name} | ${size.toLocaleString()} | ${lines.length} | ${params} | ${notableFeatures} |\n`;
  
  // Add detailed analysis for each function
  output += `\n### ${index + 1}. ${file.name}\n\n`;
  output += `- **Size**: ${size.toLocaleString()} bytes\n`;
  output += `- **Lines**: ${lines.length}\n`;
  output += `- **Parameters**: ${params}\n`;
  output += `- **Function calls**: ${uniqueFunctionCalls.size} unique function calls\n`;
  
  if (uniqueFunctionCalls.size > 0) {
    const topCalls = Array.from(uniqueFunctionCalls).slice(0, 15);
    output += `- **Sample function calls**: ${topCalls.join(', ')}\n`;
  }
  
  // Extract string literals as they might give clues about functionality
  const stringLiterals = content.match(/"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'|`([^`\\]*(\\.[^`\\]*)*)`/g) || [];
  const interestingStrings = stringLiterals
    .filter(s => s.length > 10 && s.length < 100) // Filter out very short or very long strings
    .slice(0, 10); // Take top 10
  
  if (interestingStrings.length > 0) {
    output += `- **Interesting strings**: ${interestingStrings.join(', ')}\n`;
  }
  
  // Count variable declarations
  const varDeclarations = (content.match(/var\s+\w+/g) || []).length;
  const letDeclarations = (content.match(/let\s+\w+/g) || []).length;
  const constDeclarations = (content.match(/const\s+\w+/g) || []).length;
  
  output += `- **Variable declarations**: ${varDeclarations + letDeclarations + constDeclarations} (var: ${varDeclarations}, let: ${letDeclarations}, const: ${constDeclarations})\n`;
  
  // Show a small code snippet from the beginning of the function (first 5 lines)
  output += '\n**Beginning of the function**:\n\n```javascript\n';
  output += lines.slice(0, Math.min(10, lines.length)).join('\n');
  output += '\n```\n\n';
  
  // Potential purpose based on the analysis
  output += '**Potential purpose**: ';
  
  if (features.includes('API calls')) {
    output += 'This function appears to handle API interactions';
  } else if (features.includes('File operations')) {
    output += 'This function appears to handle file system operations';
  } else if (features.includes('Crypto operations')) {
    output += 'This function appears to handle cryptographic operations';
  } else if (features.includes('Command execution')) {
    output += 'This function appears to execute system commands';
  } else if (features.includes('DOM manipulation')) {
    output += 'This function appears to manipulate the DOM';
  } else if (ifCount > 20) {
    output += 'This function has complex conditional logic';
  } else if (loopCount > 10) {
    output += 'This function processes data through multiple iterations';
  } else {
    output += 'Purpose requires further analysis';
  }
  
  output += '\n\n---\n\n';
});

// Write the analysis to file
fs.writeFileSync(outputFile, output);
console.log(`Analysis written to ${outputFile}`);