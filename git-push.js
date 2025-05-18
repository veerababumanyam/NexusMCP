/**
 * Script to initialize Git and push to GitHub
 * Run this with: node git-push.js
 */

import { execSync } from 'child_process';
const username = 'veerababumanyam'; // GitHub username
const repoName = 'NexusMCP'; // Repository name
const branch = 'main'; // Branch name

// Function to execute commands and log output
function run(command) {
  console.log(`Executing: ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    return output;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    // Check if token exists
    if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
      console.error('Error: GITHUB_PERSONAL_ACCESS_TOKEN environment variable is not set');
      process.exit(1);
    }
    
    // Initialize Git if not already initialized
    try {
      run('git status');
      console.log('Git repository is already initialized');
    } catch (error) {
      console.log('Initializing Git repository...');
      run('git init');
    }

    // Configure Git
    run('git config --local user.name "NexusMCP User"');
    run('git config --local user.email "user@nexusmcp.com"');
    
    // Stage all files
    run('git add .');

    // Commit changes
    run('git commit -m "Initial commit - version 0.0.1"');

    // Create remote with token for authentication
    const tokenUrl = `https://${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${username}/${repoName}.git`;
    
    // Check if remote exists, add if not
    try {
      run('git remote -v');
      run('git remote remove origin');
    } catch (error) {
      console.log('No remote yet, adding...');
    }
    
    run(`git remote add origin ${tokenUrl}`);
    
    // Push to GitHub
    console.log('Pushing to GitHub...');
    run(`git push -u origin ${branch}`);
    
    console.log('Successfully pushed to GitHub!');
    console.log(`Your repository is available at: https://github.com/${username}/${repoName}`);
  } catch (error) {
    console.error('Error in Git push script:', error.message);
    process.exit(1);
  }
}

main();