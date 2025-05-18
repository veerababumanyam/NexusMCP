# OAuth2 Token Rotation and Security Monitoring Guide

## Overview

This document explains how to use the OAuth2 Token Rotation and Security Monitoring features in the NexusMCP platform. These features provide enterprise-grade security for your OAuth2 clients by enforcing credential rotation policies, monitoring for suspicious activities, and providing comprehensive audit capabilities.

## Table of Contents

- [Benefits of Token Rotation](#benefits-of-token-rotation)
- [Managing Client Credentials](#managing-client-credentials)
- [Configuring Rotation Policies](#configuring-rotation-policies)
- [Monitoring Token Usage](#monitoring-token-usage)
- [Security Event Management](#security-event-management)
- [Configuring Notifications](#configuring-notifications)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Benefits of Token Rotation

Regular rotation of OAuth2 client credentials provides multiple security benefits:

1. **Limit Exposure**: Regular rotation minimizes the impact of compromised credentials
2. **Audit Trail**: Each rotation is tracked with timestamps and reasons
3. **Compliance**: Meet regulatory requirements for credential lifecycle management
4. **Automated Enforcement**: Configure automated expiration policies with reminders
5. **Security Events**: Generate security alerts for suspicious activities
6. **Usage Monitoring**: Track and analyze token usage patterns

## Managing Client Credentials

### Initial Client Secret Creation

When you create a new OAuth2 client, the system automatically generates a strong client secret for you. The secret is only displayed once during creation and follows a structured format for easy identification:

```
mcp-secret-{uuid}-{random}
```

For example: `mcp-secret-12345678-abcd-1234-5678-1234567890ab-0123456789abcdef`

### Manual Secret Rotation

You can manually rotate a client's secret at any time:

**Endpoint:** `POST /api/oauth/token-rotation/rotate`

**Request Body:**

```json
{
  "clientId": 1,
  "reason": "Scheduled quarterly rotation"
}
```

**Response:**

```json
{
  "message": "Client secret rotated successfully",
  "clientId": 1,
  "secretLastRotatedAt": "2025-05-18T12:34:56.789Z",
  "clientSecret": "mcp-secret-12345678-abcd-1234-5678-1234567890ab-0123456789abcdef"
}
```

> **IMPORTANT:** The client secret is only returned once during rotation. Store it securely as it cannot be retrieved later.

### Viewing Secret History

You can view the history of client secret rotations, including when they were created and expired:

**Endpoint:** `GET /api/oauth/token-rotation/clients/{clientId}/secret-history`

This provides an audit trail of all credential changes for compliance purposes.

## Configuring Rotation Policies

### Setting Rotation Policy

You can configure automated credential rotation policies for OAuth2 clients:

**Endpoint:** `POST /api/oauth/token-rotation/policy`

**Request Body:**

```json
{
  "clientId": 1,
  "requireRotation": true,
  "rotationPeriodDays": 90,
  "rotationNotificationDays": 15
}
```

Parameters:

- `requireRotation`: Whether to enforce credential rotation
- `rotationPeriodDays`: How often credentials must be rotated (1-365 days)
- `rotationNotificationDays`: When to start sending expiration notifications (1-90 days before expiry)

When a rotation policy is applied:

1. The system calculates the expiration date based on the last rotation date (or creation date for new clients)
2. As the expiration date approaches, security events are generated with increasing severity
3. If enabled in notification settings, users receive alerts about expiring credentials

### Checking Expiring Credentials

Administrators can manually check for expiring credentials:

**Endpoint:** `GET /api/oauth/token-rotation/check-expiring`

This returns information about credentials that are nearing their expiration date or have already expired.

## Monitoring Token Usage

### Viewing Token Usage Statistics

You can monitor token usage patterns for each client:

**Endpoint:** `GET /api/oauth/token-rotation/clients/{clientId}/usage`

**Query Parameters:**
- `startDate`: Filter statistics from this date (ISO format)
- `endDate`: Filter statistics until this date (ISO format)

**Response:**

```json
{
  "dailyStats": [
    {
      "date": "2025-05-18",
      "tokenRequests": 120,
      "tokenDenials": 5,
      "apiRequests": 1500,
      "uniqueIps": 3
    },
    {
      "date": "2025-05-17",
      "tokenRequests": 115,
      "tokenDenials": 3,
      "apiRequests": 1450,
      "uniqueIps": 3
    }
  ],
  "summary": {
    "totalRequests": 235,
    "totalDenials": 8,
    "totalApiRequests": 2950,
    "maxDailyRequests": 120,
    "maxDailyDenials": 5,
    "maxDailyApiRequests": 1500,
    "daysInPeriod": 2,
    "denialRate": 0.034
  }
}
```

The system automatically tracks:

- **Token Requests**: Number of token issuance requests
- **Token Denials**: Number of denied token requests
- **API Requests**: Number of API calls using valid tokens
- **Unique IPs**: Number of unique IP addresses making requests

### Automated Detection of Anomalies

The system automatically analyzes token usage patterns to detect potential security issues:

1. **Abnormal Request Volume**: Significant increases in token requests compared to historical patterns
2. **High Denial Rates**: Unusual increases in token request denials
3. **Off-hours Activity**: Activity outside normal business hours or expected time windows
4. **Geographic Anomalies**: Access from unexpected geographic regions

When anomalies are detected, security events are generated with appropriate severity levels.

## Security Event Management

### Viewing Security Events

You can view security events for a client:

**Endpoint:** `GET /api/oauth/token-rotation/clients/{clientId}/events`

**Query Parameters:**
- `limit`: Maximum number of events to return (default: 100)
- `offset`: Offset for pagination (default: 0)
- `startDate`: Filter events from this date (ISO format)
- `endDate`: Filter events until this date (ISO format)
- `severity`: Filter by severity (info, warning, critical)
- `eventType`: Filter by event type
- `includeResolved`: Whether to include resolved events (default: false)

**Response:**

```json
{
  "events": [
    {
      "id": 1,
      "clientId": 1,
      "eventType": "rotation_reminder",
      "eventTime": "2025-05-18T12:34:56.789Z",
      "severity": "warning",
      "description": "Client credentials will expire in 5 days",
      "details": {
        "daysUntilExpiry": 5,
        "expiresAt": "2025-05-23T12:34:56.789Z",
        "lastRotatedAt": "2025-02-23T12:34:56.789Z"
      },
      "resolvedAt": null,
      "resolvedBy": null,
      "resolutionNotes": null
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

### Common Event Types

The system generates various types of security events:

1. **rotation_reminder**: Notification about credentials nearing expiration
2. **credential_expired**: Alert that credentials have expired
3. **credential_rotation**: Record of a credential rotation event
4. **abnormal_token_requests**: Unusual increase in token requests
5. **high_denial_rate**: Abnormally high token request denial rate
6. **high_api_usage**: Sustained high API usage
7. **ip_violation**: IP access violation based on allowlist restrictions

### Resolving Security Events

When a security event has been reviewed and addressed, you can mark it as resolved:

**Endpoint:** `POST /api/oauth/token-rotation/events/resolve`

**Request Body:**

```json
{
  "id": 1,
  "notes": "Verified legitimate increase in API usage due to new integration project"
}
```

Resolved events provide an audit trail of security responses and actions taken.

## Configuring Notifications

### Setting Notification Preferences

Users can configure how they want to be notified about security events:

**Endpoint:** `POST /api/oauth/token-rotation/notifications`

**Request Body:**

```json
{
  "notifyCredentialExpiry": true,
  "notifySuspiciousActivity": true,
  "notifyClientDisabled": true,
  "emailNotifications": true,
  "dashboardNotifications": true,
  "webhookUrl": "https://your-monitoring-system.com/webhooks/oauth-events"
}
```

### Notification Channels

The system supports multiple notification channels:

1. **Email Notifications**: Send alerts to the user's registered email
2. **Dashboard Notifications**: Display alerts in the NexusMCP dashboard
3. **Webhook Notifications**: Send events to external monitoring systems

### Webhook Payload Format

Webhook notifications use the following format:

```json
{
  "event_type": "oauth_security_event",
  "severity": "warning",
  "description": "Client credentials will expire in 5 days",
  "event_time": "2025-05-18T12:34:56.789Z",
  "details": {
    "daysUntilExpiry": 5,
    "expiresAt": "2025-05-23T12:34:56.789Z",
    "lastRotatedAt": "2025-02-23T12:34:56.789Z"
  },
  "event_id": 1
}
```

## Best Practices

### Credential Management

1. **Regular Rotation**: Set appropriate rotation periods based on your security needs
   - High-security environments: 30-60 days
   - Standard environments: 90 days
   - Low-risk environments: 180 days

2. **Secure Storage**: Store client secrets securely using appropriate secret management systems

3. **Automatic Updates**: Implement automatic client secret updates in your integrations

4. **Emergency Rotation**: Be prepared to immediately rotate credentials in case of a security incident

### Monitoring and Alerting

1. **Review Alerts Promptly**: Establish a process for timely review of security events

2. **Baseline Establishment**: Define normal usage patterns to improve anomaly detection

3. **Regular Audit**: Review token usage statistics monthly to identify trends and potential issues

4. **Documentation**: Document responses to security events for compliance and process improvement

### Integration Design

1. **Graceful Handling**: Design integrations to handle credential rotation gracefully

2. **Automatic Reconnection**: Implement automatic reconnection logic when tokens are invalid

3. **Circuit Breakers**: Use circuit breakers to prevent excessive failed authentication attempts

4. **Monitoring Instrumentation**: Add instrumentation to track token usage and performance

## Troubleshooting

### Common Issues

1. **Unexpected Token Denials**:
   - Verify client ID and secret are correct
   - Check if the client secret has expired and needs rotation
   - Ensure the client hasn't been disabled due to security violations

2. **Missing Notifications**:
   - Verify notification settings are properly configured
   - Check spam folders for email notifications
   - Validate webhook endpoint is accessible and correctly configured

3. **Excessive Security Events**:
   - Review your usage patterns and adjust thresholds if necessary
   - Consider implementing more gradual scaling for legitimate usage increases
   - Document expected usage patterns and mark related events as resolved