const fs = require('fs');
const path = require('path');

// Function to fix Cloudflare context usage
function fixCloudflareContext(content, filePath) {
  let modified = false;
  
  // Replace import statements
  if (content.includes('import { getRequestContext } from \'@cloudflare/next-on-pages\'')) {
    content = content.replace(
      'import { getRequestContext } from \'@cloudflare/next-on-pages\'',
      'import { getCloudflareContext } from \'@opennextjs/cloudflare\''
    );
    modified = true;
  }
  
  // Replace await getCloudflareContext({async: true}) calls with getCloudflareContext({async: true})
  if (content.includes('await getCloudflareContext({async: true})')) {
    content = content.replace(/getRequestContext\(\)/g, 'await getCloudflareContext({async: true})');
    modified = true;
  }
  
  // Replace await getCloudflareContext({async: true}).env with getCloudflareContext({async: true}).env
  if (content.includes('await getCloudflareContext({async: true}).env')) {
    content = content.replace(/getRequestContext\(\)\.env/g, 'await getCloudflareContext({async: true}).env');
    modified = true;
  }
  
  return { content, modified };
}

// Function to process a file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: convertedContent, modified } = fixCloudflareContext(content, filePath);
    
    if (modified) {
      fs.writeFileSync(filePath, convertedContent);
      console.log(`Fixed Cloudflare context in: ${filePath}`);
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

console.log('Cloudflare context conversion complete!'); 