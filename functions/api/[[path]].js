export async function onRequest(context) {
  // This will handle all Flask routes
  const { request, env } = context;
  
  // For now, redirect to your actual server
  // You'll need to convert Flask routes to Cloudflare Functions
  return new Response('Dashboard API', { status: 200 });
}
