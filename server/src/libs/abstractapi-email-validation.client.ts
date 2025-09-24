import axios from 'axios';

interface AbstractApiEmailValidationResponse {
  email: string;
  autocorrect: string;
  deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN';
  quality_score: number;
  is_valid_format: {
    value: boolean;
    text: string;
  };
  is_free_email: {
    value: boolean;
    text: string;
  };
  is_disposable_email: {
    value: boolean;
    text: string;
  };
  is_role_email: {
    value: boolean;
    text: string;
  };
  is_catchall_email: {
    value: boolean;
    text: string;
  };
  is_mx_found: {
    value: boolean;
    text: string;
  };
  is_smtp_valid: {
    value: boolean;
    text: string;
  };
}

interface AbstractApiEmailValidationError {
  error: {
    code: string;
    message: string;
    details: string;
  };
}

class AbstractApiEmailValidationClient {
  private readonly baseURL = 'https://emailvalidation.abstractapi.com/v1/';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY || '';
    if (!this.apiKey) {
      throw new Error('AbstractAPI Email Validation API key is required');
    }
  }

  async validateEmail(email: string): Promise<AbstractApiEmailValidationResponse> {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          api_key: this.apiKey,
          email: email,
        },
        timeout: 10000, // 10 second timeout
      });

      // Check if response contains an error
      const data = response.data as
        | AbstractApiEmailValidationResponse
        | AbstractApiEmailValidationError;

      if ('error' in data) {
        throw new Error(`AbstractAPI Error: ${data.error.message} (${data.error.code})`);
      }

      return data as AbstractApiEmailValidationResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid AbstractAPI Email Validation API key');
        }
        if (error.response?.status === 429) {
          throw new Error('AbstractAPI rate limit exceeded');
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('AbstractAPI request timeout');
        }
        throw new Error(`AbstractAPI request failed: ${error.message}`);
      }
      throw error;
    }
  }
}

// Export a singleton instance
const abstractApiEmailValidationClient = new AbstractApiEmailValidationClient();

export { AbstractApiEmailValidationClient, abstractApiEmailValidationClient };
export type { AbstractApiEmailValidationResponse, AbstractApiEmailValidationError };
