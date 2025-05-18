/**
 * Machine Learning Anomaly Detection Service for Financial Transactions
 * 
 * Uses AI models to identify suspicious patterns and anomalies in financial data:
 * - Provides ML-based pattern recognition beyond simple rule-based checks
 * - Analyzes transaction context against historical patterns
 * - Detects complex fraud patterns and unusual behaviors
 * - Generates natural language explanations for detected anomalies
 * - Supports continuous learning from human feedback
 */

import OpenAI from 'openai';
import { db } from '../../../db';
import { 
  financialTransactions, 
  financialAnomalyDetections,
  financialAnomalyRules
} from '../../../shared/schema_financial';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache to reduce API calls - stores recent transaction analysis results
interface AnalysisCache {
  transactionId: string;
  analysis: AnomalyAnalysis;
  timestamp: Date;
}

// Result of ML-based anomaly analysis
export interface AnomalyAnalysis {
  isAnomaly: boolean;
  anomalyScore: number; // 0.0 to 1.0
  confidenceScore: number; // 0.0 to 1.0
  explanation: string;
  riskFactors: string[];
  suggestedActions?: string[];
}

export class MlAnomalyDetectionService {
  private analysisCache: Map<string, AnalysisCache> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MODEL = 'gpt-4o'; // Using the latest OpenAI model for analysis

  /**
   * Detect anomalies in a financial transaction using ML
   */
  public async analyzeTransaction(
    transaction: typeof financialTransactions.$inferSelect,
    includeTransactionHistory: boolean = true
  ): Promise<AnomalyAnalysis> {
    const cacheKey = `transaction:${transaction.transactionId}`;
    
    // Check cache first
    const cached = this.analysisCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.analysis;
    }
    
    try {
      // Get transaction history for context if requested
      let transactionHistory: any[] = [];
      if (includeTransactionHistory) {
        transactionHistory = await this.getRecentTransactions(
          transaction.requestedBy,
          transaction.workspaceId,
          10
        );
      }
      
      // Prepare the context for analysis
      const analysisContext = {
        transaction: {
          id: transaction.transactionId,
          type: transaction.transactionType,
          amount: transaction.amount,
          currency: transaction.currency,
          timestamp: transaction.timestamp,
          status: transaction.status,
          instrumentType: transaction.instrumentType,
          instrumentId: transaction.instrumentId,
          details: transaction.transactionDetails
        },
        userContext: {
          userId: transaction.requestedBy,
          workspaceId: transaction.workspaceId
        },
        recentHistory: transactionHistory.map(tx => ({
          id: tx.transactionId,
          type: tx.transactionType,
          amount: tx.amount,
          currency: tx.currency,
          timestamp: tx.timestamp,
          instrumentType: tx.instrumentType
        }))
      };
      
      // Call OpenAI for analysis
      const analysis = await this.performMlAnalysis(analysisContext);
      
      // Cache the result
      this.analysisCache.set(cacheKey, {
        transactionId: transaction.transactionId,
        analysis,
        timestamp: new Date()
      });
      
      return analysis;
    } catch (error) {
      console.error('Error in ML anomaly detection:', error);
      
      // Return a safe default in case of error
      return {
        isAnomaly: false,
        anomalyScore: 0,
        confidenceScore: 0,
        explanation: 'Analysis failed due to technical error',
        riskFactors: []
      };
    }
  }
  
  /**
   * Query OpenAI for transaction analysis
   */
  private async performMlAnalysis(
    context: any
  ): Promise<AnomalyAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: this.MODEL, // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a financial anomaly detection AI that analyzes transactions for suspicious activities. 
Your task is to review the transaction details and determine if the transaction shows signs of:
1. Unusual activity compared to historical patterns
2. Potential fraud or market manipulation
3. Regulatory compliance issues
4. Suspicious timing or amounts

Provide your analysis in JSON format with the following structure:
{
  "isAnomaly": boolean,
  "anomalyScore": number (0.0-1.0),
  "confidenceScore": number (0.0-1.0),
  "explanation": string,
  "riskFactors": [string],
  "suggestedActions": [string]
}

Be conservative - only flag true anomalies with clear suspicious patterns.`
          },
          {
            role: "user",
            content: JSON.stringify(context, null, 2)
          }
        ],
        response_format: { type: "json_object" }
      });
      
      // Parse the response
      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        isAnomaly: result.isAnomaly === true,
        anomalyScore: this.normalizeScore(result.anomalyScore),
        confidenceScore: this.normalizeScore(result.confidenceScore),
        explanation: result.explanation || "No explanation provided",
        riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors : [],
        suggestedActions: Array.isArray(result.suggestedActions) ? result.suggestedActions : []
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw new Error(`Failed to analyze transaction: ${error.message}`);
    }
  }
  
  /**
   * Get recent transactions for a user/workspace for context
   */
  private async getRecentTransactions(
    userId: number,
    workspaceId: number,
    limit: number = 10
  ): Promise<Array<typeof financialTransactions.$inferSelect>> {
    try {
      // Get transactions from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return await db.query.financialTransactions.findMany({
        where: and(
          eq(financialTransactions.requestedBy, userId),
          eq(financialTransactions.workspaceId, workspaceId),
          gte(financialTransactions.timestamp, thirtyDaysAgo)
        ),
        orderBy: [desc(financialTransactions.timestamp)],
        limit
      });
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }
  
  /**
   * Record an anomaly detection from ML analysis if it's significant
   */
  public async recordMlDetection(
    transaction: typeof financialTransactions.$inferSelect,
    analysis: AnomalyAnalysis
  ): Promise<void> {
    try {
      // Only record if it's an actual anomaly with reasonable confidence
      if (!analysis.isAnomaly || analysis.anomalyScore < 0.6 || analysis.confidenceScore < 0.7) {
        return;
      }
      
      // See if we already have a rule for this type of pattern
      let rule = await db.query.financialAnomalyRules.findFirst({
        where: and(
          eq(financialAnomalyRules.category, 'ml_detected'),
          eq(financialAnomalyRules.isEnabled, true)
        )
      });
      
      // If no ML rule exists, create one
      if (!rule) {
        const [newRule] = await db.insert(financialAnomalyRules).values({
          name: 'ML Detected Anomaly',
          description: 'Anomaly detected by machine learning analysis',
          category: 'ml_detected',
          ruleType: 'ml',
          isEnabled: true,
          isSystem: true,
          severity: 'medium',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        
        rule = newRule;
      }
      
      // Record the detection
      await db.insert(financialAnomalyDetections).values({
        ruleId: rule.id,
        userId: transaction.requestedBy,
        workspaceId: transaction.workspaceId,
        transactionId: transaction.transactionId,
        detectedAt: new Date(),
        status: 'open',
        severity: this.getSeverityFromScore(analysis.anomalyScore),
        description: analysis.explanation,
        details: {
          anomalyScore: analysis.anomalyScore,
          confidenceScore: analysis.confidenceScore,
          riskFactors: analysis.riskFactors,
          suggestedActions: analysis.suggestedActions,
          mlGenerated: true
        }
      });
    } catch (error) {
      console.error('Error recording ML detection:', error);
    }
  }
  
  /**
   * Convert anomaly score to standard severity level
   */
  public getSeverityFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.9) return 'critical';
    if (score >= 0.75) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }
  
  /**
   * Ensure score is within 0-1 range
   */
  private normalizeScore(score: number): number {
    if (typeof score !== 'number' || isNaN(score)) {
      return 0;
    }
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Check if cached timestamp is still valid
   */
  private isCacheValid(timestamp: Date): boolean {
    const now = new Date();
    return (now.getTime() - timestamp.getTime()) < this.CACHE_TTL_MS;
  }
  
  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): void {
    const now = new Date();
    
    for (const [key, entry] of this.analysisCache.entries()) {
      if (!this.isCacheValid(entry.timestamp)) {
        this.analysisCache.delete(key);
      }
    }
  }
}

export const mlAnomalyDetectionService = new MlAnomalyDetectionService();