"use client";

import React, { useState, useEffect } from "react";
import { FileUpload } from "@/components/file-upload";
import { ResultsDisplay } from "@/components/results-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient, TestResults } from "@/lib/api";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<boolean | null>(null);

  // Check server status on component mount
  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    console.log('Checking server status at:', apiClient.baseUrl);
    try {
      const isHealthy = await apiClient.healthCheck();
      console.log('Server health check result:', isHealthy);
      setServerStatus(isHealthy);
    } catch (error) {
      console.error('Unexpected error during health check:', error);
      setServerStatus(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setResults(null);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setError(null);
    setResults(null);
  };

  const startTesting = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const results = await apiClient.uploadAndTest(selectedFile);
      setResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Test Your Code 
          </h1>

          {/* Server Status */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {serverStatus === null ? (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                Checking server status...
              </div>
            ) : serverStatus ? (
              <div className="flex items-center gap-2 text-green-600">
                <Wifi className="h-4 w-4" />
                Server is online
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <WifiOff className="h-4 w-4" />
                Server is offline
                <Button variant="outline" size="sm" onClick={checkServerStatus}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Upload Section - Centered and Wide */}
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-4xl">
            <FileUpload 
              onFileSelect={handleFileSelect} 
              onFileRemove={handleFileRemove}
              isLoading={isProcessing} 
            />
          </div>
        </div>

        {/* Start Testing Section - Centered */}
        {selectedFile && !isProcessing && !results && (
          <div className="flex justify-center mb-8">
            <div className="w-full max-w-2xl">
              <Card >
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Analyze Your Code</h3>
                    <p className="text-gray-600">
                      Your file <span className="font-mono text-black">{selectedFile.name}</span> is ready for AI-powered testing
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button 
                      onClick={startTesting} 
                      disabled={!serverStatus}
                      size="lg"
                      className="hover:cursor-pointer"
                    >
                      Start AI Testing
                    </Button>
                  </div>
                  {!serverStatus && (
                    <p className="text-red-500 text-sm mt-3">Server is offline - please check your backend</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Error and Results */}
        <div className="space-y-6">
          {error && (
            <div className="flex justify-center">
              <div className="w-full max-w-2xl">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {error}
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}
          
          <ResultsDisplay 
            results={results || {}} 
            isVisible={!isProcessing && !!results} 
          />
        </div>
      </div>
    </div>
  );
}
