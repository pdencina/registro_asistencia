import { getDb } from '../lib/db.js';
import { corsHeaders, handleCors } from '../lib/cors.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req) {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const sql = getDb();

  try {
    const records = await sql(`
      SELECT ar.*, e.first_name, e.last_name, e.rut, e.department, e.photo_url
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE date(ar.timestamp) = CURRENT_DATE
      ORDER BY ar.timestamp DESC
    `);

    return new Response(JSON.stringify(records), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}
