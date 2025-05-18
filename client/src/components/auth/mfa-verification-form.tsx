import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Define schemas for different MFA methods
const totpSchema = z.object({
  code: z.string().min(6, "Code must be at least 6 characters").max(8)
});

const smsEmailSchema = z.object({
  code: z.string().min(6, "Code must be at least 6 characters").max(8)
});

const recoveryCodeSchema = z.object({
  code: z.string().min(8, "Recovery code must be at least 8 characters")
});

type TotpFormValues = z.infer<typeof totpSchema>;
type SmsEmailFormValues = z.infer<typeof smsEmailSchema>;
type RecoveryCodeFormValues = z.infer<typeof recoveryCodeSchema>;

export function MfaVerificationForm() {
  const { mfaState, verifyMfaMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(mfaState.preferredMethod || "totp");

  // TOTP form
  const totpForm = useForm<TotpFormValues>({
    resolver: zodResolver(totpSchema),
    defaultValues: {
      code: ""
    }
  });

  // SMS/Email form
  const smsEmailForm = useForm<SmsEmailFormValues>({
    resolver: zodResolver(smsEmailSchema),
    defaultValues: {
      code: ""
    }
  });

  // Recovery code form
  const recoveryForm = useForm<RecoveryCodeFormValues>({
    resolver: zodResolver(recoveryCodeSchema),
    defaultValues: {
      code: ""
    }
  });

  // Submit handlers for different MFA methods
  const onTotpSubmit = (data: TotpFormValues) => {
    if (!mfaState.userId) return;
    
    verifyMfaMutation.mutate({
      method: "totp",
      userId: mfaState.userId,
      code: data.code
    });
  };

  const onSmsEmailSubmit = (data: SmsEmailFormValues) => {
    if (!mfaState.userId) return;
    
    verifyMfaMutation.mutate({
      method: mfaState.preferredMethod === "sms" ? "sms" : "email",
      userId: mfaState.userId,
      code: data.code
    });
  };

  const onRecoverySubmit = (data: RecoveryCodeFormValues) => {
    if (!mfaState.userId) return;
    
    verifyMfaMutation.mutate({
      method: "recovery",
      userId: mfaState.userId,
      recoveryCode: data.code
    });
  };

  if (!mfaState.required || !mfaState.userId) {
    return null;
  }

  return (
    <div className="w-full max-w-md">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Please enter your verification code to continue
          </p>
        </div>

        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="totp">Authenticator</TabsTrigger>
            <TabsTrigger value={mfaState.preferredMethod === "sms" ? "sms" : "email"}>
              {mfaState.preferredMethod === "sms" ? "SMS" : "Email"}
            </TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
          </TabsList>

          {/* TOTP Authentication App Form */}
          <TabsContent value="totp" className="mt-6">
            <Form {...totpForm}>
              <form onSubmit={totpForm.handleSubmit(onTotpSubmit)} className="space-y-4">
                <FormField
                  control={totpForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter 6-digit code" 
                          {...field} 
                          autoComplete="one-time-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={verifyMfaMutation.isPending}
                >
                  {verifyMfaMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* SMS/Email Form */}
          <TabsContent value={mfaState.preferredMethod === "sms" ? "sms" : "email"} className="mt-6">
            <Form {...smsEmailForm}>
              <form onSubmit={smsEmailForm.handleSubmit(onSmsEmailSubmit)} className="space-y-4">
                <FormField
                  control={smsEmailForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {mfaState.preferredMethod === "sms" ? "SMS" : "Email"} Code
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter verification code" 
                          {...field} 
                          autoComplete="one-time-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={verifyMfaMutation.isPending}
                >
                  {verifyMfaMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* Recovery Code Form */}
          <TabsContent value="recovery" className="mt-6">
            <Form {...recoveryForm}>
              <form onSubmit={recoveryForm.handleSubmit(onRecoverySubmit)} className="space-y-4">
                <FormField
                  control={recoveryForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recovery Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter recovery code" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={verifyMfaMutation.isPending}
                >
                  {verifyMfaMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Use Recovery Code"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}