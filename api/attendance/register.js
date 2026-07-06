import { getDb } from '../lib/db.js';
import { corsHeaders, handleCors } from '../lib/cors.js';
import { put } from '@vercel/blob';

export default async function handler(req) {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const sql = getDb();

  try {
    const { employee_id, type, photo_snapshot, notes } = await req.json();

    if (!employee_id || !type) {
      return new Response(JSON.stringify({ error: 'employee_id y type son obligatorios' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    if (!['entry', 'exit'].includes(type)) {
      return new Response(JSON.stringify({ error: 'type debe ser "entry" o "exit"' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    // Verificar empleado activo
    const [employee] = await sql('SELECT * FROM employees WHERE id = $1 AND active = true', [employee_id]);
    if (!employee) {
      return new Response(JSON.stringify({ error: 'Empleado no encontrado o inactivo' }), {
        status: 404,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    // Subir snapshot a Blob
    let snapshot_url = null;
    if (photo_snapshot) {
      const buffer = base64ToBuffer(photo_snapshot);
      const blob = await put(`snapshots/${crypto.randomUUID()}.jpg`, buffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
      snapshot_url = blob.url;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql(
      `INSERT INTO attendance_records (id, employee_id, type, timestamp, photo_snapshot_url, method, notes)
       VALUES ($1, $2, $3, $4, $5, 'visual', $6)`,
      [id, employee_id, type, now, snapshot_url, notes || null]
    );

    const [record] = await sql(`
      SELECT ar.*, e.first_name, e.last_name, e.rut, e.department
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ar.id = $1
    `, [id]);

    return new Response(JSON.stringify(record), {
      status: 201,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}

function base64ToBuffer(base64) {
  const data = base64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
