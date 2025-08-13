import { SendgridTokenHelper } from './sendgridToken.helper';

describe('SendgridTokenHelper.extractTokenFromUrlOrToken', () => {
  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTUyOTI0NjIsImlkIjoiNzc1Njk1NyIsInRva2VuX2lkIjoiMjczZWRjNjUtZWQ5OS00ODhlLThmZjQtYzkxYTZkOThmM2Y2IiwidXNlcl9pZCI6IjU0OTkyMTU1In0.XvP6I7tJUsyWcPnl6xM1IXhgHEx6VTB-YFB8sF2YCoM';

  it('returns token from a direct SendGrid verify URL', () => {
    const url = `https://app.sendgrid.com/settings/sender_auth/senders/verify?token=${sampleToken}`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(url)).toBe(sampleToken);
  });

  it('returns token from a raw token input', () => {
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(sampleToken)).toBe(sampleToken);
  });

  it('extracts token from Outlook Safe Links wrapped URL', () => {
    const safeLink = `https://nam11.safelinks.protection.outlook.com/?url=https%3A%2F%2Fapp.sendgrid.com%2Fsettings%2Fsender_auth%2Fsenders%2Fverify%3Ftoken%3D${sampleToken}%26utm_campaign%3Dwebsite%26utm_medium%3Demail%26utm_source%3Dsendgrid.com&data=05%7C02%7Cryanhutchison%40filevine.com%7C04b4ff97bf964d4a275408dddaae6002%7C3d1bbaf049274cfc92348281a92fb7ad%7C0%7C0%7C638907164673667652%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=LFjoYezE4avEPndJZ%2BZGFZXDjQFgR19TY3Tlj0EU43s%3D&reserved=0`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(safeLink)).toBe(sampleToken);
  });

  it("extracts token when wrapped under 'u' param", () => {
    const inner = `https://app.sendgrid.com/settings/sender_auth/senders/verify?token=${sampleToken}`;
    const wrapped = `https://redirector.example.com/?u=${encodeURIComponent(inner)}`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(wrapped)).toBe(sampleToken);
  });

  it("extracts token when wrapped under 'target' param", () => {
    const inner = `https://app.sendgrid.com/settings/sender_auth/senders/verify?token=${sampleToken}`;
    const wrapped = `https://redirector.example.com/?target=${encodeURIComponent(inner)}`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(wrapped)).toBe(sampleToken);
  });

  it("extracts token when wrapped under 'redirect' param", () => {
    const inner = `https://app.sendgrid.com/settings/sender_auth/senders/verify?token=${sampleToken}`;
    const wrapped = `https://redirector.example.com/?redirect=${encodeURIComponent(inner)}`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(wrapped)).toBe(sampleToken);
  });

  it('extracts token when nested URL is double-encoded', () => {
    const inner = `https://app.sendgrid.com/settings/sender_auth/senders/verify?token=${sampleToken}`;
    const doubleEncoded = encodeURIComponent(encodeURIComponent(inner));
    const wrapped = `https://nam11.safelinks.protection.outlook.com/?url=${doubleEncoded}`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(wrapped)).toBe(sampleToken);
  });

  it('extracts token from proofpoint-like encoded string', () => {
    const proofpoint = `https-3A__app.sendgrid.com-2Fsettings-2Fsender_auth-2Fsenders-2Fverify-3Ftoken-3D${sampleToken}-26extra-3D1`;
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(proofpoint)).toBe(sampleToken);
  });

  it('returns null when no token is present', () => {
    const url = 'https://example.com/some/path?foo=bar';
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(url)).toBeNull();
  });

  it('returns null for empty/whitespace input', () => {
    expect(SendgridTokenHelper.extractTokenFromUrlOrToken(' \n')).toBeNull();
  });
});