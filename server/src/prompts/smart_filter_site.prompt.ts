const prompt = `
You are given a list of URLs from a company's website.

Your main goal is to **find all pages that contain contact information** for the company, its people, or its departments.

To do this, prioritize URLs that:
- Contain segments like "/contact", "/team", "/staff", "/directory", "/people", "/employees", "/members", "/offices", "/locations", or similar.
- Contain terms that indicate individual or group contact details (such as names, titles, roles, staff directories, profiles, departments, or office locations).
- Match URL patterns likely to list or detail multiple people, such as "/team/**", "/staff/**", "/directory/**", "/people/**", "/members/**", or "/employees/**".

**For professional services (like law firms, insurance agencies, consulting, accounting, real estate, and healthcare):**
- Also prioritize URLs containing industry-specific patterns, such as "/attorney/", "/attorneys", "/lawyer/", "/lawyers", "/agent/", "/agents", "/advisor/", "/advisors", "/broker/", "/brokers", "/provider/", "/providers", "/doctor/", "/doctors", "/realtor/", "/realtors", or "/counselor/".

Select all URLs matching any of these criteria.

If more URLs are needed to meet {{min_urls}}, then select those most likely to contain core business information (about, services, products, departments, divisions, or company overview).
Do not pass the max URL count of {{max_urls}}.

Given these URLs:
{{urls}}

Return at least {{min_urls}} URLs. If there are not enough, return as many as possible. If you find more, return more.

Output only a valid JSON array of strings containing the most relevant URLs, with contact and people/staff/industry-professional pages as the top priority.

**Output Schema:**
{{output_schema}}
`;

export default prompt;
