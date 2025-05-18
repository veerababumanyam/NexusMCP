/**
 * GeoIP Service
 * 
 * Provides geographic information lookup for IP addresses to support:
 * - Geofencing / geographic access control
 * - Fraud detection
 * - Compliance with regional data regulations
 * - User experience customization
 */

import { createHash } from 'crypto';

interface GeoData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  organization?: string;
  asn?: string;
  threat?: {
    isTor?: boolean;
    isProxy?: boolean;
    isVpn?: boolean;
    isHosting?: boolean;
    threatLevel?: 'low' | 'medium' | 'high';
    threatTypes?: string[];
  };
}

/**
 * Service for IP-based geolocation lookups
 */
export class GeoIpService {
  private cache: Map<string, { data: GeoData, timestamp: number }> = new Map();
  private cacheLifetime: number = 24 * 60 * 60 * 1000; // 24 hours
  
  constructor() {
    // Cleanup task for expired cache entries
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000); // Every hour
    
    console.log('GeoIP Service initialized');
  }
  
  /**
   * Get geographical information for an IP address
   */
  public async getGeoData(ipAddress: string): Promise<GeoData | null> {
    if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
      return {
        country: 'Local',
        region: 'Local',
        city: 'Localhost'
      };
    }
    
    // Check cache first
    const cacheKey = ipAddress;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheLifetime) {
      return cached.data;
    }
    
    // In a real implementation, this would call an external GeoIP service
    // For demo purposes, we'll generate deterministic but fake data
    const geoData = this.generateDemoGeoData(ipAddress);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: geoData,
      timestamp: Date.now()
    });
    
    return geoData;
  }
  
  /**
   * Generate demo geo data for testing/demo purposes
   */
  private generateDemoGeoData(ipAddress: string): GeoData {
    // Generate a deterministic hash from the IP to get consistent demo data
    const hash = createHash('md5').update(ipAddress).digest('hex');
    
    // Use the hash to generate country codes (just for demo purposes)
    const countryCodes = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'JP', 'BR', 'IN', 'SG'];
    const countryIndex = parseInt(hash.substring(0, 2), 16) % countryCodes.length;
    const country = countryCodes[countryIndex];
    
    // Regions
    const regions: { [key: string]: string[] } = {
      'US': ['California', 'New York', 'Texas', 'Florida', 'Washington'],
      'GB': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      'DE': ['Bavaria', 'Berlin', 'Hamburg', 'Hesse', 'North Rhine-Westphalia'],
      'FR': ['Île-de-France', 'Provence-Alpes-Côte d\'Azur', 'Occitanie', 'Auvergne-Rhône-Alpes'],
      'CA': ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
      'AU': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia'],
      'JP': ['Tokyo', 'Osaka', 'Kanagawa', 'Aichi', 'Hokkaido'],
      'BR': ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia'],
      'IN': ['Maharashtra', 'Tamil Nadu', 'Karnataka', 'Delhi', 'Gujarat'],
      'SG': ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region']
    };
    
    const regionIndex = parseInt(hash.substring(2, 4), 16) % regions[country].length;
    const region = regions[country][regionIndex];
    
    // Cities
    const cities: { [key: string]: string[] } = {
      'California': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
      'New York': ['New York City', 'Buffalo', 'Rochester', 'Syracuse'],
      'England': ['London', 'Manchester', 'Birmingham', 'Liverpool'],
      'Berlin': ['Berlin'],
      'Bavaria': ['Munich', 'Nuremberg', 'Augsburg'],
      'Ontario': ['Toronto', 'Ottawa', 'Hamilton'],
      'New South Wales': ['Sydney', 'Newcastle', 'Wollongong'],
      'Tokyo': ['Tokyo', 'Yokohama'],
      'São Paulo': ['São Paulo', 'Campinas', 'Guarulhos'],
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur'],
      'Central Region': ['Singapore Central']
    };
    
    const citiesForRegion = cities[region] || [`${region} City`];
    const cityIndex = parseInt(hash.substring(4, 6), 16) % citiesForRegion.length;
    const city = citiesForRegion[cityIndex];
    
    // Generate "random" but deterministic lat/long
    const latBase = {
      'US': 37, 'GB': 54, 'DE': 51, 'FR': 48, 'CA': 56,
      'AU': -25, 'JP': 36, 'BR': -15, 'IN': 20, 'SG': 1.3
    };
    const longBase = {
      'US': -100, 'GB': -2, 'DE': 10, 'FR': 2, 'CA': -106,
      'AU': 134, 'JP': 138, 'BR': -47, 'IN': 77, 'SG': 103.8
    };
    
    const latOffset = (parseInt(hash.substring(6, 10), 16) % 1000) / 100;
    const longOffset = (parseInt(hash.substring(10, 14), 16) % 1000) / 100;
    
    const latitude = latBase[country] + latOffset - 5;
    const longitude = longBase[country] + longOffset - 5;
    
    // Generate threat intelligence (for demo)
    const threatScore = parseInt(hash.substring(14, 16), 16) % 100;
    const isTor = threatScore > 90;
    const isProxy = !isTor && threatScore > 80;
    const isVpn = !isTor && !isProxy && threatScore > 70;
    const isHosting = threatScore > 60;
    
    let threatLevel: 'low' | 'medium' | 'high' = 'low';
    if (threatScore > 80) {
      threatLevel = 'high';
    } else if (threatScore > 50) {
      threatLevel = 'medium';
    }
    
    const threatTypes = [];
    if (isTor) threatTypes.push('tor');
    if (isProxy) threatTypes.push('proxy');
    if (isVpn) threatTypes.push('vpn');
    if (isHosting) threatTypes.push('hosting');
    if (threatScore > 85) threatTypes.push('malicious_activity');
    if (threatScore > 75 && threatScore < 85) threatTypes.push('suspicious_activity');
    
    // Create the GeoData object
    return {
      country,
      region,
      city,
      latitude,
      longitude,
      timezone: this.getTimezoneForCountry(country),
      isp: this.getRandomIsp(hash),
      organization: this.getRandomOrg(hash),
      asn: `AS${parseInt(hash.substring(16, 20), 16) % 65535}`,
      threat: {
        isTor,
        isProxy,
        isVpn,
        isHosting,
        threatLevel,
        threatTypes: threatTypes.length > 0 ? threatTypes : undefined
      }
    };
  }
  
  /**
   * Get a timezone for a country (demo data)
   */
  private getTimezoneForCountry(country: string): string {
    const timezones: { [key: string]: string } = {
      'US': 'America/Los_Angeles',
      'GB': 'Europe/London',
      'DE': 'Europe/Berlin',
      'FR': 'Europe/Paris',
      'CA': 'America/Toronto',
      'AU': 'Australia/Sydney',
      'JP': 'Asia/Tokyo',
      'BR': 'America/Sao_Paulo',
      'IN': 'Asia/Kolkata',
      'SG': 'Asia/Singapore'
    };
    
    return timezones[country] || 'UTC';
  }
  
  /**
   * Get a random ISP name (demo data)
   */
  private getRandomIsp(hash: string): string {
    const isps = [
      'Comcast', 'AT&T', 'Verizon', 'Deutsche Telekom', 'BT Group',
      'Orange', 'Telefónica', 'Vodafone', 'KDDI', 'NTT Communications',
      'Cloudflare', 'Google Cloud', 'Amazon AWS', 'Microsoft Azure',
      'DigitalOcean', 'Linode', 'OVH', 'Hetzner', 'Leaseweb'
    ];
    
    const ispIndex = parseInt(hash.substring(20, 22), 16) % isps.length;
    return isps[ispIndex];
  }
  
  /**
   * Get a random organization name (demo data)
   */
  private getRandomOrg(hash: string): string {
    const orgs = [
      'Comcast Business', 'AT&T Services', 'Verizon Business', 'Deutsche Telekom AG',
      'BT Group plc', 'Orange S.A.', 'Telefónica S.A.', 'Vodafone Group',
      'KDDI Corporation', 'NTT Communications Corporation', 'Cloudflare, Inc.',
      'Google LLC', 'Amazon.com, Inc.', 'Microsoft Corporation',
      'DigitalOcean, LLC', 'Linode, LLC', 'OVH SAS', 'Hetzner Online GmbH',
      'Leaseweb Global B.V.'
    ];
    
    const orgIndex = parseInt(hash.substring(22, 24), 16) % orgs.length;
    return orgs[orgIndex];
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache() {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheLifetime) {
        this.cache.delete(key);
      }
    }
  }
}

// Export a singleton instance
export const geoIpService = new GeoIpService();