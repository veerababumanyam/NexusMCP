import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, AlertCircle } from "lucide-react";
import { SiGoogle, SiAuth0, SiOkta } from "react-icons/si";
import { Separator } from "@/components/ui/separator";
import { AuthProvider as IdentityProvider } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Map provider types to icons and colors
const providerIcons: Record<string, React.ReactNode> = {
  'google': <SiGoogle className="h-5 w-5 text-red-500" />,
  'microsoft': <div className="h-5 w-5 bg-blue-600 flex items-center justify-center text-white font-bold text-xs">M</div>,
  'oidc': <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">ID</div>,
  'saml': <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">SM</div>,
  'ldap': <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">LD</div>,
  'auth0': <SiAuth0 className="h-5 w-5 text-orange-500" />,
  'okta': <SiOkta className="h-5 w-5 text-blue-400" />,
};

// Display proper provider names
const getProviderName = (provider: IdentityProvider): string => {
  switch (provider.type) {
    case 'google':
      return 'Google';
    case 'microsoft':
      return 'Microsoft';
    case 'oidc':
      return provider.name || 'OpenID Connect';
    case 'saml':
      return provider.name || 'SAML';
    case 'ldap':
      return provider.name || 'LDAP';
    default:
      return provider.name;
  }
};

export function SsoProviders() {
  const { authProviders = [], loadingProviders, initiateOAuthLogin } = useAuth();
  
  // Filter out local auth provider (with null check)
  const externalProviders = authProviders ? authProviders.filter(p => p.type !== 'local' && p.isEnabled) : [];
  
  if (loadingProviders) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (externalProviders.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-center">
        <Separator className="shrink" />
        <span className="px-2 text-sm text-muted-foreground">Or continue with</span>
        <Separator className="shrink" />
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {externalProviders.map(provider => (
          <TooltipProvider key={provider.id}>
            <Tooltip>
              <TooltipTrigger>
                <div>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2 w-full"
                    onClick={() => initiateOAuthLogin(provider.id)}
                  >
                    {provider.type === 'google' && providerIcons['google']}
                    {provider.type === 'microsoft' && providerIcons['microsoft']}
                    {provider.type === 'oidc' && providerIcons['oidc']}
                    {provider.type === 'saml' && providerIcons['saml']}
                    {provider.type === 'ldap' && providerIcons['ldap']}
                    {provider.type === 'auth0' && providerIcons['auth0']}
                    {provider.type === 'okta' && providerIcons['okta']}
                    {!providerIcons[provider.type] && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                        {provider.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span>Continue with {getProviderName(provider)}</span>
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sign in with {provider.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}