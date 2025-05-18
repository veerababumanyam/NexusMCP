/**
 * OpenAI Embeddings Service for Financial Regulation
 * 
 * Provides advanced semantic matching capabilities for financial regulatory compliance:
 * - Creates embeddings for regulatory rules and content
 * - Performs semantic similarity comparison
 * - Caches embeddings for improved performance
 * - Supports threshold-based matching for regulatory compliance
 */

import OpenAI from 'openai';
import { db } from '../../../db';
import { regulatoryRules } from '../../../shared/schema_financial';
import { eq } from 'drizzle-orm';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for rule embeddings to avoid redundant API calls
interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: Date;
}

class EmbeddingsService {
  private embeddingCache: Map<string, EmbeddingCacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MODEL = 'text-embedding-ada-002'; // Using Ada for cost-efficiency

  /**
   * Generate embeddings for a given text
   */
  public async getEmbedding(text: string): Promise<number[]> {
    const cacheKey = `text:${this.hashString(text)}`;
    
    // Check cache first
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.embedding;
    }
    
    try {
      const response = await openai.embeddings.create({
        model: this.MODEL,
        input: this.prepareText(text),
      });
      
      const embedding = response.data[0].embedding;
      
      // Cache the result
      this.embeddingCache.set(cacheKey, {
        embedding,
        timestamp: new Date()
      });
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
  
  /**
   * Get embeddings for a regulatory rule by ID
   */
  public async getRuleEmbedding(ruleId: string): Promise<number[]> {
    const cacheKey = `rule:${ruleId}`;
    
    // Check cache first
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.embedding;
    }
    
    // Get rule from database
    const rule = await db.query.regulatoryRules.findFirst({
      where: eq(regulatoryRules.ruleId, ruleId)
    });
    
    if (!rule) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }
    
    // Create embedding text from rule description and examples
    const embeddingText = [
      rule.description,
      rule.example,
      rule.counterExample
    ].filter(Boolean).join('\n');
    
    const embedding = await this.getEmbedding(embeddingText);
    
    // Cache the result
    this.embeddingCache.set(cacheKey, {
      embedding,
      timestamp: new Date()
    });
    
    return embedding;
  }
  
  /**
   * Calculate similarity between two embeddings using cosine similarity
   */
  public calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }
    
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Check if text violates a specific regulatory rule 
   */
  public async checkRuleViolation(
    text: string, 
    ruleId: string, 
    threshold: number = 0.75
  ): Promise<{
    violated: boolean;
    similarity: number;
  }> {
    const textEmbedding = await this.getEmbedding(text);
    const ruleEmbedding = await this.getRuleEmbedding(ruleId);
    
    const similarity = this.calculateSimilarity(textEmbedding, ruleEmbedding);
    
    return {
      violated: similarity >= threshold,
      similarity
    };
  }
  
  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): void {
    const now = new Date();
    
    for (const [key, entry] of this.embeddingCache.entries()) {
      if (!this.isCacheValid(entry.timestamp)) {
        this.embeddingCache.delete(key);
      }
    }
  }
  
  /**
   * Check if a cached timestamp is still valid
   */
  private isCacheValid(timestamp: Date): boolean {
    const now = new Date();
    return (now.getTime() - timestamp.getTime()) < this.CACHE_TTL_MS;
  }
  
  /**
   * Prepare text for embedding by trimming and formatting
   */
  private prepareText(text: string): string {
    return text.trim().substring(0, 8000); // Limit to 8000 chars for API limit
  }
  
  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16); // Convert to hex
  }
}

export const embeddingsService = new EmbeddingsService();