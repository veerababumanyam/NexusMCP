import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

// UI components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ArrowRight, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from "lucide-react";

interface TestTransactionFormData {
  transactionId: string;
  type: string;
  amount: string;
  currency: string;
  counterparty: string;
  description: string;
  includeTransactionHistory: boolean;
}

interface TestResult {
  transaction: any;
  detections: Array<{
    detected: boolean;
    severity: string;
    description: string;
    evidenceData: {
      riskFactors: string[];
      suggestedActions: string[];
      anomalyScore: number;
      confidenceScore: number;
    };
  }>;
  ml_analysis_performed: boolean;
  detections_count: number;
}

const AnomalyDetectionTestPage: React.FC = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<TestTransactionFormData>({
    transactionId: `TRX-${Date.now().toString().slice(-8)}`,
    type: 'wire_transfer',
    amount: '1000.00',
    currency: 'USD',
    counterparty: 'ACME Corp',
    description: 'Monthly service payment',
    includeTransactionHistory: true
  });

  // Redirect if not logged in
  React.useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  // Check if OpenAI API key is configured
  const { data: apiKeyStatus, isLoading: checkingApiKey } = useQuery({
    queryKey: ['/api/financial/settings/openai-status'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/financial/settings/openai-status');
        return await res.json();
      } catch (error) {
        return { enabled: process.env.OPENAI_API_KEY ? true : false };
      }
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, includeTransactionHistory: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTestResult(null);

    try {
      // Format the transaction data
      const transactionData = {
        transaction: {
          transactionId: formData.transactionId,
          type: formData.type,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          counterparty: formData.counterparty,
          description: formData.description,
          status: 'pending',
          metadata: {}
        },
        includeTransactionHistory: formData.includeTransactionHistory
      };

      // Send the test request
      const response = await apiRequest('POST', '/api/financial/anomaly-detection/ml-test', transactionData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to test anomaly detection');
      }

      const result = await response.json();
      setTestResult(result);
      
      toast({
        title: 'ML Analysis Complete',
        description: `Analysis performed with ${result.detections_count} anomalies detected.`,
        variant: result.detections_count > 0 ? 'destructive' : 'default',
      });
    } catch (err) {
      console.error('Error testing anomaly detection:', err);
      const error = err as Error;
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Could not complete analysis',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to render severity badges
  const renderSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <Badge variant="destructive" className="ml-2"><ShieldAlert className="h-3 w-3 mr-1" /> Critical</Badge>;
      case 'high':
        return <Badge variant="destructive" className="ml-2"><AlertCircle className="h-3 w-3 mr-1" /> High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800"><AlertTriangle className="h-3 w-3 mr-1" /> Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="ml-2"><CheckCircle2 className="h-3 w-3 mr-1" /> Low</Badge>;
      default:
        return <Badge variant="secondary" className="ml-2">{severity}</Badge>;
    }
  };

  // Helper function to render confidence score
  const renderConfidenceScore = (score: number) => {
    return (
      <div className="mt-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Confidence Score: {Math.round(score * 100)}%</span>
        </div>
        <Progress value={score * 100} className="h-2" />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Helmet>
        <title>ML Anomaly Detection Test - NexusMCP</title>
      </Helmet>
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ML Anomaly Detection Test</h1>
          <p className="text-muted-foreground mt-1">
            Test machine learning based financial transaction anomaly detection
          </p>
        </div>
        <Button onClick={() => navigate('/financial/anomalies')}>
          View Anomaly Dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {checkingApiKey ? (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span>Checking OpenAI API configuration...</span>
            </div>
          </CardContent>
        </Card>
      ) : apiKeyStatus && !apiKeyStatus.enabled ? (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>OpenAI API Key Not Configured</AlertTitle>
          <AlertDescription>
            ML-based anomaly detection requires an OpenAI API key. Please contact your administrator to configure the API key.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Test Transaction</CardTitle>
            <CardDescription>
              Enter transaction details to test for anomalies using OpenAI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transactionId">Transaction ID</Label>
                    <Input
                      id="transactionId"
                      name="transactionId"
                      value={formData.transactionId}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Transaction Type</Label>
                    <Input
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      required
                      placeholder="wire_transfer, purchase, etc."
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="counterparty">Counterparty</Label>
                  <Input
                    id="counterparty"
                    name="counterparty"
                    value={formData.counterparty}
                    onChange={handleInputChange}
                    placeholder="Company or individual name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="includeHistory"
                    checked={formData.includeTransactionHistory}
                    onCheckedChange={handleCheckboxChange}
                  />
                  <Label htmlFor="includeHistory" className="text-sm font-normal">
                    Include transaction history in analysis
                  </Label>
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || (apiKeyStatus && !apiKeyStatus.enabled)}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Run ML Detection Test'
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              {testResult 
                ? `${testResult.detections_count} anomalies detected` 
                : 'Run a test to see results'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing transaction with AI...</p>
              </div>
            ) : !testResult ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                <p>No analysis results yet</p>
                <p className="text-sm">Enter transaction details and run the test</p>
              </div>
            ) : (
              <div className="space-y-6">
                {testResult.detections.length === 0 ? (
                  <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertTitle>No Anomalies Detected</AlertTitle>
                    <AlertDescription>
                      The transaction appears normal based on ML analysis.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {testResult.detections.map((detection, index) => (
                      <div key={index} className="space-y-4">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-lg">
                            Anomaly Detected
                            {renderSeverityBadge(detection.severity)}
                          </h3>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {detection.description}
                        </p>
                        
                        {detection.evidenceData && (
                          <>
                            {renderConfidenceScore(detection.evidenceData.confidenceScore)}
                            
                            <Separator className="my-4" />
                            
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">Risk Factors:</h4>
                              <ul className="list-disc pl-5 text-sm space-y-1">
                                {detection.evidenceData.riskFactors.map((factor, i) => (
                                  <li key={i}>{factor}</li>
                                ))}
                              </ul>
                            </div>
                            
                            {detection.evidenceData.suggestedActions && detection.evidenceData.suggestedActions.length > 0 && (
                              <div className="space-y-3 mt-4">
                                <h4 className="font-medium text-sm">Suggested Actions:</h4>
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                  {detection.evidenceData.suggestedActions.map((action, i) => (
                                    <li key={i}>{action}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div>
                  <h3 className="font-medium mb-2">Transaction Details</h3>
                  <div className="bg-muted rounded-md p-3">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(testResult.transaction, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnomalyDetectionTestPage;