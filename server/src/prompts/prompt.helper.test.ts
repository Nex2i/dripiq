import { promptHelper } from './prompt.helper';

describe('promptHelper', () => {
  describe('injectInputVariables', () => {
    it('should replace a single variable correctly', () => {
      const prompt = 'Hello {{name}}!';
      const inputVariables = { name: 'John' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple variables correctly', () => {
      const prompt = 'Hello {{name}}, you are {{age}} years old and live in {{city}}.';
      const inputVariables = { name: 'Alice', age: '25', city: 'New York' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hello Alice, you are 25 years old and live in New York.');
    });

    it('should replace the same variable multiple times', () => {
      const prompt = '{{greeting}} {{name}}! How are you today, {{name}}?';
      const inputVariables = { greeting: 'Hi', name: 'Bob' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hi Bob! How are you today, Bob?');
    });

    it('should throw error when variable not found in inputVariables', () => {
      const prompt = 'Hello {{name}}, you are {{age}} years old.';
      const inputVariables = { name: 'Charlie' };
      expect(() => {
        promptHelper.injectInputVariables(prompt, inputVariables);
      }).toThrow('Input variable {{age}} not found in prompt');
    });

    it('should handle empty prompt string', () => {
      const prompt = '';
      const inputVariables = { name: 'Dave' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('');
    });

    it('should throw error when inputVariables is empty but prompt has variables', () => {
      const prompt = 'Hello {{name}}!';
      const inputVariables = {};
      expect(() => {
        promptHelper.injectInputVariables(prompt, inputVariables);
      }).toThrow('Input variable {{name}} not found in prompt');
    });

    it('should handle prompt with no variables', () => {
      const prompt = 'Hello World!';
      const inputVariables = { name: 'Eve' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hello World!');
    });

    it('should handle variables with spaces around the name', () => {
      const prompt = 'Hello {{ name }}!';
      const inputVariables = { ' name ': 'Frank' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hello Frank!');
    });

    it('should handle variables with special characters', () => {
      const prompt = 'Welcome to {{site_name}} version {{app-version}}!';
      const inputVariables = { site_name: 'MyApp', 'app-version': '1.0.0' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Welcome to MyApp version 1.0.0!');
    });

    it('should throw error for nested braces when inner variable is missing', () => {
      const prompt = 'Code: {{code}} with nested {{inner{{outer}}}}';
      const inputVariables = { code: 'ABC123' };
      expect(() => {
        promptHelper.injectInputVariables(prompt, inputVariables);
      }).toThrow('Input variable {{inner{{outer}} not found in prompt');
    });

    it('should handle malformed variables (single braces)', () => {
      const prompt = 'Hello {name} and {{title}}!';
      const inputVariables = { name: 'Grace', title: 'Dr.' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hello {name} and Dr.!');
    });

    it('should be case sensitive for variable names', () => {
      const prompt = 'Hello {{Name}} and {{name}}!';
      const inputVariables = { name: 'henry', Name: 'Henry' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Hello Henry and henry!');
    });

    it('should handle empty string values (limitation: empty strings are not replaced)', () => {
      const prompt = 'Hello {{name}}{{suffix}}!';
      const inputVariables = { name: 'Ivy', suffix: '' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      // Current implementation limitation: empty string values are treated as falsy
      expect(result).toBe('Hello Ivy{{suffix}}!');
    });

    it('should demonstrate falsy value behavior', () => {
      const prompt = 'Status: {{active}}, Count: {{count}}, Value: {{value}}';
      const inputVariables = { active: '', count: '0', value: 'false' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      // Only truthy string values get replaced
      expect(result).toBe('Status: {{active}}, Count: 0, Value: false');
    });

    it('should handle numeric-like variable names', () => {
      const prompt = 'Item {{1}} costs ${{price1}} and item {{2}} costs ${{price2}}.';
      const inputVariables = { '1': 'Apple', price1: '1.50', '2': 'Banana', price2: '0.75' };
      const result = promptHelper.injectInputVariables(prompt, inputVariables);
      expect(result).toBe('Item Apple costs $1.50 and item Banana costs $0.75.');
    });

    it('should handle complex real-world example', () => {
      const prompt = `
Dear {{customer_name}},

Thank you for your order #{{order_id}}. 
Your {{product_count}} items will be shipped to:

{{address}}

Estimated delivery: {{delivery_date}}

Best regards,
{{company_name}}
      `.trim();

      const inputVariables = {
        customer_name: 'John Smith',
        order_id: 'ORD-12345',
        product_count: '3',
        address: '123 Main St, Anytown, USA',
        delivery_date: 'March 15, 2024',
        company_name: 'DripIQ',
      };

      const result = promptHelper.injectInputVariables(prompt, inputVariables);

      expect(result).toBe(
        `
Dear John Smith,

Thank you for your order #ORD-12345. 
Your 3 items will be shipped to:

123 Main St, Anytown, USA

Estimated delivery: March 15, 2024

Best regards,
DripIQ
      `.trim()
      );
    });

    // Additional validation tests
    describe('validation behavior', () => {
      it('should throw error with specific missing variable name', () => {
        const prompt = 'Hello {{firstName}} {{lastName}}!';
        const inputVariables = { firstName: 'John' };
        expect(() => {
          promptHelper.injectInputVariables(prompt, inputVariables);
        }).toThrow('Input variable {{lastName}} not found in prompt');
      });

      it('should throw error for first missing variable when multiple are missing', () => {
        const prompt = 'Hello {{name}} from {{city}} in {{country}}!';
        const inputVariables = { name: 'Alice' };
        expect(() => {
          promptHelper.injectInputVariables(prompt, inputVariables);
        }).toThrow('Input variable {{city}} not found in prompt');
      });

      it('should validate all variables before replacement', () => {
        const prompt = 'User {{id}} has role {{role}}';
        const inputVariables = { id: '123' }; // missing 'role'
        expect(() => {
          promptHelper.injectInputVariables(prompt, inputVariables);
        }).toThrow('Input variable {{role}} not found in prompt');
      });

      it('should handle empty inputVariables with no variables in prompt', () => {
        const prompt = 'No variables here!';
        const inputVariables = {};
        const result = promptHelper.injectInputVariables(prompt, inputVariables);
        expect(result).toBe('No variables here!');
      });
    });
  });
});
