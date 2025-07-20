const prompt = `
You are given a list of URLs from a company's website.

Your main goal is to **find all pages that contain core business information** for the company.

To do this, prioritize URLs that:
- Contain segments like "/about", "/services", "/products", "/solutions", "/offerings", "/portfolio", or similar.
- Contain terms that indicate business information (such as company overview, mission, values, history, capabilities, case studies, or portfolio).
- Match URL patterns likely to describe the business, such as "/about/**", "/services/**", "/products/**", "/solutions/**", "/company/**", or "/business/**".

**For professional services (like law firms, insurance agencies, consulting, accounting, real estate, and healthcare):**
- Also prioritize URLs containing industry-specific patterns, such as "/practice-areas/", "/specialties/", "/industries/", "/expertise/", "/capabilities/", or "/focus-areas/".

Select all URLs matching any of these criteria.

If more URLs are needed to meet {{min_urls}}, then select those most likely to contain additional business information (departments, divisions, company news, or company overview).
Do not pass the max URL count of {{max_urls}}.

Given these URLs:
{{urls}}

Return at least {{min_urls}} URLs. If there are not enough, return as many as possible. If you find more, return more.

Output only a valid JSON array of strings containing the most relevant URLs, with core business information pages as the top priority.

**Output Schema:**
{{output_schema}}
`;

export default prompt;
