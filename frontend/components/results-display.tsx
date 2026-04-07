"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Download,
  Copy,
  Terminal,
  Lightbulb,
  Code2,
  PlayCircle,
  BarChart3,
  Languages
} from "lucide-react";

interface StageInfo {
  title: string;
  content: string;
  status: "completed" | "failed";
  files_count?: number;
}

interface TestResults {
  success?: boolean;
  filename?: string;
  language?: string;
  stages?: {
    project_analysis?: StageInfo;
    test_generation?: StageInfo;
    test_execution?: StageInfo;
    analysis_report?: StageInfo;
    suggestions?: StageInfo;
    semantic_test_adequacy?: StageInfo;
  };
  full_markdown?: string;
  raw_data?: {
    project_context?: string;
    test_scaffolding?: string;
    execution_results?: string;
    report?: string;
    suggestions?: string;
  };
  // Legacy support for old format
  report?: string;
  suggestions?: string;
  execution_log?: string;
}

interface ResultsDisplayProps {
  results: TestResults;
  isVisible: boolean;
}

export function ResultsDisplay({ results, isVisible }: ResultsDisplayProps) {
  if (!isVisible || !results) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadReport = () => {
    const content = results.full_markdown || results.report || "No report available";
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${results.filename || 'unknown'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStageIcon = (stageKey: string) => {
    switch (stageKey) {
      case 'project_analysis': return <FileText className="h-5 w-5" />;
      case 'test_generation': return <Code2 className="h-5 w-5" />;
      case 'test_execution': return <PlayCircle className="h-5 w-5" />;
      case 'analysis_report': return <BarChart3 className="h-5 w-5" />;
      case 'suggestions': return <Lightbulb className="h-5 w-5" />;
      case 'semantic_test_adequacy': return <Languages className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: "completed" | "failed") => {
    return status === "completed" ? (
      <Badge className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  };

  // Check if we have the new format
  const hasNewFormat = results.stages && results.success !== undefined;

  if (!hasNewFormat) {
    // Legacy format fallback
    return (
      <div className="w-full space-y-6">
        <Alert>
          <AlertDescription>
            Using legacy format. Please update your backend for enhanced results display.
          </AlertDescription>
        </Alert>
        
        <Tabs defaultValue="report" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="execution">Execution Log</TabsTrigger>
          </TabsList>

          <TabsContent value="report">
            <Card>
              <CardHeader>
                <CardTitle>Test Report</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm">
                  {results.report || "No report available"}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggestions">
            <Card>
              <CardHeader>
                <CardTitle>Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm">
                  {results.suggestions || "No suggestions available"}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="execution">
            <Card>
              <CardHeader>
                <CardTitle>Execution Log</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-black text-green-400 p-4 rounded">
                  {results.execution_log || "No execution log available"}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // New enhanced format display
  const stages = results.stages || {};
  const completedStages = Object.values(stages).filter(stage => stage?.status === "completed").length;
  const totalStages = Object.keys(stages).length;

  return (
    <div className="w-full space-y-6">
      {/* Summary Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Analysis Complete! 🎉</h2>
              <p className="text-gray-600">
                {results.filename && (
                  <>File: <span className="font-mono text-blue-600">{results.filename}</span></>
                )}
                {results.language && (
                  <>
                    {results.filename && " • "}
                    Language: <span className="font-semibold">{results.language}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-gray-600">
                {completedStages}/{totalStages} stages completed
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => results.full_markdown && copyToClipboard(results.full_markdown)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Full Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadReport}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stages Display */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="semantic">STAR</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>📋 Process Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stages).map(([key, stage]) => (
                  <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStageIcon(key)}
                      <div>
                        <h3 className="font-medium">{stage?.title || key}</h3>
                        {key === 'test_generation' && stage?.files_count && (
                          <p className="text-sm text-gray-600">{stage.files_count} files generated</p>
                        )}
                      </div>
                    </div>
                    {stage && getStatusBadge(stage.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Project Analysis
                </CardTitle>
                {stages.project_analysis && getStatusBadge(stages.project_analysis.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stages.project_analysis?.content || "No analysis available"}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  Generated Tests
                  {stages.test_generation?.files_count && (
                    <Badge variant="secondary">{stages.test_generation.files_count} files</Badge>
                  )}
                </CardTitle>
                {stages.test_generation && getStatusBadge(stages.test_generation.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stages.test_generation?.content || "No tests generated"}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execution" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Test Execution
                </CardTitle>
                {stages.test_execution && getStatusBadge(stages.test_execution.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stages.test_execution?.content || "No execution results"}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semantic" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Semantic Test Adequacy (STAR)
                </CardTitle>
                {stages.semantic_test_adequacy && getStatusBadge(stages.semantic_test_adequacy.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stages.semantic_test_adequacy?.content || "No semantic adequacy data available"}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Analysis Report
                </CardTitle>
                {stages.analysis_report && getStatusBadge(stages.analysis_report.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stages.analysis_report?.content || "No analysis report available"}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  AI Suggestions
                </CardTitle>
                {stages.suggestions && getStatusBadge(stages.suggestions.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stages.suggestions?.content || "No suggestions available"}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}