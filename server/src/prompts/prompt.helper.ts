import summarizeSite from './summarize_site';

export type PromptTypes = 'summarize_lead' | 'summarize_organization' | 'summarize_site';

const prompts: Record<string, string> = {
  summarize_site: summarizeSite,
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
  getPromptAndInject: (promptType: PromptTypes, inputVariables: Record<string, string>) => {
    try {
      const prompt = prompts[promptType];

      if (!prompt) {
        throw new Error(`Prompt type '${promptType}' not found`);
      }

      return promptHelper.injectInputVariables(prompt, inputVariables);
    } catch (error) {
      throw error;
    }
  },
};
