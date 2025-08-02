const fs = require('fs');
const path = require('path');

// Function to convert ../ imports to relative paths
function convertImports(content, filePath) {
  // Convert ../ imports to relative paths
  const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..'));
  
  // Replace ../ with relative path
  content = content.replace(/@\/g, relativePath + '/');
  
  // Clean up any double slashes
  content = content.replace(/\/\/g, '/');
  
  return content;
}

// Function to process a file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const convertedContent = convertImports(content, filePath);
    
    if (content !== convertedContent) {
      fs.writeFileSync(filePath, convertedContent);
      console.log(`Converted imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Function to recursively find all TypeScript/JavaScript files
function findFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Main execution
const workerDir = path.join(__dirname, '..');
const files = findFiles(workerDir);

console.log(`Found ${files.length} files to process`);

for (const file of files) {
  processFile(file);
}

console.log('Import conversion complete!'); 