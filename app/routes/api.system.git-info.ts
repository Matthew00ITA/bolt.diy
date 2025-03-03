import { json, type LoaderFunction } from '@remix-run/cloudflare';

export const loader: LoaderFunction = async () => {
  return json(
    {
      error: 'Git information is not available in the Cloudflare environment',
      message: 'This feature requires system-level access and is only available in a server environment.',
    },
    { status: 400 },
  );
};
