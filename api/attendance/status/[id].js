import { getDb } from '../../lib/db.js';
import { corsHeaders, handleCors } from '../../lib/cors.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const sql = getDb();

  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await sql(`
      SELECT * FROM attendance_records 
      WHERE employee_id = $1 AND date(timestamp) = $2
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [id, today]);

    const lastRecord = records.length > 0 ? records[0] : null;
    const status = !lastRecord ? 'absent' :
                   lastRecord.type === 'entry' ? 'present' : 'exited';

    return new Response(JSON.stringify({
      employee_id: id,
      status,
      last_record: lastRecord,
      next_action: status === 'present' ? 'exit' : 'entry'
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
