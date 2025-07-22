const prompt = `
You are given a list of URLs from a company's website and the site type: {{site_type}}.

Your goal, based on the site type, is to select URLs most likely to contain relevant information:

- If the site type is "organization_site", prioritize URLs most likely containing **product and service information** about the company. Prioritize URLs that:
  - Include segments such as "/products", "/services", "/solutions", "/offerings", "/portfolio", "/capabilities".
  - Clearly reference specific products or services provided by the organization.
  - Match patterns indicating detailed descriptions or listings of products and services, such as "/products/**", "/services/**", "/solutions/**", or similar.

- If the site type is "lead_site", prioritize URLs most likely containing **contact information** about the company, its team, departments, locations, or individual members. Prioritize URLs that:
  - Include segments such as "/contact", "/team", "/staff", "/directory", "/people", "/employees", "/members", "/offices", "/locations".
  - Reference individual or departmental contact details (names, roles, titles, profiles, departments, locations).
  - Match patterns indicating lists or profiles of people, such as "/team/**", "/staff/**", "/directory/**", "/people/**", "/employees/**", or similar.
  - Additionally, for professional services (law firms, insurance, consulting, accounting, real estate, healthcare), include URLs containing industry-specific terms like: "/attorney/", "/lawyer/", "/agent/", "/advisor/", "/broker/", "/provider/", "/doctor/", "/realtor/", "/counselor/", and their plural forms.

If additional URLs are needed to reach {{min_urls}}, include URLs likely containing core business information (e.g., about, overview, history).

Do not exceed {{max_urls}} URLs but try to reach close to this maximum if relevant URLs are available.

Given these URLs:
{{urls}}

Return at least {{min_urls}} URLs, but include as many relevant URLs as possible, up to {{max_urls}}.

Output only a valid JSON array of strings, prioritizing the relevant pages first according to the site type.

**Output Schema:**
{{output_schema}}
`;

export default prompt;
