# NexusMCP Security Integration Guide

## Overview

This document provides comprehensive guidance on integrating with the NexusMCP platform's security features, specifically:

1. **Security Scanner System** - Enterprise-grade vulnerability detection and management
2. **OAuth2 Client Credentials Flow** - Secure machine-to-machine authentication

These features enable secure integration between your applications and the NexusMCP platform, following industry best practices and security standards.

## Table of Contents

- [OAuth2 Client Credentials Flow](#oauth2-client-credentials-flow)
  - [Client Registration](#client-registration)
  - [Obtaining Access Tokens](#obtaining-access-tokens)
  - [Using Access Tokens](#using-access-tokens)
  - [Token Validation](#token-validation)
  - [Token Revocation](#token-revocation)
- [Security Scanner Integration](#security-scanner-integration)
  - [Scanner Types](#scanner-types)
  - [Scan Targets](#scan-targets)
  - [Managing Scan Results](#managing-scan-results)
  - [Vulnerability Management](#vulnerability-management)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## OAuth2 Client Credentials Flow

The OAuth2 Client Credentials flow provides a secure way for services to authenticate with the NexusMCP platform without user interaction. This is ideal for machine-to-machine communication and automated integrations.

### Client Registration

Before you can use the OAuth2 Client Credentials flow, you need to register a client with the NexusMCP platform.

**Endpoint:** `POST /api/oauth/clients`

**Required Permissions:** Administrative access to NexusMCP platform

**Request Body:**

```json
{
  "clientName": "Integration Service",
  "description": "Service for automated security scanning",
  "grantTypes": ["client_credentials"],
  "scopes": ["security:read", "security:write"]
}
```

**Response:**

```json
{
  "id": 1,
  "clientId": "mcp-a1b2c3d4e5f6-1621234567890",
  "clientName": "Integration Service",
  "description": "Service for automated security scanning",
  "redirectUris": [],
  "grantTypes": ["client_credentials"],
  "scopes": ["security:read", "security:write"],
  "tokenEndpointAuthMethod": "client_secret_basic",
  "isEnabled": true,
  "createdAt": "2025-05-18T12:34:56.789Z",
  "updatedAt": "2025-05-18T12:34:56.789Z"
}
```

> **IMPORTANT:** The `clientSecret` is only returned during the initial client creation. Store it securely as it cannot be retrieved later.

### Obtaining Access Tokens

To obtain an access token for API access, use the token endpoint:

**Endpoint:** `POST /api/oauth/token`

**Request:**

```
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=mcp-a1b2c3d4e5f6-1621234567890&client_secret=your_client_secret&scope=security:read
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "security:read"
}
```

The access token is valid for the specified `expires_in` duration (in seconds).

### Using Access Tokens

To use the access token with NexusMCP APIs, include it in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Validation

To validate a token (check if it's active and get information about it):

**Endpoint:** `POST /api/oauth/introspect`

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**

```json
{
  "active": true,
  "client_id": "mcp-a1b2c3d4e5f6-1621234567890",
  "scope": "security:read",
  "exp": 1621267890
}
```

### Token Revocation

To explicitly revoke a token before its expiration:

**Endpoint:** `POST /api/oauth/revoke`

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "client_id": "mcp-a1b2c3d4e5f6-1621234567890",
  "client_secret": "your_client_secret"
}
```

## Security Scanner Integration

The Security Scanner feature provides comprehensive vulnerability detection and management capabilities.

### Scanner Types

NexusMCP supports several types of security scanners:

1. **Vulnerability Scanner** - Identifies network and system vulnerabilities
2. **Malware Scanner** - Detects malicious software and potential infections
3. **Container Scanner** - Scans container images for vulnerabilities
4. **Compliance Scanner** - Validates systems against regulatory requirements
5. **Code Scanner** - Analyzes source code for security issues

### Scan Targets

Scan targets represent resources that can be scanned:

1. **Servers** - Physical or virtual servers identified by IP address
2. **Databases** - Database servers with connection details
3. **Web Applications** - Web-based applications accessible via URL
4. **APIs** - API endpoints that need security validation
5. **Code Repositories** - Source code repositories for static analysis

### Managing Scan Results

#### Retrieving Scan Results

**Endpoint:** `GET /api/security/scans` (requires `security:read` scope)

**Response:**

```json
{
  "results": [
    {
      "id": 1,
      "scannerId": 1,
      "targetId": 1,
      "status": "completed",
      "startTime": "2025-05-18T10:00:00Z",
      "endTime": "2025-05-18T10:30:00Z",
      "summary": {
        "vulnerabilities": 3,
        "critical": 1,
        "high": 1,
        "medium": 1,
        "low": 0
      }
    }
  ]
}
```

#### Retrieving Vulnerabilities

**Endpoint:** `GET /api/security/scans/{scanId}/vulnerabilities` (requires `security:read` scope)

**Response:**

```json
{
  "vulnerabilities": [
    {
      "id": 1,
      "scanResultId": 1,
      "title": "OpenSSL Heartbleed Vulnerability",
      "description": "The OpenSSL TLS/DTLS heartbeat extension is vulnerable to memory disclosure.",
      "severity": "critical",
      "cvssScore": "7.5",
      "cveId": "CVE-2014-0160",
      "location": "Port 443 - OpenSSL 1.0.1e",
      "remediation": "Update OpenSSL to version 1.0.1g or later",
      "status": "open",
      "details": {
        "affected_versions": ["1.0.1", "1.0.1a", "1.0.1b", "1.0.1c", "1.0.1d", "1.0.1e"],
        "references": ["https://heartbleed.com/", "https://nvd.nist.gov/vuln/detail/CVE-2014-0160"]
      }
    }
  ]
}
```

### Vulnerability Management

#### Updating Vulnerability Status

**Endpoint:** `PATCH /api/security/vulnerabilities/{id}` (requires `security:write` scope)

**Request Body:**

```json
{
  "status": "in_progress",
  "notes": "Working on patching affected systems"
}
```

## Best Practices

### OAuth2 Security

1. **Store Client Secrets Securely** - Never hardcode secrets in source code or expose them in client-side applications
2. **Use Minimum Required Scopes** - Request only the scopes your application needs
3. **Implement Token Refresh** - Refresh tokens before they expire to maintain uninterrupted service
4. **Validate Tokens** - Always validate tokens on the server side
5. **Revoke Unused Tokens** - When a service is decommissioned, revoke its tokens

### Security Scanner Integration

1. **Regular Scanning** - Schedule scans to run at regular intervals
2. **Prioritize Vulnerabilities** - Address critical and high severity issues first
3. **Track Remediation** - Document and track remediation efforts
4. **Validate Fixes** - Re-scan after applying fixes to verify vulnerabilities are resolved
5. **Integrate with CI/CD** - Automate security scanning in your CI/CD pipeline

## Troubleshooting

### Common OAuth2 Issues

1. **Invalid Client Credentials** - Verify client ID and secret are correct
2. **Insufficient Scopes** - Check that your client has the required scopes
3. **Token Expired** - Request a new token if the current one is expired
4. **Rate Limiting** - Respect rate limits for token requests (30 requests per minute)

### Security Scanner Issues

1. **Scan Failures** - Check scan target accessibility and network connectivity
2. **False Positives** - Review and mark false positives to improve scan accuracy
3. **Integration Errors** - Validate API requests and authentication

## API Example: Integrated Security Monitoring

Here's an example of how to integrate the OAuth2 Client Credentials flow with the Security Scanner API:

```javascript
// Node.js example
const axios = require('axios');

// Configuration
const config = {
  baseUrl: 'https://your-nexusmcp-instance.com',
  clientId: 'mcp-a1b2c3d4e5f6-1621234567890',
  clientSecret: 'your_client_secret'
};

// Get OAuth token
async function getToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);
  params.append('scope', 'security:read');
  
  const response = await axios.post(`${config.baseUrl}/api/oauth/token`, params);
  return response.data.access_token;
}

// Get security scan results
async function getScanResults() {
  const token = await getToken();
  
  const response = await axios.get(`${config.baseUrl}/api/security/scans`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.data;
}

// Get vulnerabilities for a specific scan
async function getVulnerabilities(scanId) {
  const token = await getToken();
  
  const response = await axios.get(`${config.baseUrl}/api/security/scans/${scanId}/vulnerabilities`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.data;
}

// Example usage
async function main() {
  try {
    // Get all scan results
    const scanResults = await getScanResults();
    console.log(`Found ${scanResults.results.length} scan results`);
    
    // Get vulnerabilities for the first scan
    if (scanResults.results.length > 0) {
      const scanId = scanResults.results[0].id;
      const vulnerabilities = await getVulnerabilities(scanId);
      
      console.log(`Found ${vulnerabilities.length} vulnerabilities:`);
      
      // Process critical vulnerabilities
      const criticalVulnerabilities = vulnerabilities.filter(v => v.severity === 'critical');
      criticalVulnerabilities.forEach(v => {
        console.log(`CRITICAL: ${v.title} - ${v.cveId || 'No CVE'}`);
        console.log(`  Location: ${v.location}`);
        console.log(`  Remediation: ${v.remediation}`);
        console.log('---');
      });
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
```

This integration allows for automated security monitoring, enabling timely notification and response to security issues.