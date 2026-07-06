import { getDb } from '../lib/db.js';
import { corsHeaders, handleCors } from '../lib/cors.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const sql = getDb();
  const url = new URL(req.url);
  const employee_id = url.searchParams.get('employee_id');
  const start_date = url.searchParams.get('start_date');
  const end_date = url.searchParams.get('end_date');
  const type = url.searchParams.get('type');
  const department = url.searchParams.get('department');

  try {
    let query = `
      SELECT ar.*, e.first_name, e.last_name, e.rut, e.department, e.photo_url
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (employee_id) {
      query += ` AND ar.employee_id = $${idx++}`;
      params.push(employee_id);
    }
    if (start_date) {
      query += ` AND date(ar.timestamp) >= $${idx++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND date(ar.timestamp) <= $${idx++}`;
      params.push(end_date);
    }
    if (type) {
      query += ` AND ar.type = $${idx++}`;
      params.push(type);
    }
    if (department) {
      query += ` AND e.department = $${idx++}`;
      params.push(department);
    }

    query += ' ORDER BY ar.timestamp DESC LIMIT 500';
    const records = await sql(query, params);

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
