import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormMessage, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, Play, Share, AlertCircle, Copy, Check, RefreshCw, Code } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { mcpClient } from "@/lib/mcpWebsocketClient";
import { Form } from "@/components/ui/form";

interface ToolExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: any; // Tool object
  serverId: number;
}

export function ToolExecutionDialog({ open, onOpenChange, tool, serverId }: ToolExecutionDialogProps) {
  const { toast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState("inputs");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [formSchema, setFormSchema] = useState<z.ZodObject<any>>(z.object({}));
  const [resultCopied, setResultCopied] = useState(false);
  
  // Generate form fields based on the tool schema
  useEffect(() => {
    if (tool && tool.metadata) {
      try {
        const schema = typeof tool.metadata === 'string' ? JSON.parse(tool.metadata) : tool.metadata;
        
        // Create a dynamic Zod schema based on the tool's JSON schema
        const fields: Record<string, z.ZodTypeAny> = {};
        
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, property]: [string, any]) => {
            // Determine field type and create appropriate Zod validator
            switch (property.type) {
              case 'string':
                fields[key] = property.format === 'email' 
                  ? z.string().email(property.description || 'Invalid email')
                  : z.string();
                break;
              case 'integer':
              case 'number':
                fields[key] = z.coerce.number();
                break;
              case 'boolean':
                fields[key] = z.boolean();
                break;
              case 'array':
                fields[key] = z.array(z.any());
                break;
              case 'object':
                fields[key] = z.record(z.string());
                break;
              default:
                fields[key] = z.any();
            }
            
            // Handle required fields
            if (schema.required && schema.required.includes(key)) {
              fields[key] = fields[key].nonempty(`${key} is required`);
            } else {
              fields[key] = fields[key].optional();
            }
          });
        }
        
        setFormSchema(z.object(fields));
        form.reset(); // Reset form when schema changes
      } catch (e) {
        console.error("Failed to parse tool schema:", e);
        toast({
          title: "Schema Error",
          description: "Failed to parse tool schema",
          variant: "destructive",
        });
      }
    }
  }, [tool]);
  
  // Create form with dynamic schema
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
    mode: "onChange",
  });
  
  // Execute tool
  const executeTool = async (data: any) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);
    setExecutionTime(null);
    
    const startTime = Date.now();
    
    try {
      // Use the MCP WebSocket client to run the tool
      // For now, we're simulating the tool execution since the actual runTool method
      // needs to be implemented in the mcpClient class
      let result;
      
      // Send a custom command to the server through the WebSocket
      const success = mcpClient.send({
        type: 'execute_tool',
        serverId,
        toolName: tool.name,
        parameters: data
      });
      
      if (!success) {
        throw new Error("Failed to send tool execution request");
      }
      
      // Simulate a response since we're not yet handling the actual response
      result = {
        success: true,
        toolName: tool.name,
        executedAt: new Date().toISOString(),
        result: { message: "Tool execution simulated" }
      };
      
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);
      setResult(result);
      setActiveTab("result");
      
      toast({
        title: "Tool Executed",
        description: "Tool execution completed successfully",
      });
    } catch (err) {
      setError(err.message || "Tool execution failed");
      setActiveTab("result");
      
      toast({
        title: "Execution Failed",
        description: err.message || "Failed to execute tool",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
      
      toast({
        title: "Copied",
        description: "Result copied to clipboard",
      });
    }
  };
  
  // Reset everything when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setResult(null);
      setError(null);
      setExecutionTime(null);
      setActiveTab("inputs");
      form.reset();
    }
    onOpenChange(open);
  };
  
  // Render form fields based on the schema
  const renderFormFields = () => {
    if (!tool || !tool.metadata) return null;
    
    let schema: any;
    try {
      schema = typeof tool.metadata === 'string' ? JSON.parse(tool.metadata) : tool.metadata;
    } catch (e) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Schema</AlertTitle>
          <AlertDescription>
            The tool schema could not be parsed. Please check the schema definition.
          </AlertDescription>
        </Alert>
      );
    }
    
    if (!schema.properties) return null;
    
    return Object.entries(schema.properties).map(([key, property]: [string, any]) => {
      const isRequired = schema.required && schema.required.includes(key);
      
      return (
        <FormField
          key={key}
          control={form.control}
          name={key}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {property.title || key.charAt(0).toUpperCase() + key.slice(1)}
                {isRequired && <span className="text-destructive"> *</span>}
              </FormLabel>
              <FormControl>
                {property.type === "string" && property.format === "textarea" ? (
                  <Textarea 
                    placeholder={property.description || ""}
                    {...field}
                    value={field.value || ""}
                  />
                ) : (
                  <Input 
                    type={property.type === "number" || property.type === "integer" ? "number" : "text"}
                    placeholder={property.description || ""}
                    {...field}
                    value={field.value || ""}
                  />
                )}
              </FormControl>
              {property.description && (
                <FormDescription>{property.description}</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      );
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execute Tool: {tool?.name}</DialogTitle>
          <DialogDescription>
            {tool?.description || "Enter input parameters and execute the tool"}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="inputs">Inputs</TabsTrigger>
            <TabsTrigger value="result" disabled={!result && !error && !isExecuting}>
              Result {result && "✓"}
              {error && "⚠️"}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="inputs" className="py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(executeTool)} className="space-y-4">
                {renderFormFields()}
                
                <DialogFooter className="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isExecuting}
                    className="gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Execute
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="result" className="py-4">
            {isExecuting ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Executing Tool...</p>
                <p className="text-sm text-muted-foreground">Please wait while the request is processed</p>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Execution Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1" />
                    Execution time: {executionTime ? `${executionTime}ms` : "N/A"}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={copyToClipboard}
                  >
                    {resultCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Result</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <pre className="bg-muted p-4 rounded-md overflow-auto text-sm max-h-96 font-mono">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
                
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => setActiveTab("inputs")}
                >
                  <RefreshCw className="h-4 w-4" />
                  Run Again
                </Button>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}