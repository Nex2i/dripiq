import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { IAIClient, IAIMessage, IAIResponse, IAIRequestOptions } from '../interfaces/IAIClient';
import { AI_MODELS } from '../reportGenerator/shared';

export class LangChainAIClient implements IAIClient {
  private chat: ChatOpenAI;
  private tools: DynamicStructuredTool[] = [];
  private conversationMessages: any[] = [];

  constructor() {
    this.chat = new ChatOpenAI({
      modelName: AI_MODELS.GPT_4_1,
      temperature: 0,
    });
  }

  setTools(tools: DynamicStructuredTool[]): void {
    this.tools = tools;
  }

  async generateResponse(messages: IAIMessage[], options?: IAIRequestOptions): Promise<IAIResponse> {
    try {
      // Convert our message format to LangChain format
      const langChainMessages = this.convertToLangChainMessages(messages);
      
      // Configure the model for this request
      const chatModel = new ChatOpenAI({
        modelName: options?.model || AI_MODELS.GPT_4_1,
        temperature: 0,
      });

      // Bind tools if available
      const modelWithTools = this.tools.length > 0 
        ? chatModel.bindTools(this.tools)
        : chatModel;

      // Store conversation for continuity
      this.conversationMessages = langChainMessages;

      const response = await modelWithTools.invoke(langChainMessages);

      return this.convertFromLangChainResponse(response);
    } catch (error) {
      throw new Error(`LangChain AI request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async continueConversation(
    toolCallResults: Array<{ toolCallId: string; result: string }>,
    options?: IAIRequestOptions
  ): Promise<IAIResponse> {
    try {
      // Add tool results to conversation
      const toolMessages = toolCallResults.map(result => 
        new ToolMessage({
          content: result.result,
          tool_call_id: result.toolCallId,
        })
      );

      this.conversationMessages.push(...toolMessages);

      // Configure the model
      const chatModel = new ChatOpenAI({
        modelName: options?.model || AI_MODELS.GPT_4_1,
        temperature: 0,
      });

      // Bind tools if available
      const modelWithTools = this.tools.length > 0 
        ? chatModel.bindTools(this.tools)
        : chatModel;

      const response = await modelWithTools.invoke(this.conversationMessages);

      // Add the response to conversation history
      this.conversationMessages.push(response);

      return this.convertFromLangChainResponse(response);
    } catch (error) {
      throw new Error(`LangChain conversation continuation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private convertToLangChainMessages(messages: IAIMessage[]): any[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            return new AIMessage({
              content: msg.content || '',
              tool_calls: msg.toolCalls.map(tc => ({
                id: tc.id,
                name: tc.name,
                args: tc.arguments,
              })),
            });
          }
          return new AIMessage(msg.content || '');
        case 'tool':
          return new ToolMessage({
            content: msg.content,
            tool_call_id: msg.toolCallId || '',
          });
        default:
          return new HumanMessage(msg.content);
      }
    });
  }

  private convertFromLangChainResponse(response: any): IAIResponse {
    const toolCalls = response.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.args,
    })) || [];

    return {
      id: response.id || `langchain-${Date.now()}`,
      content: response.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  // Method to reset conversation state
  resetConversation(): void {
    this.conversationMessages = [];
  }
}