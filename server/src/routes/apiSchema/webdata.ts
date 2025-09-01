import { Type } from '@sinclair/typebox';

export const WebDataEmployeesRequestSchema = {
  body: Type.Object({
    domainUrl: Type.String({
      description: 'The website URL to search for employees',
      examples: ['https://www.leventhal-law.com/', 'leventhal-law.com'],
    }),
    isDecisionMaker: Type.Optional(
      Type.Boolean({
        description: 'Filter for decision makers only',
        default: true,
      })
    ),
  }),
};

export const WebDataEmployeesResponseSchema = {
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Object({
        employees: Type.Array(
          Type.Object({
            id: Type.String(),
            full_name: Type.Optional(Type.String()),
            first_name: Type.Optional(Type.String()),
            last_name: Type.Optional(Type.String()),
            email: Type.Optional(Type.String()),
            job_title: Type.Optional(Type.String()),
            job_department: Type.Optional(Type.String()),
            job_level: Type.Optional(Type.String()),
            company_name: Type.Optional(Type.String()),
            company_domain: Type.Optional(Type.String()),
            linkedin_url: Type.Optional(Type.String()),
            location: Type.Optional(
              Type.Object({
                country: Type.Optional(Type.String()),
                region: Type.Optional(Type.String()),
                city: Type.Optional(Type.String()),
              })
            ),
            skills: Type.Optional(Type.Array(Type.String())),
            experience: Type.Optional(
              Type.Array(
                Type.Object({
                  company_name: Type.Optional(Type.String()),
                  job_title: Type.Optional(Type.String()),
                  start_date: Type.Optional(Type.String()),
                  end_date: Type.Optional(Type.String()),
                  description: Type.Optional(Type.String()),
                })
              )
            ),
            created_at: Type.Optional(Type.String()),
            updated_at: Type.Optional(Type.String()),
          })
        ),
        total_count: Type.Number(),
        company_domain: Type.String(),
        provider: Type.String(),
      }),
    }),
  },
};
