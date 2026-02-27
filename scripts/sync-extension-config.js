const fs = require('fs');
const path = require('path');

// Determine which env file to use based on NODE_ENV or default to development
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : (env === 'uat' ? '.env.uat' : '.env.development');

const envPath = path.resolve(__dirname, '..', envFile);
const configPath = path.resolve(__dirname, '../src/screen-copilot-extension/config.js');

let apiUrl = 'http://127.0.0.1:8000';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^REACT_APP_API_URL=(.+)$/m);
  if (match) {
    apiUrl = match[1].trim();
  }
} else if (env !== 'development') {
    // Fallback to development if the specific env file is missing
    const devEnvPath = path.resolve(__dirname, '../.env.development');
    if (fs.existsSync(devEnvPath)) {
        const envContent = fs.readFileSync(devEnvPath, 'utf8');
        const match = envContent.match(/^REACT_APP_API_URL=(.+)$/m);
        if (match) {
          apiUrl = match[1].trim();
        }
    }
}

const content = `export const config = {
  API_BASE_URL: "${apiUrl}"
};
`;

fs.writeFileSync(configPath, content);
console.log(`Updated extension config for [${env}] environment with: ${apiUrl}`);
