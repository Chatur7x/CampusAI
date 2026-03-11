import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-500/5 border border-red-500/20 rounded-2xl md:p-12 text-center h-full min-h-[400px]">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-red-200 mb-2">Something went wrong</h2>
      <p className="text-sm text-red-300/70 max-w-md mb-6 whitespace-pre-wrap font-mono bg-red-500/5 p-4 rounded-lg">
        {error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)}
      </p>
      
      <Button 
        onClick={resetErrorBoundary} 
        variant="destructive"
        className="bg-red-500/80 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Optional: Perform any cleanup or state reset here if needed
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
