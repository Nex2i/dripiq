import { openAiClient } from '@/libs/openai.client';
import { GetInformationAboutDomainTool } from './tools/GetInformationAboutDomain';
import { promptHelper } from '@/prompts/prompt.helper';
import { ResponseFunctionToolCall } from 'openai/resources/responses/responses';

export const ReportGeneratorService = {
  summarizeSite: async (siteUrl: string) => {
    const response = await openAiClient.responses.create({
      model: 'gpt-4.1-mini',
      tools: [
        { type: 'web_search_preview' },
        {
          type: 'function',
          name: 'GetInformationAboutDomainTool',
          description: 'Get information about a domain',
          parameters: {
            type: 'object',
            properties: {
              domain: { type: 'string' },
            },
          },
          strict: false,
        },
      ],
      instructions:
        'You are a helpful assistant that summarizes companies when provided their websites.',
      input: promptHelper.getPromptAndInject('summarize_site', {
        domain: siteUrl,
      }),
      tool_choice: 'required',
    });

    if (response.output?.[0]?.type === 'function_call') {
      const output = response.output[0] as ResponseFunctionToolCall;
      const functionName = output.name;
      const functionArgs = output.arguments;
      const functionResult = GetInformationAboutDomainTool();
    }

    return response;
  },
};
