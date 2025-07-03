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
};
