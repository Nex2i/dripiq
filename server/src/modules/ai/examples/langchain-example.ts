import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { LangChainReportServiceFactory } from '../langchain/LangChainReportServiceFactory';

// Example custom LangChain tool
const WeatherSchema = z.object({
  location: z.string().describe('The location to get weather for'),
});

class WeatherTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: 'WeatherTool',
      description: 'Get weather information for a location',
      schema: WeatherSchema,
      func: async (args: z.infer<typeof WeatherSchema>): Promise<string> => {
        const { location } = args;
        
        // Mock weather data - in reality this would call a weather API
        const mockWeather = {
          location,
          temperature: '72°F',
          condition: 'Sunny',
          humidity: '45%',
        };

        return JSON.stringify(mockWeather);
      },
    });
  }
}

// Example usage
export async function langChainExampleUsage() {
  const weatherTool = new WeatherTool();

  // Create service with custom LangChain tool
  const service = LangChainReportServiceFactory.createWithCustomTools([weatherTool]);

  // Or add to existing service
  const defaultService = LangChainReportServiceFactory.createWithDefaultTools();
  defaultService.addTool(weatherTool);

  return service;
}

export async function compareLangChainWithCustom() {
  // LangChain approach - uses agent pattern with built-in function calling
  const langChainService = LangChainReportServiceFactory.createWithDefaultTools({
    maxIterations: 5,
    model: 'gpt-4.1',
  });

  // Custom approach (existing)
  const { generalSiteReportService } = await import('../reportGenerator/generalSiteReport.factory');

  const testUrl = 'https://example.com';

  console.log('Testing LangChain approach...');
  const langChainResult = await langChainService.summarizeSite(testUrl);
  
  console.log('Testing custom approach...');
  const customResult = await generalSiteReportService.summarizeSite(testUrl);

  return {
    langChain: langChainResult,
    custom: customResult,
  };
}

// Migration helper function
export function migratePastService() {
  // If you have existing services using the old pattern:
  // 
  // OLD:
  // const service = GeneralSiteReportServiceFactory.createWithDefaultTools();
  // const result = await service.summarizeSite(url);
  //
  // NEW (LangChain):
  // const service = LangChainReportServiceFactory.createWithDefaultTools();
  // const result = await service.summarizeSite(url);
  //
  // The interface is the same, but LangChain handles function calling automatically!

  return LangChainReportServiceFactory.createWithDefaultTools();
}