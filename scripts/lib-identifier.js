#!/usr/bin/env node

/**
 * This script helps identify and separate library code from business logic
 * in the Claude CLI codebase.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified/cli-pretty.js');
const outputDir = path.join(__dirname, 'identified-libs');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the prettified code
console.log(`Reading file: ${inputFile}`);
const code = fs.readFileSync(inputFile, 'utf8');
console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

// Library signatures to identify
const librarySignatures = [
  {
    name: 'react',
    patterns: [
      /Symbol\.for\("react\.element"\)/,
      /Symbol\.for\("react\.portal"\)/,
      /Symbol\.for\("react\.fragment"\)/,
      /__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED/,
      /reconcilerVersion:/
    ],
    functionNames: ['createElement', 'createPortal', 'forwardRef', 'memo', 'lazy', 'suspense']
  },
  {
    name: 'react-dom',
    patterns: [
      /createRoot/,
      /hydrate/,
      /findDOMNode/,
      /flushSync/
    ],
    functionNames: ['createPortal', 'createRoot', 'hydrate', 'render']
  },
  {
    name: 'ink',
    patterns: [
      /useStdin/,
      /useStdout/,
      /Box|Text|Color|useApp/
    ],
    functionNames: ['Box', 'Text', 'Color', 'useApp', 'render']
  },
  {
    name: 'scheduler',
    patterns: [
      /unstable_scheduleCallback/,
      /unstable_NormalPriority/,
      /unstable_UserBlockingPriority/,
      /unstable_now/
    ],
    functionNames: []
  },
  {
    name: 'xss-filters',
    patterns: [
      /filterXSS/,
      /StripTagBody/,
      /stripCommentTag/,
      /escapeHtml/
    ],
    functionNames: []
  },
  {
    name: 'crypto',
    patterns: [
      /createHash/,
      /createHmac/,
      /randomBytes/,
      /AES|SHA|MD5/i
    ],
    functionNames: []
  },
  {
    name: 'axios',
    patterns: [
      /axios\.get/,
      /axios\.post/,
      /axios\.create/,
      /interceptors/
    ],
    functionNames: []
  },
  {
    name: 'node-fetch',
    patterns: [
      /fetch\(/,
      /Headers\(/,
      /Response\(/,
      /Request\(/
    ],
    functionNames: []
  }
];

// Business logic signatures to identify
const businessLogicSignatures = [
  {
    name: 'anthropic-api',
    patterns: [
      /anthropic|claude/i,
      /tengu_/,
      /api_key/i,
      /\.beta\.messages\.create/
    ]
  },
  {
    name: 'token-management',
    patterns: [
      /token|tokens/i,
      /input_tokens|output_tokens/,
      /cache_creation_input_tokens|cache_read_input_tokens/
    ]
  },
  {
    name: 'rate-limiting',
    patterns: [
      /rate[-_]limit/i,
      /quota|usage/i,
      /rejected|allowed/,
      /resetsAt/,
      /anthropic-ratelimit/
    ]
  },
  {
    name: 'tools',
    patterns: [
      /tool_use/,
      /invocations/,
      /tengu_tool_input_json_normalized/
    ]
  }
];

// Function to find library or business logic signatures in the code
function findSignatures(code, signatures) {
  const results = {};
  
  signatures.forEach(signature => {
    const matches = [];
    signature.patterns.forEach(pattern => {
      const patternMatches = code.match(pattern) || [];
      matches.push(...patternMatches);
    });
    
    if (matches.length > 0) {
      results[signature.name] = {
        matches: matches.length,
        examples: matches.slice(0, 3)  // Include first 3 matches as examples
      };
    }
  });
  
  return results;
}

// Find large function declarations in the code
function findLargeFunctions(code, minSize = 10000) {
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
    
    const funcSize = endPos - startPos;
    if (funcSize >= minSize) {
      functions[funcName] = {
        size: funcSize,
        start: startPos,
        end: endPos
      };
    }
  }
  
  return functions;
}

// Analyze large functions to identify libraries vs business logic
function analyzeFunctions(code, largeFunctions) {
  const results = {};
  
  for (const [funcName, funcInfo] of Object.entries(largeFunctions)) {
    const funcCode = code.substring(funcInfo.start, funcInfo.end);
    
    // Check for library signatures
    const libSignatures = findSignatures(funcCode, librarySignatures);
    
    // Check for business logic signatures
    const businessSignatures = findSignatures(funcCode, businessLogicSignatures);
    
    // Determine if function is more likely to be a library or business logic
    let category = 'unknown';
    if (Object.keys(libSignatures).length > 0 && Object.keys(businessSignatures).length === 0) {
      category = 'library';
    } else if (Object.keys(businessSignatures).length > 0 && Object.keys(libSignatures).length === 0) {
      category = 'business';
    } else if (Object.keys(libSignatures).length > 0 && Object.keys(businessSignatures).length > 0) {
      category = 'mixed';
    }
    
    results[funcName] = {
      size: funcInfo.size,
      category,
      librarySignatures: libSignatures,
      businessSignatures: businessSignatures
    };
  }
  
  return results;
}

// Find module boundaries in the code
function findModuleBoundaries(code) {
  // Look for module patterns like var X = A((Y)) or similar
  const moduleRegex = /var\s+([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$]+)\s*\(\s*(?:\(([A-Za-z0-9_$]+)\)|([A-Za-z0-9_$]+))\s*\)/g;
  const modules = [];
  let match;
  
  while ((match = moduleRegex.exec(code)) !== null) {
    modules.push({
      variableName: match[1],
      functionName: match[2],
      argument: match[3] || match[4],
      position: match.index
    });
  }
  
  return modules;
}

// Main function to analyze the code
function analyzeCode(code) {
  console.log('Finding large functions...');
  const largeFunctions = findLargeFunctions(code);
  console.log(`Found ${Object.keys(largeFunctions).length} large functions`);
  
  console.log('Analyzing functions...');
  const functionAnalysis = analyzeFunctions(code, largeFunctions);
  
  console.log('Finding module boundaries...');
  const modules = findModuleBoundaries(code);
  console.log(`Found ${modules.length} potential modules`);
  
  // Count libraries and business logic functions
  const counts = {
    library: 0,
    business: 0,
    mixed: 0,
    unknown: 0
  };
  
  Object.values(functionAnalysis).forEach(func => {
    counts[func.category]++;
  });
  
  console.log(`\nFunction categories:
  Library: ${counts.library}
  Business Logic: ${counts.business}
  Mixed: ${counts.mixed}
  Unknown: ${counts.unknown}
  `);
  
  // Write analysis results to file
  const outputFile = path.join(outputDir, 'code-analysis.json');
  fs.writeFileSync(outputFile, JSON.stringify({
    functions: functionAnalysis,
    modules: modules
  }, null, 2));
  console.log(`Analysis written to ${outputFile}`);
  
  // Generate a summary report
  const summaryFile = path.join(outputDir, 'analysis-summary.md');
  const summary = generateSummaryReport(functionAnalysis, modules);
  fs.writeFileSync(summaryFile, summary);
  console.log(`Summary report written to ${summaryFile}`);
  
  // Create a mapping to help with function extraction
  const extractionMapFile = path.join(outputDir, 'extraction-map.json');
  const extractionMap = generateExtractionMap(functionAnalysis);
  fs.writeFileSync(extractionMapFile, JSON.stringify(extractionMap, null, 2));
  console.log(`Extraction map written to ${extractionMapFile}`);
}

// Generate a summary report
function generateSummaryReport(functionAnalysis, modules) {
  let summary = '# Code Analysis Summary\n\n';
  
  // Library functions
  summary += '## Library Functions\n\n';
  summary += '| Function | Size | Libraries Detected |\n';
  summary += '|----------|------|--------------------|\n';
  Object.entries(functionAnalysis)
    .filter(([_, info]) => info.category === 'library')
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([name, info]) => {
      const libs = Object.keys(info.librarySignatures).join(', ');
      summary += `| ${name} | ${info.size.toLocaleString()} | ${libs} |\n`;
    });
  
  // Business logic functions
  summary += '\n## Business Logic Functions\n\n';
  summary += '| Function | Size | Features Detected |\n';
  summary += '|----------|------|-------------------|\n';
  Object.entries(functionAnalysis)
    .filter(([_, info]) => info.category === 'business')
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([name, info]) => {
      const features = Object.keys(info.businessSignatures).join(', ');
      summary += `| ${name} | ${info.size.toLocaleString()} | ${features} |\n`;
    });
  
  // Mixed functions
  summary += '\n## Mixed Functions (Library + Business Logic)\n\n';
  summary += '| Function | Size | Libraries | Business Features |\n';
  summary += '|----------|------|-----------|-------------------|\n';
  Object.entries(functionAnalysis)
    .filter(([_, info]) => info.category === 'mixed')
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([name, info]) => {
      const libs = Object.keys(info.librarySignatures).join(', ');
      const features = Object.keys(info.businessSignatures).join(', ');
      summary += `| ${name} | ${info.size.toLocaleString()} | ${libs} | ${features} |\n`;
    });
  
  // Modules
  summary += '\n## Potential Modules\n\n';
  summary += '| Variable Name | Function Name | Argument |\n';
  summary += '|---------------|--------------|----------|\n';
  modules.forEach(module => {
    summary += `| ${module.variableName} | ${module.functionName} | ${module.argument} |\n`;
  });
  
  // Next steps
  summary += '\n## Next Steps\n\n';
  summary += '1. Extract library functions to separate files\n';
  summary += '2. Focus analysis on business logic functions\n';
  summary += '3. Identify the core application flow\n';
  summary += '4. Map the relationships between business functions\n';
  
  return summary;
}

// Generate an extraction map for functions
function generateExtractionMap(functionAnalysis) {
  const map = {
    libraries: {},
    businessLogic: {},
    mixed: {}
  };
  
  // Group by category and then by detected features
  Object.entries(functionAnalysis).forEach(([funcName, info]) => {
    if (info.category === 'library') {
      Object.keys(info.librarySignatures).forEach(lib => {
        if (!map.libraries[lib]) {
          map.libraries[lib] = [];
        }
        map.libraries[lib].push(funcName);
      });
    } else if (info.category === 'business') {
      Object.keys(info.businessSignatures).forEach(feature => {
        if (!map.businessLogic[feature]) {
          map.businessLogic[feature] = [];
        }
        map.businessLogic[feature].push(funcName);
      });
    } else if (info.category === 'mixed') {
      map.mixed[funcName] = {
        libraries: Object.keys(info.librarySignatures),
        businessFeatures: Object.keys(info.businessSignatures)
      };
    }
  });
  
  return map;
}

// Run the analysis
analyzeCode(code);