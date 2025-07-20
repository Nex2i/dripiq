export interface FunctionCallLoopResult<T> {
  finalResponse: string;
  finalResponseParsed?: T;
  totalIterations: number;
  functionCalls: Array<{
    functionName: string;
    arguments: any;
    result: any;
  }>;
}

// Enhanced error result interface
export interface ProcessingError {
  success: false;
  error: string;
  phase: 'initial' | 'tool_execution' | 'parsing' | 'final_response';
  details?: any;
}

export interface ReportConfig {
  maxIterations?: number;
  model?: string;
  enableWebSearch?: boolean;
}
