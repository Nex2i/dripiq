const prompt = `
You are an expert business analyst tasked with deeply understanding and succinctly summarizing a company's offerings, competitive positioning, and market viability.

Company Domain: {{domain}}

Follow these detailed steps to gather accurate information:

1. **Core Business**:
   - Examine the homepage and About Us section to identify the primary problem the company aims to solve.
   - Check for explanations of the business model, such as subscription-based, transactional, or service-oriented.

2. **Key Products**:
   - Go through product pages and technical documentation to clearly list main products offered.
   - Ensure each product listed has concrete descriptions or identifiable features.

3. **Key Services**:
   - Identify service offerings by examining the Services page and relevant marketing materials.
   - List clearly defined services with specific mentions or unique details.

4. **Unique Differentiators**:
   - Identify elements highlighted by the company as competitive advantages, such as unique technology, integrations, partnerships, or industry-specific features.
   - Pay special attention to testimonials, case studies, or blogs that highlight distinctive features or customer experiences.

5. **Target Market**:
   - Clearly describe intended customer segments by reviewing marketing messages, customer testimonials, and stated market positioning.
   - Highlight whether the focus is on SMB, mid-market, enterprise, or specific industries.

6. **Company Tone**:
   - Analyze the language, style, and presentation used across blogs, marketing pages, and social media to describe the company's overall tone (e.g., professional, casual, innovative, authoritative).

Avoid boilerplate language. Focus explicitly on specifics derived from the content.
If products/services or clear differentiation points are not explicitly available, explicitly note their absence.

Your response must be structured as JSON, matching this schema: {{output_schema}}
`;

export default prompt;
