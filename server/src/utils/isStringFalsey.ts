export function isStringFalsey(str?: string): boolean {
  if (!str) {
    return true;
  }

  const lowerCaseStr = str.toLowerCase();
  if (lowerCaseStr === 'false' || lowerCaseStr === 'null' || lowerCaseStr === 'undefined') {
    return true;
  }

  return false;
}
