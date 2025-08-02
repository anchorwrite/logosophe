const fs = require('fs');
const path = require('path');

// Function to fix API route params
function fixApiRouteParams(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix params type from { params: { ... } } to { params: Promise<{ ... }> }
  const paramsRegex = /(\{ params \}: \{ params: \{ [^}]+ \} \})/g;
  content = content.replace(paramsRegex, (match, fullMatch) => {
    const newMatch = fullMatch.replace(
      /params: \{ ([^}]+) \}/,
      'params: Promise<{ $1 }>'
    );
    modified = true;
    return newMatch;
  });

  // Fix params destructuring from const { ... } = params; to const { ... } = await params;
  const destructuringRegex = /(const \{ [^}]+\} = params;)/g;
  content = content.replace(destructuringRegex, (match, fullMatch) => {
    const newMatch = fullMatch.replace('= params;', '= await params;');
    modified = true;
    return newMatch;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Find all API route files
function findApiRoutes(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findApiRoutes(fullPath));
    } else if (item === 'route.ts' || item === 'route.tsx') {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const apiDir = path.join(__dirname, 'app', 'api');
if (fs.existsSync(apiDir)) {
  const apiFiles = findApiRoutes(apiDir);
  console.log(`Found ${apiFiles.length} API route files`);
  
  for (const file of apiFiles) {
    fixApiRouteParams(file);
  }
  
  console.log('API route fixes completed!');
} else {
  console.log('API directory not found');
} 