const fs = require('fs');
const path = require('path');

// Function to convert relative imports to @ paths
function fixImportPaths(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Convert relative imports to @ paths
  const importReplacements = [
    // Common imports
    { from: "from 'auth'", to: "from '@/auth'" },
    { from: "from \"auth\"", to: "from '@/auth'" },
    { from: "from '../../../auth'", to: "from '@/auth'" },
    { from: "from '../../../../auth'", to: "from '@/auth'" },
    { from: "from '../../../../../auth'", to: "from '@/auth'" },
    { from: "from '../../../../../../auth'", to: "from '@/auth'" },
    
    // Common components
    { from: "from '../../../common/", to: "from '@/common/" },
    { from: "from '../../../../common/", to: "from '@/common/" },
    { from: "from '../../../../../common/", to: "from '@/common/" },
    { from: "from '../../../../../../common/", to: "from '@/common/" },
    
    // Lib imports
    { from: "from '../../../lib/", to: "from '@/lib/" },
    { from: "from '../../../../lib/", to: "from '@/lib/" },
    { from: "from '../../../../../lib/", to: "from '@/lib/" },
    { from: "from '../../../../../../lib/", to: "from '@/lib/" },
    
    // Components imports
    { from: "from '../../../components/", to: "from '@/components/" },
    { from: "from '../../../../components/", to: "from '@/components/" },
    { from: "from '../../../../../components/", to: "from '@/components/" },
    { from: "from '../../../../../../components/", to: "from '@/components/" },
    
    // Types imports
    { from: "from '../../../types/", to: "from '@/types/" },
    { from: "from '../../../../types/", to: "from '@/types/" },
    { from: "from '../../../../../types/", to: "from '@/types/" },
    { from: "from '../../../../../../types/", to: "from '@/types/" },
  ];

  for (const replacement of importReplacements) {
    if (content.includes(replacement.from)) {
      content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed imports in: ${filePath}`);
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
    fixImportPaths(file);
  }
  
  console.log('Import path fixes completed!');
} else {
  console.log('App directory not found');
} 