/**
 * NexusMCP OAuth2 Client Credentials Flow Example
 * 
 * This example demonstrates how to:
 * 1. Obtain an access token using the Client Credentials flow
 * 2. Use the token to access security scanner data
 * 3. Process and report on vulnerabilities
 */

const axios = require('axios');

// Configuration - Replace with your actual values
const config = {
  baseUrl: 'https://your-nexusmcp-instance.com',  // Replace with your actual NexusMCP URL
  clientId: 'mcp-a1b2c3d4e5f6-1621234567890',     // Replace with your client ID
  clientSecret: 'your_client_secret'               // Replace with your client secret
};

/**
 * Get an OAuth2 access token using the client credentials flow
 */
async function getAccessToken() {
  try {
    // Create form data for token request
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);
    params.append('scope', 'security:read');  // Request security:read scope
    
    // Make token request
    console.log('Requesting access token...');
    const response = await axios.post(`${config.baseUrl}/api/oauth/token`, params);
    
    console.log('Token obtained successfully');
    return response.data;
  } catch (error) {
    console.error('Error obtaining access token:');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get all security scanners
 */
async function getSecurityScanners(accessToken) {
  try {
    console.log('Fetching security scanners...');
    const response = await axios.get(`${config.baseUrl}/api/security/scanners`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching security scanners:');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get all scan targets
 */
async function getScanTargets(accessToken) {
  try {
    console.log('Fetching scan targets...');
    const response = await axios.get(`${config.baseUrl}/api/security/targets`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching scan targets:');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get scan results
 */
async function getScanResults(accessToken) {
  try {
    console.log('Fetching scan results...');
    const response = await axios.get(`${config.baseUrl}/api/security/scans`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching scan results:');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get vulnerabilities for a specific scan result
 */
async function getVulnerabilities(accessToken, scanId) {
  try {
    console.log(`Fetching vulnerabilities for scan ID: ${scanId}...`);
    const response = await axios.get(`${config.baseUrl}/api/security/scans/${scanId}/vulnerabilities`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching vulnerabilities for scan ID ${scanId}:`);
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * Generate a security report
 */
function generateSecurityReport(scanResults, vulnerabilities, scanners, targets) {
  // Map scanners and targets by ID for easy lookup
  const scannerMap = new Map(scanners.map(scanner => [scanner.id, scanner]));
  const targetMap = new Map(targets.map(target => [target.id, target]));
  
  console.log('\n========================================');
  console.log('SECURITY SCAN REPORT');
  console.log('========================================\n');
  
  // Report on each scan result
  scanResults.forEach(scan => {
    const scanner = scannerMap.get(scan.scannerId) || { name: 'Unknown Scanner' };
    const target = targetMap.get(scan.targetId) || { name: 'Unknown Target' };
    
    console.log(`Scan ID: ${scan.id}`);
    console.log(`Scanner: ${scanner.name} (${scanner.scannerType || 'Unknown Type'})`);
    console.log(`Target: ${target.name} (${target.targetType || 'Unknown Type'}: ${target.value || 'Unknown Value'})`);
    console.log(`Status: ${scan.status}`);
    console.log(`Start Time: ${new Date(scan.startTime).toLocaleString()}`);
    
    if (scan.endTime) {
      console.log(`End Time: ${new Date(scan.endTime).toLocaleString()}`);
    }
    
    if (scan.summary) {
      console.log('\nSummary:');
      Object.entries(scan.summary).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    // Get vulnerabilities for this scan
    const scanVulnerabilities = vulnerabilities.filter(v => v.scanResultId === scan.id);
    
    if (scanVulnerabilities.length > 0) {
      console.log('\nVulnerabilities:');
      
      // Group vulnerabilities by severity
      const severities = ['critical', 'high', 'medium', 'low'];
      severities.forEach(severity => {
        const sevVulns = scanVulnerabilities.filter(v => v.severity === severity);
        if (sevVulns.length > 0) {
          console.log(`\n  ${severity.toUpperCase()} (${sevVulns.length}):`);
          
          sevVulns.forEach((vuln, index) => {
            console.log(`    ${index + 1}. ${vuln.title}`);
            console.log(`       ${vuln.description}`);
            console.log(`       Location: ${vuln.location}`);
            if (vuln.cveId) {
              console.log(`       CVE: ${vuln.cveId}`);
            }
            console.log(`       Remediation: ${vuln.remediation}`);
            console.log(`       Status: ${vuln.status}`);
          });
        }
      });
    } else {
      console.log('\nNo vulnerabilities found.');
    }
    
    console.log('\n----------------------------------------\n');
  });
}

/**
 * Main function to run the example
 */
async function main() {
  try {
    // Step 1: Get an access token
    const tokenData = await getAccessToken();
    const accessToken = tokenData.access_token;
    
    console.log(`Token obtained. Expires in ${tokenData.expires_in} seconds.`);
    console.log(`Scope: ${tokenData.scope}`);
    
    // Step 2: Get security data using the token
    const scanners = await getSecurityScanners(accessToken);
    const targets = await getScanTargets(accessToken);
    const scanResults = await getScanResults(accessToken);
    
    console.log(`Found ${scanners.length} scanners, ${targets.length} targets, and ${scanResults.length} scan results.`);
    
    // Step 3: Get vulnerabilities for each scan
    let allVulnerabilities = [];
    for (const scan of scanResults) {
      const vulns = await getVulnerabilities(accessToken, scan.id);
      allVulnerabilities = [...allVulnerabilities, ...vulns];
    }
    
    console.log(`Found ${allVulnerabilities.length} total vulnerabilities.`);
    
    // Step 4: Generate a security report
    generateSecurityReport(scanResults, allVulnerabilities, scanners, targets);
    
  } catch (error) {
    console.error('An error occurred during execution:');
    console.error(error);
  }
}

// Run the example
main();

/**
 * RUNNING THE EXAMPLE:
 * 
 * 1. Install dependencies:
 *    npm install axios
 * 
 * 2. Replace configuration values at the top of the file
 * 
 * 3. Run the script:
 *    node oauth-client-example.js
 */