import React from 'react';
import { Helmet } from 'react-helmet';
import { SimpleWebsocketTest } from '@/components/debug/simple-websocket-test';
import { BasicWebsocketTest } from '@/components/debug/basic-websocket-test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';

const DebugPage = () => {
  return (
    <div className="container mx-auto py-8">
      <Helmet>
        <title>System Diagnostics - NexusMCP</title>
      </Helmet>
      
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Diagnostics</h1>
          <p className="text-muted-foreground mt-2">
            Tools for debugging and testing system components
          </p>
        </div>
        
        <Separator className="my-6" />
        
        <Tabs defaultValue="websocket-basic" className="w-full">
          <TabsList className="grid grid-cols-3 w-[600px]">
            <TabsTrigger value="websocket-basic">Basic WebSocket</TabsTrigger>
            <TabsTrigger value="websocket-mcp">MCP WebSocket</TabsTrigger>
            <TabsTrigger value="system">System Status</TabsTrigger>
          </TabsList>
          
          <TabsContent value="websocket-basic" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">Basic WebSocket Test</h2>
              <p className="text-muted-foreground">
                Tests the ultra-simplified '/ws' endpoint with minimal code complexity.
              </p>
            </div>
            <BasicWebsocketTest />
          </TabsContent>
          
          <TabsContent value="websocket-mcp" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">MCP WebSocket Test</h2>
              <p className="text-muted-foreground">
                Tests the more complex '/ws/mcp-proxy' endpoint with MCP protocol support.
              </p>
            </div>
            <SimpleWebsocketTest />
          </TabsContent>
          
          <TabsContent value="system" className="mt-6">
            <div className="rounded-lg border p-8 text-center">
              <h3 className="text-lg font-medium">System Status Panel</h3>
              <p className="text-muted-foreground mt-2">
                System status diagnostics will be added here.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DebugPage;