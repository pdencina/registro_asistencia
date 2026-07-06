const { getDb } = require('../lib/db');
const { corsHeaders, handleCors } = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = getDb();
  const date = req.query.date || new Date().toISOString().split('T')[0];

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

    return res.status(200).json({
      date,
      total_employees: total,
      present_today: present,
      exited_today: exited,
      absent: total - present,
      last_records: lastRecords
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
