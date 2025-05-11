const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Transform } = require('stream');
const prettier = require('prettier');

const inputFile = process.argv[2] || path.join(__dirname, '../cli.js');
const outputFile = process.argv[3] || path.join(__dirname, '../prettified/cli-pretty.js');

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create simple line prettifier transform stream
class LinePrettifier extends Transform {
  constructor(options) {
    super(options);
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    // Add chunk to buffer
    this.buffer += chunk.toString();

    // Process lines that end with semicolons
    const lines = this.buffer.split(';');

    // Keep the last line in the buffer (which might be incomplete)
    const lastLine = lines.pop();
    this.buffer = lastLine || '';

    // Process and push complete lines
    for (const line of lines) {
      // Prettify each line
      const prettyLine = simplePrettifyLine(line);
      this.push(prettyLine + ';\n');
    }

    callback();
  }

  _flush(callback) {
    // Process any remaining content in the buffer
    if (this.buffer) {
      const prettyLine = simplePrettifyLine(this.buffer);
      this.push(prettyLine);
    }
    callback();
  }
}

// Simple line prettifier
function simplePrettifyLine(line) {
  // Add newlines after braces
  let prettyLine = line.replace(/{/g, '{\n  ');
  prettyLine = prettyLine.replace(/}/g, '\n}');

  // Add spacing after commas
  prettyLine = prettyLine.replace(/,/g, ', ');

  // Add spacing around operators
  prettyLine = prettyLine.replace(/([=+\-*/<>])/g, ' $1 ');

  // Fix double spaces
  prettyLine = prettyLine.replace(/\s+/g, ' ');

  return prettyLine.trim();
}

// More comprehensive prettifier for chunks
function simplePrettify(code) {
  // Replace ; with ;\n to break up lines
  let formatted = code.replace(/;/g, ';\n');

  // Add newlines after braces
  formatted = formatted.replace(/{/g, '{\n');
  formatted = formatted.replace(/}/g, '}\n');

  // Add newlines after commas in reasonable places
  formatted = formatted.replace(/,(?=\s*[a-zA-Z0-9_$])/g, ',\n');

  return formatted;
}

// Chunk-based prettification for large files
async function prettifyInChunks() {
  console.log(`Processing file in chunks: ${inputFile}`);

  // Get file size to show progress
  const stats = fs.statSync(inputFile);
  const fileSize = stats.size;
  console.log(`File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

  // Stream approach
  const readStream = fs.createReadStream(inputFile);
  const writeStream = fs.createWriteStream(outputFile);
  const transformer = new LinePrettifier();

  // Pipe everything together
  readStream.pipe(transformer).pipe(writeStream);

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('Finished processing file in chunks');
      resolve();
    });

    writeStream.on('error', (error) => {
      console.error('Error processing file:', error.message);
      reject(error);
    });
  });
}

// Main function
async function prettify() {
  try {
    // For large files, use the chunk-based approach
    await prettifyInChunks();
    console.log('Done!');
  } catch (error) {
    console.error('Error during prettification:', error.message);
    process.exit(1);
  }
}

prettify().catch(console.error);