import { DynamicStructuredTool } from '@langchain/core/tools';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { CallbackHandler } from '@langfuse/langchain';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import z from 'zod';
import { Guid } from '@/utils/Guid';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { promptManagementService } from '../services/promptManagement.service';

type AgentRunResult<T> = {
  output: T;
  intermediateSteps: unknown[];
  raw: any; // full agent return for debugging
};

interface AgentExecutorParams {
  promptName: string;
  tenantId: string;
  config: LangChainConfig;
  variables?: Record<string, any>;
  outputSchema: z.ZodSchema;
  tools?: DynamicStructuredTool[];
  metadata?: Record<string, any>;
  tags?: string[];
}

export async function DefaultAgentExecuter<T extends Record<string, any>>({
  promptName,
  tenantId,
  variables = {},
  config,
  outputSchema,
  tools = [],
  metadata = {},
  tags = [],
}: AgentExecutorParams): Promise<AgentRunResult<T>> {
  const prompt = await promptManagementService.fetchPrompt(promptName);
  const langChainPrompt = await promptManagementService.toLangChainPrompt(prompt);

  // Generate sessionId from business context to group related traces
  const sessionId = [
    promptName,
    tenantId,
    metadata?.leadId,
    metadata?.contactId,
    new Date().toISOString().split('T')[0], // Group by day
  ]
    .filter(Boolean)
    .join('-');

  const agentMetadata = {
    ...metadata,
    ...config,
    promptName,
    langfuse_session_id: sessionId,
    langfuse_user_id: tenantId,
  };

  const agentTags = [promptName, ...tags];

  const langfuseHandler = new CallbackHandler({
    userId: tenantId,
    sessionId,
    tags: agentTags,
    traceMetadata: agentMetadata,
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
      tags: agentTags,
      metadata: agentMetadata,
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
