export function getContentFromMessage(message: any): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length > 0) {
    if (typeof message[0]?.text === 'string') return message[0].text;
    return JSON.stringify(message[0]);
  }
  if (typeof message === 'object' && message !== null) {
    if (typeof message.text === 'string') return message.text;
    if (typeof message.content === 'string') return message.content;
    return JSON.stringify(message);
  }
  return String(message);
}
