const { getDb } = require('../../lib/db');
const { corsHeaders, handleCors } = require('../../lib/cors');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
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

    return res.status(200).json({
      employee_id: id,
      status,
      last_record: lastRecord,
      next_action: status === 'present' ? 'exit' : 'entry'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
