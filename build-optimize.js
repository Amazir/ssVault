const fs = require('fs');
const path = require('path');
const os = require('os');

function minimizeJsFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    let minimized = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}();,:=+\-*/<>])\s*/g, '$1')
      .trim();
    
    return minimized;
  } catch (error) {
    console.warn(`Failed to minimize ${filePath}:`, error.message);
    return null;
  }
}

function cleanBuildArtifacts() {
  try {
    const outDir = 'out';
    if (!fs.existsSync(outDir)) {
      console.log('No out directory found, skipping cleanup');
      return;
    }

    console.log('Cleaning build artifacts...');
    
    // Remove unnecessary files from build output
    function walkDirectory(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDirectory(filePath);
        } else {
          // Remove unnecessary files
          if (file.match(/\.(map|md|txt)$/) || file.includes('LICENSE') || file.includes('CHANGELOG')) {
            try {
              fs.rmSync(filePath, { force: true });
              console.log(`Removed: ${filePath}`);
            } catch (error) {
              console.warn(`Failed to remove ${filePath}:`, error.message);
            }
          }
        }
      }
    }
    
    walkDirectory(outDir);
    console.log('Build cleanup completed');
  } catch (error) {
    console.warn(`Failed to clean build artifacts: ${error.message}`);
  }
}

function optimizeAsar(asarPath) {
  try {
    // Skip ASAR optimization for now to avoid dependency issues
    console.log(`Skipping ASAR optimization for: ${asarPath}`);
  } catch (error) {
    console.warn(`Failed to optimize ASAR: ${error.message}`);
  }
}

// Main execution for GitHub Actions
if (require.main === module) {
  console.log('Running build optimizations...');
  
  // Clean build artifacts
  cleanBuildArtifacts();
  
  // Try to optimize ASAR files if they exist
  try {
    const outDir = 'out';
    if (fs.existsSync(outDir)) {
      function findAsarFiles(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            findAsarFiles(filePath);
          } else if (file.endsWith('.asar')) {
            optimizeAsar(filePath);
          }
        }
      }
      
      findAsarFiles(outDir);
    }
  } catch (error) {
    console.warn('ASAR optimization failed:', error.message);
  }
  
  console.log('Build optimization completed');
}

module.exports = {
  minimizeJsFile,
  optimizeAsar,
  cleanBuildArtifacts
};