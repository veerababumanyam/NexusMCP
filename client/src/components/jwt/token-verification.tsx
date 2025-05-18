import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Schema for JWT token verification
const tokenVerificationSchema = z.object({
  token: z.string().min(1, { message: 'JWT token is required' }),
  settingsId: z.string().optional(),
  recordUsage: z.boolean().default(false)
});

type TokenVerificationInput = z.infer<typeof tokenVerificationSchema>;

export function TokenVerificationComponent() {
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const form = useForm<TokenVerificationInput>({
    resolver: zodResolver(tokenVerificationSchema),
    defaultValues: {
      token: '',
      settingsId: '',
      recordUsage: false
    }
  });

  const onSubmit = async (data: TokenVerificationInput) => {
    setIsVerifying(true);
    setVerificationResult(null);
    
    try {
      const params = new URLSearchParams();
      if (data.recordUsage) {
        params.append('record', 'true');
      }
      
      const response = await apiRequest('POST', '/api/jwt/verification/verify', {
        token: data.token,
        settingsId: data.settingsId || undefined
      });
      
      const result = await response.json();
      setVerificationResult(result);
      
      if (result.verified) {
        toast({
          title: 'Token Verification Success',
          description: 'The JWT token is valid.',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Token Verification Failed',
          description: result.message || 'Invalid token',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      toast({
        title: 'Verification Error',
        description: 'An error occurred while verifying the token',
        variant: 'destructive'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>JWT Token Verification</CardTitle>
        <CardDescription>
          Verify a JWT token against your configured JWT settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>JWT Token</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter JWT token to verify"
                      className="font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="settingsId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Settings ID (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Specific JWT settings ID to use for verification"
                      type="number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="recordUsage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Record Token Usage</FormLabel>
                    <CardDescription>
                      Track this verification in the token audit trail
                    </CardDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              disabled={isVerifying}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Token'
              )}
            </Button>
          </form>
        </Form>
        
        {verificationResult && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="text-lg font-medium">Result:</div>
              {verificationResult.verified ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle2 className="mr-1 h-5 w-5" />
                  Valid Token
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <XCircle className="mr-1 h-5 w-5" />
                  Invalid Token
                </div>
              )}
            </div>
            
            {verificationResult.verified && verificationResult.token && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Token Payload:</div>
                <pre className="overflow-auto rounded-md bg-slate-100 p-4 text-xs dark:bg-slate-800">
                  {JSON.stringify(verificationResult.token, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}