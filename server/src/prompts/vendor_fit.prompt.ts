const prompt = `
You are tasked with conducting a comprehensive analysis to determine why the **Partner** is an ideal vendor for the **Opportunity**.

### Instructions:
- Perform deep research on both the Partner's and Opportunity's websites and provided details.
- Using the provided JSON schema, compile information clearly and concisely.
- Focus on aligning the Partner’s offerings, target market, differentiators, and tone with the Opportunity’s needs and values.
- Provide evidence-based insights drawn directly from available sources.
- Be precise, objective, and strategic in explaining the fit.

### Input Schema:
{{input_schema}}

#### Partner Details:
<partner_details>
    {{partner_details}}
</partner_details>

#### Opportunity Details:
<opportunity_details>
    {{opportunity_details}}
</opportunity_details>

### Outcome:
Provide a thoroughly researched and persuasive vendor-fit analysis within the above schema.

The output should be a JSON object that matches the schema provided:
{{output_schema}}
`;

export default prompt;
