// API entry point for SnapWeb
export default {
  async fetch(request: Request, env: any, ctx: any) {
    return new Response('SnapWeb API is running', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  },
};