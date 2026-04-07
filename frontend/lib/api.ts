interface StageInfo {
  title: string;
  content: string;
  status: "completed" | "failed";
  files_count?: number;
}

export interface TestResults {
  success?: boolean;
  filename?: string;
  language?: string;
  stages?: {
    project_analysis?: StageInfo;
    test_generation?: StageInfo;
    test_execution?: StageInfo;
    analysis_report?: StageInfo;
    suggestions?: StageInfo;
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

export interface ApiResponse {
  success?: boolean;
  filename?: string;
  language?: string;
  stages?: {
    project_analysis?: StageInfo;
    test_generation?: StageInfo;
    test_execution?: StageInfo;
    analysis_report?: StageInfo;
    suggestions?: StageInfo;
  };
  full_markdown?: string;
  raw_data?: {
    project_context?: string;
    test_scaffolding?: string;
    execution_results?: string;
    report?: string;
    suggestions?: string;
  };
  // Legacy support
  report?: string;
  suggestions?: string;
  execution_log?: string;
}

export class TestingApiClient {
  public baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  async uploadAndTest(file: File): Promise<TestResults> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/test-project/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result: ApiResponse = await response.json();

      // Return the full new format, with legacy fallback
      return {
        success: result.success,
        filename: result.filename,
        language: result.language,
        stages: result.stages,
        full_markdown: result.full_markdown,
        raw_data: result.raw_data,
        // Legacy support
        report: result.report || result.raw_data?.report,
        suggestions: result.suggestions || result.raw_data?.suggestions,
        execution_log: result.execution_log || result.raw_data?.execution_results,
      };
    } catch (error) {
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      console.log(`Checking server health at: ${this.baseUrl}/health`);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('Health endpoint response status:', response.status);
      console.log('Health endpoint response ok:', response.ok);
      console.log('Health endpoint response headers:', Object.fromEntries(response.headers.entries()));
      
      // Try to read the response body for debugging
      try {
        const responseText = await response.text();
        console.log('Health endpoint response body:', responseText);
      } catch (bodyError) {
        console.log('Could not read response body:', bodyError);
      }
      
      return response.ok;
    } catch (error) {
      console.error('Health check failed with error:', error);
      return false;
    }
  }
}

export const apiClient = new TestingApiClient();