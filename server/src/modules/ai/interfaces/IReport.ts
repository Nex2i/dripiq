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

export interface ReportConfig {
  maxIterations?: number;
  model?: string;
  enableWebSearch?: boolean;
}
