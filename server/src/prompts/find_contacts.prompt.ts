const prompt = `
You are an expert at extracting business contact information from company websites.

**Company Domain**: {{domain}}

**Instructions:**
- Search all available company web pages for contact details.
- Prioritize contacts for specific people at the company (executives, team members, department heads, support leads, recruiters, etc.).
- For each contact found:
  - Extract the initial details:
    - Name
    - Role or department
    - LinkedIn or professional profiles
    - Contact form links
    - Context or source (page/finding location)
  - Perform additional tool calls (if available) to locate:
    - Email address
    - Direct phone number
- If no individual contacts are found, provide the most direct general company contact details (info@, office phone, HQ address, etc.).
- Ignore boilerplate or generic info unless no other option is available.
- Do **not** speculate or invent data not present on the website.
- If nothing is available, state explicitly that no contact information could be found.

**Return the information as valid JSON matching this schema:** {{output_schema}}
`;

export default prompt;
