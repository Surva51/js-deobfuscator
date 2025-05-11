const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Check if required packages are installed
try {
  require('@babel/parser');
  require('@babel/traverse');
  require('@babel/generator');
  require('@babel/types');
} catch (e) {
  console.error('Missing required packages. Run: npm install @babel/parser @babel/traverse @babel/generator @babel/types');
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace('.js', '-renamed.js');

// Common patterns for obfuscated variables
const singleLetterPattern = /^[A-Z]\d+$/; // Like A1, B2, etc.
const shortNamePattern = /^[a-zA-Z][A-Z]\d+$/; // Like aA1, bB2, etc.

// Semantic naming hints based on usage
const semanticHints = [
  { pattern: /\.prototype\./i, name: 'Class' },
  { pattern: /\.length/i, name: 'Array' },
  { pattern: /\.push\(/i, name: 'Array' },
  { pattern: /\.pop\(/i, name: 'Array' },
  { pattern: /\.slice\(/i, name: 'Array' },
  { pattern: /\.join\(/i, name: 'Array' },
  { pattern: /\.map\(/i, name: 'Array' },
  { pattern: /\.filter\(/i, name: 'Array' },
  { pattern: /\.reduce\(/i, name: 'Array' },
  { pattern: /\.forEach\(/i, name: 'Array' },
  { pattern: /\.keys\(/i, name: 'Object' },
  { pattern: /\.values\(/i, name: 'Object' },
  { pattern: /\.entries\(/i, name: 'Object' },
  { pattern: /\.hasOwnProperty\(/i, name: 'Object' },
  { pattern: /\.toString\(/i, name: 'Object' },
  { pattern: /\.addEventListener\(/i, name: 'Element' },
  { pattern: /\.removeEventListener\(/i, name: 'Element' },
  { pattern: /\.querySelector\(/i, name: 'Document' },
  { pattern: /\.getElementById\(/i, name: 'Document' },
  { pattern: /\.createElement\(/i, name: 'Document' },
  { pattern: /\.readFile/i, name: 'Fs' },
  { pattern: /\.writeFile/i, name: 'Fs' },
  { pattern: /\.join\(\)/i, name: 'Path' },
  { pattern: /\.resolve\(/i, name: 'Path' },
  { pattern: /\.basename\(/i, name: 'Path' },
  { pattern: /\.dirname\(/i, name: 'Path' },
  { pattern: /\.extname\(/i, name: 'Path' },
  { pattern: /\.post\(/i, name: 'Http' },
  { pattern: /\.get\(/i, name: 'Http' },
  { pattern: /\.send\(/i, name: 'Response' },
  { pattern: /\.json\(/i, name: 'Response' },
  { pattern: /\.status\(/i, name: 'Response' },
  { pattern: /\.exec\(/i, name: 'RegExp' },
  { pattern: /\.test\(/i, name: 'RegExp' },
  { pattern: /\.match\(/i, name: 'String' },
  { pattern: /\.replace\(/i, name: 'String' },
  { pattern: /\.split\(/i, name: 'String' },
  { pattern: /\.trim\(/i, name: 'String' },
  { pattern: /\.substr\(/i, name: 'String' },
  { pattern: /\.substring\(/i, name: 'String' },
  { pattern: /\.toLowerCase\(/i, name: 'String' },
  { pattern: /\.toUpperCase\(/i, name: 'String' },
  { pattern: /\.log\(/i, name: 'Console' },
  { pattern: /\.error\(/i, name: 'Console' },
  { pattern: /\.warn\(/i, name: 'Console' },
  { pattern: /\.info\(/i, name: 'Console' },
  { pattern: /\.debug\(/i, name: 'Console' },
  { pattern: /\.now\(/i, name: 'Date' },
  { pattern: /\.getTime\(/i, name: 'Date' },
  { pattern: /\.parse\(/i, name: 'JSON' },
  { pattern: /\.stringify\(/i, name: 'JSON' },
  { pattern: /\.random\(/i, name: 'Math' },
  { pattern: /\.floor\(/i, name: 'Math' },
  { pattern: /\.ceil\(/i, name: 'Math' },
  { pattern: /\.round\(/i, name: 'Math' },
  { pattern: /\.min\(/i, name: 'Math' },
  { pattern: /\.max\(/i, name: 'Math' },
  { pattern: /\.pow\(/i, name: 'Math' },
  { pattern: /\.sqrt\(/i, name: 'Math' },
  { pattern: /\.abs\(/i, name: 'Math' },
  { pattern: /\.sin\(/i, name: 'Math' },
  { pattern: /\.cos\(/i, name: 'Math' },
  { pattern: /\.tan\(/i, name: 'Math' },
];

function guessVariableType(code, varName) {
  for (const hint of semanticHints) {
    const regex = new RegExp(`${varName}${hint.pattern.source}`, 'i');
    if (regex.test(code)) {
      return hint.name;
    }
  }
  return null;
}

function renameVariables() {
  console.log(`Reading file: ${inputFile}`);
  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const code = fs.readFileSync(inputFile, 'utf8');
  
  console.log('Parsing code...');
  let ast;
  try {
    // Always try to parse as module first
    ast = parser.parse(code, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      plugins: ['jsx', 'typescript', 'classProperties']
    });
  } catch (error) {
    console.error('Error parsing code as module:', error.message);
    // Try parsing as script if module parsing fails
    console.log('Trying to parse as script...');
    try {
      ast = parser.parse(code, {
        sourceType: 'script',
        allowReturnOutsideFunction: true
      });
    } catch (error) {
      console.error('Error parsing code as script:', error.message);

      // Write the problematic code to a file for debugging
      const debugPath = inputFile + '.debug';
      fs.writeFileSync(debugPath, code);
      console.log(`Wrote problematic code to ${debugPath} for debugging`);

      // Just return the original code without renaming
      console.log('Skipping variable renaming for this file due to parsing errors');
      fs.writeFileSync(outputFile, code);
      process.exit(0);
    }
  }
  
  // Create a map of variable names to their new names
  const renameMap = new Map();
  let varCounter = 1;
  
  console.log('Analyzing variables...');
  
  // First pass: collect variables and make rename suggestions
  traverse(ast, {
    VariableDeclarator(path) {
      const name = path.node.id.name;
      
      // Only rename obfuscated-looking variable names
      if (singleLetterPattern.test(name) || shortNamePattern.test(name)) {
        const init = path.node.init;
        let newName;
        
        // Guess based on initialization
        if (init) {
          if (t.isStringLiteral(init)) {
            newName = `str_${varCounter++}`;
          } else if (t.isNumericLiteral(init)) {
            newName = `num_${varCounter++}`;
          } else if (t.isObjectExpression(init)) {
            newName = `obj_${varCounter++}`;
          } else if (t.isArrayExpression(init)) {
            newName = `arr_${varCounter++}`;
          } else if (t.isFunctionExpression(init) || t.isArrowFunctionExpression(init)) {
            newName = `fn_${varCounter++}`;
          } else if (t.isNewExpression(init)) {
            // Extract class name if possible
            const calleeName = init.callee.name;
            if (calleeName) {
              newName = `${calleeName.toLowerCase()}_${varCounter++}`;
            } else {
              newName = `instance_${varCounter++}`;
            }
          } else {
            // Try to guess from usage patterns
            const varType = guessVariableType(code, name);
            if (varType) {
              newName = `${varType.toLowerCase()}_${varCounter++}`;
            } else {
              newName = `var_${varCounter++}`;
            }
          }
        } else {
          // If no initialization, try to guess from usage
          const varType = guessVariableType(code, name);
          if (varType) {
            newName = `${varType.toLowerCase()}_${varCounter++}`;
          } else {
            newName = `var_${varCounter++}`;
          }
        }
        
        renameMap.set(name, newName);
      }
    },
    
    FunctionDeclaration(path) {
      const name = path.node.id.name;
      
      // Only rename obfuscated-looking function names
      if (singleLetterPattern.test(name) || shortNamePattern.test(name)) {
        renameMap.set(name, `func_${varCounter++}`);
      }
      
      // Also check function parameters
      path.node.params.forEach(param => {
        if (t.isIdentifier(param)) {
          const paramName = param.name;
          if (singleLetterPattern.test(paramName) || shortNamePattern.test(paramName)) {
            if (!renameMap.has(paramName)) {
              renameMap.set(paramName, `param_${varCounter++}`);
            }
          }
        }
      });
    },
    
    FunctionExpression(path) {
      // Check function parameters
      path.node.params.forEach(param => {
        if (t.isIdentifier(param)) {
          const paramName = param.name;
          if (singleLetterPattern.test(paramName) || shortNamePattern.test(paramName)) {
            if (!renameMap.has(paramName)) {
              renameMap.set(paramName, `param_${varCounter++}`);
            }
          }
        }
      });
    },
    
    ArrowFunctionExpression(path) {
      // Check function parameters
      path.node.params.forEach(param => {
        if (t.isIdentifier(param)) {
          const paramName = param.name;
          if (singleLetterPattern.test(paramName) || shortNamePattern.test(paramName)) {
            if (!renameMap.has(paramName)) {
              renameMap.set(paramName, `param_${varCounter++}`);
            }
          }
        }
      });
    }
  });
  
  console.log(`Identified ${renameMap.size} variables to rename`);
  
  // Second pass: rename variables
  traverse(ast, {
    Identifier(path) {
      const name = path.node.name;
      
      // Skip property names
      if (
        t.isMemberExpression(path.parent) && 
        path.parent.property === path.node && 
        !path.parent.computed
      ) {
        return;
      }
      
      // Skip import/export specifiers
      if (
        t.isImportSpecifier(path.parent) || 
        t.isExportSpecifier(path.parent)
      ) {
        return;
      }
      
      if (renameMap.has(name)) {
        path.node.name = renameMap.get(name);
      }
    }
  });
  
  console.log('Generating code...');
  const output = generate(ast, {
    retainLines: false,
    compact: false,
    comments: true
  }).code;
  
  console.log(`Writing renamed code to: ${outputFile}`);
  fs.writeFileSync(outputFile, output);
  
  // Write rename map for reference
  const mapFile = path.join(path.dirname(outputFile), '_rename-map.json');
  const mapObj = {};
  renameMap.forEach((value, key) => {
    mapObj[key] = value;
  });
  fs.writeFileSync(mapFile, JSON.stringify(mapObj, null, 2));
  console.log(`Wrote rename map to: ${mapFile}`);
  
  console.log('Done!');
}

if (inputFile) {
  renameVariables();
} else {
  console.error('Please provide an input file path');
  console.log('Usage: node variable-renamer.js <input-file> [output-file]');
  process.exit(1);
}