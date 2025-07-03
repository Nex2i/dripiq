const prompt = `
You are a business analyst tasked with understanding and summarizing a company's product offerings and market position.

The company domain is: {{domain}}

Using all available data from this domain—including product pages, marketing content, technical documentation, blog posts, and landing pages—generate a well-structured, multi-paragraph summary that includes the following:

1. **What the company does** – A high-level explanation of its core business.
2. **What products or services it offers** – Detailed but concise breakdown of key offerings.
3. **Notable features or differentiators** – What makes the offering stand out in its industry.
4. **Target market and positioning** – Who the company is trying to serve, and how it positions itself competitively.
5. **Tone** – Professional, informative, and objective.

Avoid repeating boilerplate or vague statements. Focus on real, specific value the company communicates through its site content. Keep the summary under 500 words.

If no concrete product or service is mentioned, state that explicitly.

Domain: **{{domain}}**

`;

export default prompt;
