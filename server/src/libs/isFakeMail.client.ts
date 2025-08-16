import axios from 'axios';

const isFakeMailClient = axios.create({
  baseURL: 'https://isfakemail.com/api',
});

async function isFakeMail(email: string): Promise<boolean> {
  const response = await isFakeMailClient.get(`/check?url=${email}&mx=true`);

  const { isDisposable, isPublicProvider, mx } = response.data;

  return !isDisposable && !isPublicProvider && mx.length > 0;
}

export default isFakeMail;
