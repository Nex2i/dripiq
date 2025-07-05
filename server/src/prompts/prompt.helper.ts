import { logger } from '@/libs/logger';
import summarizeSite from './summarize_site.prompt';
import vendorFit from './vendor_fit.prompt';

export type PromptTypes = 'summarize_site' | 'vendor_fit';

const prompts: Record<string, string> = {
  summarize_site: summarizeSite,
  vendor_fit: vendorFit,
};

export const promptHelper = {
  injectInputVariables: (prompt: string, inputVariables: Record<string, string>) => {
    const promptVariables = prompt.match(/{{(.*?)}}/g);
    if (promptVariables) {
      promptVariables.forEach((variable) => {
        const variableName = variable.slice(2, -2); // Remove {{ and }}
        if (!(variableName in inputVariables)) {
          throw new Error(`Input variable ${variable} not found in prompt`);
        }
      });
    }

    return prompt.replace(/{{(.*?)}}/g, (match, p1) => {
      return inputVariables[p1] || match;
    });
  },
  getPromptAndInject: (promptType: PromptTypes, inputVariables: Record<string, string>): string => {
    try {
      const prompt = prompts[promptType];

      if (!prompt) {
        throw new Error(`Prompt type '${promptType}' not found`);
      }

      return promptHelper.injectInputVariables(prompt, inputVariables);
    } catch (error) {
      logger.error(`Error getting prompt and injecting input variables`, error);
      throw error;
    }
  },
};
