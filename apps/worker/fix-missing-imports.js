const fs = require('fs');
const path = require('path');

// Function to fix missing getCloudflareContext imports
function fixMissingImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file uses getCloudflareContext but doesn't import it
  if (content.includes('getCloudflareContext') && !content.includes('import { getCloudflareContext }')) {
    // Find the first import line to add after it
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      // Find the line after the last import
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex !== -1) {
        // Add the import after the last import line
        lines.splice(lastImportIndex + 1, 0, "import { getCloudflareContext } from '@opennextjs/cloudflare';");
        content = lines.join('\n');
        modified = true;
        console.log(`Fixed missing import in: ${filePath}`);
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

// Find all TypeScript/TSX files
function findTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const appDir = path.join(__dirname, 'app');
if (fs.existsSync(appDir)) {
  const tsFiles = findTsFiles(appDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  for (const file of tsFiles) {
    fixMissingImports(file);
  }
  
  console.log('Import fixes completed!');
} else {
  console.log('App directory not found');
} 