#!/usr/bin/env node

/**
 * This script identifies and removes common third-party libraries
 * from the codebase, leaving only the core business logic.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified/cli-pretty.js');
const outputDir = path.join(__dirname, 'stripped');
const outputFile = path.join(outputDir, 'business-logic.js');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the prettified code
console.log(`Reading file: ${inputFile}`);
const code = fs.readFileSync(inputFile, 'utf8');
console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

// Common third-party library signatures to identify and remove
const librarySignatures = [
  // React core
  {
    name: 'React',
    patterns: [
      /__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED/,
      /Symbol\.for\("react\./,
      /react\.element|react\.portal|react\.fragment|react\.strict_mode/i,
      /reconcilerVersion/,
      /ReactCurrentDispatcher|ReactCurrentBatchConfig/
    ],
    functions: [
      'createElement', 'createPortal', 'forwardRef', 'memo', 'lazy', 'Suspense',
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo'
    ]
  },
  // React DOM
  {
    name: 'ReactDOM',
    patterns: [
      /ReactDOM|createRoot|hydrate|render\(/,
      /findDOMNode|flushSync/
    ],
    functions: []
  },
  // Scheduler (used by React)
  {
    name: 'Scheduler',
    patterns: [
      /unstable_scheduleCallback|unstable_cancelCallback/,
      /unstable_now|unstable_IdlePriority|unstable_ImmediatePriority/,
      /unstable_LowPriority|unstable_NormalPriority|unstable_UserBlockingPriority/
    ],
    functions: []
  },
  // Ink (terminal UI for React)
  {
    name: 'Ink',
    patterns: [
      /useStdin|useStdout|useInput/,
      /Box|Text|Color|useApp/
    ],
    functions: []
  },
  // XSS Filters
  {
    name: 'XSS-Filters',
    patterns: [
      /filterXSS|StripTagBody|stripCommentTag|escapeHtml/
    ],
    functions: []
  },
  // Crypto utils
  {
    name: 'Crypto',
    patterns: [
      /createHash|createHmac|randomBytes|randomUUID/,
      /AES|SHA|MD5|HMAC/i
    ],
    functions: []
  },
  // HTTP clients
  {
    name: 'HTTP-Clients',
    patterns: [
      /axios|fetch\(|Headers\(|Response\(|Request\(/
    ],
    functions: []
  },
  // Error handling libraries
  {
    name: 'Error-Handling',
    patterns: [
      /Sentry|captureException|captureMessage|configureScope/,
      /addBreadcrumb|withScope|startTransaction/
    ],
    functions: []
  }
];

// Find sections of the code that match library signatures
function findLibrarySections(code, signatures) {
  const matches = [];
  
  // For each library signature, try to find code sections that match
  signatures.forEach(lib => {
    // Try to find pattern matches
    lib.patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern, 'g');
      
      while ((match = regex.exec(code)) !== null) {
        // Find the boundaries of the containing function or module
        const startPos = findFunctionStart(code, match.index);
        const endPos = findFunctionEnd(code, match.index);
        
        if (startPos !== -1 && endPos !== -1) {
          matches.push({
            library: lib.name,
            pattern: pattern.toString(),
            start: startPos,
            end: endPos,
            code: code.substring(startPos, endPos)
          });
        }
      }
    });
    
    // Try to find function name matches
    lib.functions.forEach(funcName => {
      const funcPattern = new RegExp(`function\\s+${funcName}\\s*\\(|${funcName}\\s*=\\s*function\\s*\\(|const\\s+${funcName}\\s*=`, 'g');
      let match;
      
      while ((match = funcPattern.exec(code)) !== null) {
        // Find the boundaries of the containing function or module
        const startPos = findFunctionStart(code, match.index);
        const endPos = findFunctionEnd(code, match.index);
        
        if (startPos !== -1 && endPos !== -1) {
          matches.push({
            library: lib.name,
            functionName: funcName,
            start: startPos,
            end: endPos,
            code: code.substring(startPos, endPos)
          });
        }
      }
    });
  });
  
  return matches;
}

// Find the start position of a function containing the given position
function findFunctionStart(code, pos) {
  // Look backward for the start of a function
  let i = pos;
  let braceCount = 0;
  let foundFunction = false;
  
  while (i >= 0) {
    // If we find 'function' keyword and brace count is 0, this might be our function start
    if (code.substring(i, i + 8) === 'function' && braceCount === 0) {
      // Look for the opening brace of the function
      let j = i + 8;
      while (j < code.length && code[j] !== '{') {
        j++;
      }
      
      if (j < code.length && code[j] === '{') {
        // This is a function declaration, return the position
        foundFunction = true;
        return i;
      }
    }
    
    // If we find a closing brace, increment the count (we're looking backward)
    if (code[i] === '}') {
      braceCount++;
    } 
    // If we find an opening brace, decrement the count
    else if (code[i] === '{') {
      braceCount--;
      
      // If we've balanced the braces, we've reached a potential function boundary
      if (braceCount === -1) {
        // Look backward for the function keyword
        let j = i - 1;
        let lookback = '';
        
        while (j >= 0 && j >= i - 100) {
          lookback = code[j] + lookback;
          j--;
          
          // If we find a function declaration pattern
          if (/function\s+\w+\s*\(|\w+\s*=\s*function\s*\(|const\s+\w+\s*=/.test(lookback)) {
            foundFunction = true;
            return j + 1;
          }
        }
        
        // If we can't find a function declaration, just return the brace position
        return i;
      }
    }
    
    i--;
  }
  
  // If we can't find a function start, return the current position
  return pos;
}

// Find the end position of a function containing the given position
function findFunctionEnd(code, pos) {
  // Find the first opening brace after the position
  let openBracePos = pos;
  while (openBracePos < code.length && code[openBracePos] !== '{') {
    openBracePos++;
  }
  
  if (openBracePos >= code.length) {
    return -1;
  }
  
  // Now track the brace depth to find the matching closing brace
  let braceCount = 1;
  let i = openBracePos + 1;
  
  while (i < code.length && braceCount > 0) {
    if (code[i] === '{') {
      braceCount++;
    } else if (code[i] === '}') {
      braceCount--;
    }
    
    i++;
  }
  
  // If we've found the matching brace, return this position
  if (braceCount === 0) {
    return i;
  }
  
  // Otherwise, couldn't find the end
  return -1;
}

// Find module boundaries (typically var X = function() {...})
function findModuleBoundaries(code) {
  const modulePattern = /var\s+([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$]+)\s*\(\s*(?:\(([A-Za-z0-9_$]+)\)|([A-Za-z0-9_$]+))\s*\)/g;
  const modules = [];
  let match;
  
  while ((match = modulePattern.exec(code)) !== null) {
    const startPos = match.index;
    
    // Find the end of this module
    // It usually ends with a closing parenthesis and semicolon: });
    let endPos = startPos;
    let braceCount = 0;
    let foundOpening = false;
    
    // First, find the opening brace of the module
    while (endPos < code.length) {
      if (code[endPos] === '{') {
        foundOpening = true;
        braceCount++;
        break;
      }
      endPos++;
    }
    
    if (!foundOpening) {
      continue;
    }
    
    // Now find the matching closing brace
    endPos++;
    while (endPos < code.length && braceCount > 0) {
      if (code[endPos] === '{') {
        braceCount++;
      } else if (code[endPos] === '}') {
        braceCount--;
      }
      endPos++;
    }
    
    // Find the closing parenthesis and semicolon: });
    while (endPos < code.length && code[endPos] !== ';') {
      endPos++;
    }
    
    if (endPos < code.length) {
      endPos++; // Include the semicolon
    }
    
    modules.push({
      name: match[1],
      functionName: match[2],
      argument: match[3] || match[4],
      start: startPos,
      end: endPos,
      code: code.substring(startPos, endPos)
    });
  }
  
  return modules;
}

// Identify business logic functions (functions with specific patterns that are not part of libraries)
function findBusinessLogicFunctions(code) {
  const businessPatterns = [
    // Anthropic API patterns
    /anthropic|claude/i,
    /tengu_/,
    /api_key/i,
    /\.beta\.messages\.create/,
    
    // Token management patterns
    /token|tokens/i,
    /input_tokens|output_tokens/,
    /cache_creation_input_tokens|cache_read_input_tokens/,
    
    // Rate limiting patterns
    /rate[-_]limit/i,
    /quota|usage/i,
    /rejected|allowed/,
    /resetsAt/,
    /anthropic-ratelimit/,
    
    // Tool patterns
    /tool_use/,
    /invocations/,
    /tengu_tool_input_json_normalized/
  ];
  
  const businessFunctions = [];
  
  // Find all function declarations
  const functionPattern = /function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/g;
  let match;
  
  while ((match = functionPattern.exec(code)) !== null) {
    const funcName = match[1];
    const startPos = match.index;
    
    // Find the end of this function
    let endPos = startPos;
    let braceCount = 0;
    let foundOpenBrace = false;
    
    // Find the opening brace
    while (endPos < code.length && !foundOpenBrace) {
      if (code[endPos] === '{') {
        foundOpenBrace = true;
        braceCount++;
      }
      endPos++;
    }
    
    if (!foundOpenBrace) {
      continue;
    }
    
    // Find the matching closing brace
    while (endPos < code.length && braceCount > 0) {
      if (code[endPos] === '{') {
        braceCount++;
      } else if (code[endPos] === '}') {
        braceCount--;
      }
      endPos++;
    }
    
    const functionCode = code.substring(startPos, endPos);
    
    // Check if this function matches any business logic patterns
    let isBusinessLogic = false;
    for (const pattern of businessPatterns) {
      if (pattern.test(functionCode)) {
        isBusinessLogic = true;
        break;
      }
    }
    
    // Don't include very small functions as they might be utility functions
    if (isBusinessLogic && functionCode.length > 100) {
      businessFunctions.push({
        name: funcName,
        start: startPos,
        end: endPos,
        code: functionCode,
        size: functionCode.length
      });
    }
  }
  
  return businessFunctions;
}

// Merge overlapping sections to avoid double-counting
function mergeOverlappingSections(sections) {
  if (sections.length === 0) {
    return [];
  }
  
  // Sort sections by start position
  sections.sort((a, b) => a.start - b.start);
  
  const merged = [sections[0]];
  
  for (let i = 1; i < sections.length; i++) {
    const current = sections[i];
    const previous = merged[merged.length - 1];
    
    // If current overlaps with previous
    if (current.start <= previous.end) {
      // Extend the previous section if needed
      previous.end = Math.max(previous.end, current.end);
      previous.libraries = [...new Set([...(previous.libraries || [previous.library]), ...(current.libraries || [current.library])])];
    } else {
      // No overlap, add as new section
      merged.push(current);
    }
  }
  
  return merged;
}

// Strip library code from the original code
function stripLibraryCode(code, librarySections, businessFunctions) {
  console.log('Stripping library code...');
  
  // Convert library sections to a format for merging
  const sections = librarySections.map(section => ({
    ...section,
    libraries: [section.library]
  }));
  
  // Merge overlapping sections
  const mergedSections = mergeOverlappingSections(sections);
  
  console.log(`Found ${mergedSections.length} library sections to remove`);
  
  // Build a map of what to keep (business logic) and what to remove (libraries)
  let strippedCode = '';
  let lastEnd = 0;
  
  // Sort the business functions by start position
  businessFunctions.sort((a, b) => a.start - b.start);
  
  // For each business function, check if it overlaps with any library section
  for (const func of businessFunctions) {
    let shouldKeep = true;
    
    // Check if this business function is contained within any library section
    for (const section of mergedSections) {
      if (func.start >= section.start && func.end <= section.end) {
        shouldKeep = false;
        break;
      }
    }
    
    if (shouldKeep) {
      // Add the code between the last end and this function's start
      if (func.start > lastEnd) {
        // But check if there's any library code in between
        let hasLibraryInBetween = false;
        for (const section of mergedSections) {
          if (section.start < func.start && section.end > lastEnd) {
            hasLibraryInBetween = true;
            break;
          }
        }
        
        if (!hasLibraryInBetween) {
          strippedCode += code.substring(lastEnd, func.start);
        }
      }
      
      // Add this function's code
      strippedCode += func.code;
      lastEnd = func.end;
    }
  }
  
  // Add any remaining business logic after the last function
  strippedCode += code.substring(lastEnd);
  
  return strippedCode;
}

// Main function to strip libraries
function stripLibraries(code) {
  console.log('Finding library sections...');
  const librarySections = findLibrarySections(code, librarySignatures);
  console.log(`Found ${librarySections.length} potential library sections`);
  
  console.log('Finding module boundaries...');
  const modules = findModuleBoundaries(code);
  console.log(`Found ${modules.length} potential modules`);
  
  console.log('Finding business logic functions...');
  const businessFunctions = findBusinessLogicFunctions(code);
  console.log(`Found ${businessFunctions.length} business logic functions`);
  
  // Create a report of what we found
  const reportFile = path.join(outputDir, 'library-report.md');
  let report = '# Library Code Analysis\n\n';
  
  // Library sections summary
  report += '## Library Sections\n\n';
  const libraryCounts = {};
  
  librarySections.forEach(section => {
    libraryCounts[section.library] = (libraryCounts[section.library] || 0) + 1;
  });
  
  report += '| Library | Count |\n';
  report += '|---------|-------|\n';
  
  Object.entries(libraryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([library, count]) => {
      report += `| ${library} | ${count} |\n`;
    });
  
  // Business logic functions summary
  report += '\n## Business Logic Functions\n\n';
  report += '| Function | Size |\n';
  report += '|----------|------|\n';
  
  businessFunctions
    .sort((a, b) => b.size - a.size)
    .slice(0, 50) // Show top 50 to keep the report manageable
    .forEach(func => {
      report += `| ${func.name} | ${func.size.toLocaleString()} |\n`;
    });
  
  // Module summary
  report += '\n## Potential Modules\n\n';
  report += '| Module | Function | Argument |\n';
  report += '|--------|----------|----------|\n';
  
  modules
    .slice(0, 50) // Show top 50 to keep the report manageable
    .forEach(module => {
      report += `| ${module.name} | ${module.functionName} | ${module.argument} |\n`;
    });
  
  fs.writeFileSync(reportFile, report);
  console.log(`Library analysis report written to ${reportFile}`);
  
  // Strip the library code to get just the business logic
  const strippedCode = stripLibraryCode(code, librarySections, businessFunctions);
  
  // Write the stripped code to the output file
  fs.writeFileSync(outputFile, strippedCode);
  console.log(`Stripped code written to ${outputFile} (${(strippedCode.length / 1024 / 1024).toFixed(2)} MB)`);
  
  // Calculate percentage of code removed
  const percentRemoved = ((code.length - strippedCode.length) / code.length) * 100;
  console.log(`Removed ${percentRemoved.toFixed(2)}% of the code`);
  
  return {
    originalSize: code.length,
    strippedSize: strippedCode.length,
    percentRemoved
  };
}

// Run the stripper
stripLibraries(code);