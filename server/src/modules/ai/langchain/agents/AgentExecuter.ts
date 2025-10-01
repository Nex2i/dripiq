import { DynamicStructuredTool } from '@langchain/core/tools';
import { JsonOutputParser, BaseOutputParser } from '@langchain/core/output_parsers';
import { CallbackHandler } from '@langfuse/langchain';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { promptManagementService } from '../services/promptManagement.service';
import { Guid } from '@/utils/Guid';
import z from 'zod';

type AgentRunResult<T> = {
  output: T;
  intermediateSteps: unknown[];
  raw: any; // full agent return for debugging
};

export async function AgentExecuter<T extends Record<string, any>>(
  promptName: string,
  tenantId: string,
  variables: Record<string, any>,
  config: LangChainConfig,
  outputSchema: z.ZodSchema,
  tools: DynamicStructuredTool[] = [],
  metadata: Record<string, any> = {},
  tags: string[] = []
): Promise<AgentRunResult<T>> {
  const prompt = await promptManagementService.fetchPrompt(promptName);
  const langChainPrompt = await promptManagementService.toLangChainPrompt(prompt);

  const langfuseHandler = new CallbackHandler({
    userId: tenantId,
    traceMetadata: { tenantId, ...metadata, ...config },
    tags,
    sessionId: Guid(),
  });

  const model = createChatModel(config);

  const agent = createToolCallingAgent({
    llm: model,
    tools,
    prompt: langChainPrompt, // must include `{format_instructions}` placeholder
  });

  const agentExecutor = new AgentExecutor({
    agent,
    maxIterations: config.maxIterations,
    tools,
    verbose: false,
    returnIntermediateSteps: true,
  });

  const effectiveParser = new JsonOutputParser<T>();
  const formatInstructions = `You must return the output in the following schema: ${JSON.stringify(z.toJSONSchema(outputSchema), null, 2)}`;

  const raw = await agentExecutor.invoke(
    { ...variables, format_instructions: formatInstructions },
    {
      callbacks: [langfuseHandler],
      runName: promptName,
      tags: [promptName, ...tags],
      metadata: { ...metadata, promptName, tags, ...config },
    }
  );

  const extractedOutput = extractTextFromAgentOutput(raw.output);

  // If output is already a parsed object, return it directly
  if (typeof extractedOutput === 'object') {
    return {
      output: extractedOutput as T,
      intermediateSteps: raw.intermediateSteps ?? [],
      raw,
    };
  }

  // Parse string output as JSON
  const typed = await effectiveParser.parse(extractedOutput);

  return {
    output: typed as T,
    intermediateSteps: raw.intermediateSteps ?? [],
    raw,
  };
}

/**
 * Extracts text output from various agent output formats
 * Tool-calling agents return output as array of {type: "text", text: "..."}
 */
function extractTextFromAgentOutput(output: unknown): string | object {
  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output) && output[0]?.text) {
    return output[0].text;
  }

  if (typeof output === 'object' && output !== null) {
    // Already a parsed object
    return output;
  }

  throw new Error(`Unexpected output format from agent: ${typeof output}`);
}
