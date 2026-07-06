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
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const [totalEmployees] = await sql('SELECT COUNT(*) as count FROM employees WHERE active = true');

    const [presentToday] = await sql(`
      SELECT COUNT(DISTINCT employee_id) as count 
      FROM attendance_records 
      WHERE date(timestamp) = $1 AND type = 'entry'
    `, [date]);

    const [exitedToday] = await sql(`
      SELECT COUNT(DISTINCT employee_id) as count 
      FROM attendance_records 
      WHERE date(timestamp) = $1 AND type = 'exit'
    `, [date]);

    const lastRecords = await sql(`
      SELECT ar.*, e.first_name, e.last_name, e.photo_url
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE date(ar.timestamp) = $1
      ORDER BY ar.timestamp DESC
      LIMIT 10
    `, [date]);

    const total = Number(totalEmployees?.count || 0);
    const present = Number(presentToday?.count || 0);
    const exited = Number(exitedToday?.count || 0);

    return new Response(JSON.stringify({
      date,
      total_employees: total,
      present_today: present,
      exited_today: exited,
      absent: total - present,
      last_records: lastRecords
    }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}
