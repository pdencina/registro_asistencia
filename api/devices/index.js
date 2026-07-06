const { getDb } = require('../lib/db');
const { corsHeaders, handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const sql = getDb();

  // Ensure table exists
  await sql(`
    CREATE TABLE IF NOT EXISTS authorized_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(100) DEFAULT 'Tótem',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  try {
    // GET: Check if device is authorized
    if (req.method === 'GET') {
      const { device_id } = req.query;

      if (!device_id) {
        return res.status(400).json({ error: 'device_id es requerido' });
      }

      const [device] = await sql(
        'SELECT * FROM authorized_devices WHERE device_id = $1 AND active = true',
        [device_id]
      );

      return res.status(200).json({
        authorized: !!device,
        device: device || null,
      });
    }

    // POST: Authorize a new device (requires admin PIN)
    if (req.method === 'POST') {
      const { device_id, pin, name } = req.body;

      if (!device_id || !pin) {
        return res.status(400).json({ error: 'device_id y pin son requeridos' });
      }

      const correctPin = process.env.ADMIN_PIN || '1234';
      if (pin !== correctPin) {
        return res.status(401).json({ error: 'PIN incorrecto' });
      }

      // Check if already exists
      const [existing] = await sql(
        'SELECT * FROM authorized_devices WHERE device_id = $1',
        [device_id]
      );

      if (existing) {
        await sql(
          'UPDATE authorized_devices SET active = true, name = $1, updated_at = NOW() WHERE device_id = $2',
          [name || existing.name, device_id]
        );
      } else {
        // Deactivate all other devices when activating a new one
        await sql('UPDATE authorized_devices SET active = false, updated_at = NOW()');

        await sql(
          'INSERT INTO authorized_devices (id, device_id, name, active, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW())',
          [crypto.randomUUID(), device_id, name || 'Tótem']
        );
      }

      return res.status(200).json({ authorized: true, message: 'Dispositivo autorizado' });
    }

    // DELETE: Deauthorize device
    if (req.method === 'DELETE') {
      const { device_id, pin } = req.body;

      const correctPin = process.env.ADMIN_PIN || '1234';
      if (pin !== correctPin) {
        return res.status(401).json({ error: 'PIN incorrecto' });
      }

      await sql(
        'UPDATE authorized_devices SET active = false, updated_at = NOW() WHERE device_id = $1',
        [device_id]
      );

      return res.status(200).json({ message: 'Dispositivo desautorizado' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
