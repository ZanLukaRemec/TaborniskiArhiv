const express = require('express');
const { requireRole } = require('../auth');
const pool = require('../db');

const router = express.Router();
const AUDIT_TABLES = new Set(['porocilo', 'predloga_obrazca']);

router.use(requireRole('administrator'));

router.get('/dnevnik', async (req, res) => {
  const table = req.query.tabela ? String(req.query.tabela) : '';
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);

  if (table && !AUDIT_TABLES.has(table)) {
    res.status(400).json({ error: 'Izbrana tabela dnevnika ni veljavna.' });
    return;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    res.status(400).json({ error: 'Omejitev dnevnika mora biti med 1 in 100.' });
    return;
  }

  const whereSql = table ? 'WHERE d.tabela = ?' : '';
  const params = table ? [table, limit] : [limit];

  try {
    const [rows] = await pool.query(`
      SELECT
        d.id,
        d.akcija,
        d.tabela,
        d.zapis_id,
        DATE_FORMAT(d.datum, '%Y-%m-%d %H:%i:%s') AS datum,
        d.avtor_id,
        c.ime AS avtor_ime,
        c.priimek AS avtor_priimek
      FROM dnevnik_sprememb d
      LEFT JOIN clan c ON c.id = d.avtor_id
      ${whereSql}
      ORDER BY d.datum DESC, d.id DESC
      LIMIT ?
    `, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Revizijskega dnevnika ni bilo mogoče pridobiti.' });
  }
});

module.exports = router;
