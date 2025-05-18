# NexusMCP IP Access Control Guide

## Overview

This document provides comprehensive guidance on using the IP-based Access Control feature for OAuth2 clients in the NexusMCP platform. IP Access Control allows you to restrict API access to specific IP addresses and time windows, enhancing security for machine-to-machine integrations.

## Table of Contents

- [Benefits of IP Access Control](#benefits-of-ip-access-control)
- [IP Allowlist Management](#ip-allowlist-management)
- [Time-Based Restrictions](#time-based-restrictions)
- [Access Monitoring](#access-monitoring)
- [Auto-Revocation Features](#auto-revocation-features)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Benefits of IP Access Control

Implementing IP Access Control for OAuth2 clients provides multiple security benefits:

1. **Reduced Attack Surface**: Only allow connections from known, trusted IP addresses
2. **Defense in Depth**: Add an extra security layer beyond client credentials
3. **Temporal Security**: Restrict access to specific time windows
4. **Automatic Protection**: Configure automatic disabling of clients after suspicious activities
5. **Compliance Support**: Help meet regulatory requirements for access controls
6. **Audit Readiness**: Maintain detailed logs of all access attempts

## IP Allowlist Management

### Adding IP Addresses to Allowlist

You can add specific IPs or CIDR notation ranges to a client's allowlist:

**Endpoint:** `POST /api/oauth/ip-access/allowlist`

**Request Body:**

```json
{
  "clientId": 1,
  "ipAddress": "192.168.1.5",
  "description": "Development server"
}
```

You can also add CIDR ranges:

```json
{
  "clientId": 1,
  "ipAddress": "10.0.0.0/24",
  "description": "Corporate network"
}
```

### Removing IP Addresses from Allowlist

To remove an IP address from the allowlist:

**Endpoint:** `DELETE /api/oauth/ip-access/allowlist/{id}`

### Viewing IP Allowlist

To view all IP addresses in a client's allowlist:

**Endpoint:** `GET /api/oauth/ip-access/clients/{clientId}/allowlist`

### Enabling/Disabling IP Access Control

To toggle IP access control enforcement for a client:

**Endpoint:** `POST /api/oauth/ip-access/clients/{clientId}/toggle-ip-control`

**Request Body:**

```json
{
  "enforce": true
}
```

## Time-Based Restrictions

### Adding Time Restrictions

You can restrict client access to specific days of the week and time windows:

**Endpoint:** `POST /api/oauth/ip-access/time-restrictions`

**Request Body:**

```json
{
  "clientId": 1,
  "dayOfWeek": 1,   // 0 = Sunday, 1 = Monday, etc.
  "startTime": "09:00:00",
  "endTime": "17:00:00",
  "description": "Business hours only"
}
```

### Removing Time Restrictions

To remove a time restriction:

**Endpoint:** `DELETE /api/oauth/ip-access/time-restrictions/{id}`

### Viewing Time Restrictions

To view all time restrictions for a client:

**Endpoint:** `GET /api/oauth/ip-access/clients/{clientId}/time-restrictions`

### Enabling/Disabling Time Restrictions

To toggle time-based access control enforcement for a client:

**Endpoint:** `POST /api/oauth/ip-access/clients/{clientId}/toggle-time-control`

**Request Body:**

```json
{
  "enforce": true
}
```

## Access Monitoring

### Viewing Access Logs

You can view detailed logs of all access attempts:

**Endpoint:** `GET /api/oauth/ip-access/clients/{clientId}/logs`

**Query Parameters:**
- `limit`: Maximum number of logs to return (default: 100)
- `offset`: Offset for pagination (default: 0)
- `startDate`: Filter logs from this date/time (ISO format)
- `endDate`: Filter logs until this date/time (ISO format)
- `status`: Filter by access status (allowed, denied_ip, denied_time)

**Response:**

```json
{
  "logs": [
    {
      "id": 1,
      "clientId": 1,
      "tokenId": 123,
      "ipAddress": "192.168.1.5",
      "userAgent": "Integration Service/1.0",
      "requestPath": "/api/oauth/token",
      "accessStatus": "allowed",
      "timestamp": "2025-05-18T12:34:56.789Z",
      "details": null
    },
    {
      "id": 2,
      "clientId": 1,
      "tokenId": null,
      "ipAddress": "203.0.113.42",
      "userAgent": "Integration Service/1.0",
      "requestPath": "/api/oauth/token",
      "accessStatus": "denied_ip",
      "timestamp": "2025-05-18T13:45:12.456Z",
      "details": {
        "reason": "IP not in allowlist"
      }
    }
  ],
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

## Auto-Revocation Features

### Configuring Auto-Revocation

You can configure the system to automatically disable a client after a specified number of access violations:

**Endpoint:** `POST /api/oauth/ip-access/clients/{clientId}/auto-revocation`

**Request Body:**

```json
{
  "clientId": 1,
  "autoRevoke": true,
  "maxViolations": 5
}
```

When a client reaches the maximum number of violations, it will be disabled automatically and all its active tokens will be revoked.

### Resetting Violation Count

To reset the violation count for a client:

**Endpoint:** `POST /api/oauth/ip-access/clients/{clientId}/reset-violations`

## Best Practices

### IP Allowlist Management

1. **Limit IP Ranges**: Use the narrowest possible IP ranges for each client
2. **Document Purpose**: Always include a descriptive purpose when adding IPs
3. **Regular Review**: Review IP allowlists quarterly to remove unnecessary entries
4. **Change Management**: Implement a formal change process for adding/removing IPs

### Time Restrictions

1. **Business Hours**: For most integrations, limit access to business hours when support staff is available
2. **Maintenance Windows**: Create specific time windows for maintenance operations
3. **Overlapping Coverage**: Ensure critical services have appropriate time windows across time zones

### Security Monitoring

1. **Log Analysis**: Regularly review access logs for suspicious patterns
2. **Alert Configuration**: Set up alerts for repeated access denials
3. **Violation Tracking**: Monitor clients approaching their violation thresholds
4. **Forensic Readiness**: Maintain sufficient log history for incident investigation

## Troubleshooting

### Common Issues

1. **Unexpected Access Denials**:
   - Verify the client's IP address is in the allowlist
   - Check for unexpected IP changes (dynamic IPs, load balancers)
   - Verify time restrictions aren't preventing access

2. **Automatic Client Disabling**:
   - Review the access logs to identify the source of violations
   - Reset the violation count after addressing the issue
   - Consider increasing the maximum violation threshold for legitimate edge cases

3. **Missing or Incomplete Logs**:
   - Ensure the client is properly identifying itself in requests
   - Verify the authentication flow is completed correctly
   - Check for network issues preventing complete request logging

### Solutions

1. **For Access Denied Issues**:
   - Temporarily disable IP enforcement to determine if it's the cause
   - Add broader IP ranges if dealing with dynamic or NAT'd IPs
   - Implement a backup authentication mechanism for emergencies

2. **For Time Restriction Issues**:
   - Create overlapping time windows to account for edge cases
   - Consider time zone issues when setting restrictions
   - Use longer time windows for critical services

3. **For Auto-Revocation Issues**:
   - Increase the violation threshold for clients with legitimate variable access patterns
   - Implement pre-emptive alerts before reaching the threshold
   - Document the recovery process for automatically disabled clients