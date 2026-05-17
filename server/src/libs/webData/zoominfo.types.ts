export type ZoomInfoTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type ZoomInfoJsonApiError = {
  errors?: Array<{
    id?: string;
    code?: string;
    detail?: string;
    status?: string;
    title?: string;
  }>;
  detail?: string;
  title?: string;
};

export type ZoomInfoCompanyResource = {
  id: string;
  type: string;
  attributes?: {
    name?: string;
    website?: string;
    city?: string;
    state?: string;
    logo?: string;
  };
};

export type ZoomInfoCompanySearchResponse = {
  data: ZoomInfoCompanyResource[];
  meta?: {
    totalResults?: number;
    page?: { number?: number; total?: number };
  };
};

export type ZoomInfoContactCompany = {
  id?: number;
  name?: string;
};

export type ZoomInfoContactResource = {
  id: string;
  type: string;
  attributes?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    jobTitle?: string;
    managementLevel?: string;
    company?: ZoomInfoContactCompany;
    contactAccuracyScore?: number;
    hasEmail?: boolean;
    hasDirectPhone?: boolean;
    hasMobilePhone?: boolean;
    lastUpdatedDate?: string;
    validDate?: string;
  };
};

export type ZoomInfoContactSearchResponse = {
  data: ZoomInfoContactResource[];
  meta?: {
    totalResults?: number;
    page?: { number?: number; total?: number };
  };
};

export type CachedZoomInfoToken = {
  accessToken: string;
  expiresAtMs: number;
};
