import type { WebDataEmployee } from '@/libs/webData/interfaces/webData.interface';
import type { ZoomInfoContactResource } from '@/libs/webData/zoominfo.types';

export function mapZoomInfoContactToWebDataEmployee(
  resource: ZoomInfoContactResource
): WebDataEmployee {
  const a = resource.attributes;
  const parts = [a?.firstName, a?.middleName, a?.lastName].filter(Boolean);
  const fullName = parts.length ? parts.join(' ') : undefined;

  return {
    id: resource.id,
    first_name: a?.firstName,
    last_name: a?.lastName,
    full_name: fullName,
    job_title: a?.jobTitle,
    job_level: a?.managementLevel,
    company_id: a?.company?.id != null ? String(a.company.id) : undefined,
    company_name: a?.company?.name,
    updated_at: a?.lastUpdatedDate,
    created_at: a?.validDate,
  };
}
