import { getDb } from '../lib/db.js';
import { corsHeaders, handleCors } from '../lib/cors.js';
import { put } from '@vercel/blob';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const search = url.searchParams.get('search');
      const active = url.searchParams.get('active');

      let query = 'SELECT * FROM employees WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (search) {
        query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex + 1} OR rut ILIKE $${paramIndex + 2})`;
        const term = `%${search}%`;
        params.push(term, term, term);
        paramIndex += 3;
      }
      if (active !== null && active !== undefined && active !== '') {
        query += ` AND active = $${paramIndex}`;
        params.push(active === '1' || active === 'true');
        paramIndex++;
      }

      query += ' ORDER BY last_name, first_name';
      const rows = await sql(query, params);

      return new Response(JSON.stringify(rows), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { rut, first_name, last_name, department, position, photo } = body;

      if (!rut || !first_name || !last_name) {
        return new Response(JSON.stringify({ error: 'RUT, nombre y apellido son obligatorios' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }

      // Check duplicado
      const existing = await sql('SELECT id FROM employees WHERE rut = $1', [rut]);
      if (existing.length > 0) {
        return new Response(JSON.stringify({ error: 'Ya existe un empleado con ese RUT' }), {
          status: 409,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
      }

      // Subir foto a Vercel Blob si viene
      let photo_url = null;
      if (photo) {
        const buffer = base64ToBuffer(photo);
        const blob = await put(`employees/${crypto.randomUUID()}.jpg`, buffer, {
          access: 'public',
          contentType: 'image/jpeg'
        });
        photo_url = blob.url;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await sql(
        `INSERT INTO employees (id, rut, first_name, last_name, department, position, photo_url, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)`,
        [id, rut, first_name, last_name, department || null, position || null, photo_url, now, now]
      );

      const [employee] = await sql('SELECT * FROM employees WHERE id = $1', [id]);
      return new Response(JSON.stringify(employee), {
        status: 201,
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
