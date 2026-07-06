import { getDb } from '../lib/db.js';
import { corsHeaders, handleCors } from '../lib/cors.js';
import { put } from '@vercel/blob';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const id = url.pathname.split('/').pop();
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const [employee] = await sql('SELECT * FROM employees WHERE id = $1', [id]);
      if (!employee) {
        return new Response(JSON.stringify({ error: 'Empleado no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(employee), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { rut, first_name, last_name, department, position, active, photo } = body;

      const [current] = await sql('SELECT * FROM employees WHERE id = $1', [id]);
      if (!current) {
        return new Response(JSON.stringify({ error: 'Empleado no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }

      let photo_url = current.photo_url;
      if (photo) {
        const buffer = base64ToBuffer(photo);
        const blob = await put(`employees/${crypto.randomUUID()}.jpg`, buffer, {
          access: 'public',
          contentType: 'image/jpeg'
        });
        photo_url = blob.url;
      }

      const now = new Date().toISOString();
      await sql(
        `UPDATE employees SET rut = $1, first_name = $2, last_name = $3, department = $4, 
         position = $5, photo_url = $6, active = $7, updated_at = $8 WHERE id = $9`,
        [
          rut || current.rut,
          first_name || current.first_name,
          last_name || current.last_name,
          department !== undefined ? department : current.department,
          position !== undefined ? position : current.position,
          photo_url,
          active !== undefined ? active : current.active,
          now,
          id
        ]
      );

      const [employee] = await sql('SELECT * FROM employees WHERE id = $1', [id]);
      return new Response(JSON.stringify(employee), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      const now = new Date().toISOString();
      await sql('UPDATE employees SET active = false, updated_at = $1 WHERE id = $2', [now, id]);
      return new Response(JSON.stringify({ message: 'Empleado desactivado' }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
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
