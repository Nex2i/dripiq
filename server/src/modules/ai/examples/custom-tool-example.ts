import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import { GeneralSiteReportServiceFactory } from '../reportGenerator/generalSiteReport.factory';

// Example: Custom tool that gets weather information
export class WeatherTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'WeatherTool',
      description: 'Get current weather information for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to get weather for',
          },
        },
        required: ['location'],
      },
    };
  }

  async execute(args: any): Promise<IToolResult> {
    try {
      const { location } = args;

      if (!location) {
        return {
          success: false,
          error: 'Location is required',
        };
      }

      // Mock weather data
      const mockWeatherData = {
        location,
        temperature: '72°F',
        condition: 'Partly cloudy',
        humidity: '65%',
      };

      return {
        success: true,
        data: mockWeatherData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

// Example usage
export async function exampleUsage() {
  const weatherTool = new WeatherTool();

  // Create service with custom tool
  const service = GeneralSiteReportServiceFactory.createWithCustomTools([weatherTool]);

  // Or add to existing service
  const defaultService = GeneralSiteReportServiceFactory.createDefault();
  defaultService.registerTool(weatherTool);

  return service;
}
