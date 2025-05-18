import { AuthForms } from "@/components/auth/auth-forms";
import { MfaVerificationForm } from "@/components/auth/mfa-verification-form";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function AuthPage() {
  const { user, mfaState, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Check if URL has MFA verification path
  const isMfaVerification = location === "/auth/mfa";
  
  // Redirect to dashboard if already authenticated (and not in MFA verification flow)
  useEffect(() => {
    if (isAuthenticated && !mfaState.required) {
      setLocation("/");
    }
    
    // If MFA is required but we're not on the MFA page, redirect to it
    if (mfaState.required && !isMfaVerification) {
      setLocation("/auth/mfa");
    }
    
    // If MFA is not required but we're on the MFA page, redirect to login
    if (!mfaState.required && isMfaVerification) {
      setLocation("/auth");
    }
  }, [isAuthenticated, mfaState.required, isMfaVerification, setLocation]);

  // Show the MFA verification form or the login/register form based on the state
  const AuthComponent = isMfaVerification || mfaState.required 
    ? MfaVerificationForm 
    : AuthForms;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Auth form column */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <AuthComponent />
      </div>

      {/* Hero section column */}
      <div className="w-full md:w-1/2 bg-primary text-primary-foreground hidden md:flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center">
          <svg
            className="w-24 h-24 mx-auto mb-6 text-primary-foreground"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <h1 className="text-4xl font-bold mb-4">NexusMCP</h1>
          <p className="text-lg mb-6">
            Enterprise middleware platform designed to unify, orchestrate, and
            govern Model Context Protocol (MCP) servers and AI tool integrations
            at enterprise scale.
          </p>

          <ul className="space-y-2 text-left border rounded-lg p-6 bg-primary-dark/20">
            <li className="flex items-start">
              <svg
                className="w-5 h-5 mr-2 mt-0.5 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <span>Secure proxy/gateway for MCP clients and servers</span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 mr-2 mt-0.5 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <span>Comprehensive dashboard and workflow engine</span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 mr-2 mt-0.5 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <span>Enterprise-grade security and compliance</span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 mr-2 mt-0.5 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <span>Extensible with plugins and SDKs</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
