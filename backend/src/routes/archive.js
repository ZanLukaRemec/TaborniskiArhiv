const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/kategorije', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, naziv, opis
      FROM kategorija_porocila
      ORDER BY naziv
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kategorij ni bilo mogoče pridobiti.' });
  }
});

router.get('/porocila', async (req, res) => {
  const { leto, kategorija, q } = req.query;

  const where = [];
  const params = [];

  if (leto) {
    where.push('p.arhivirno_leto = ?');
    params.push(Number(leto));
  }

  if (kategorija) {
    where.push('p.kategorija_porocila_id = ?');
    params.push(Number(kategorija));
  }

  if (q) {
    const search = `%${q}%`;
    where.push(`(
      p.naslov LIKE ?
      OR kp.naziv LIKE ?
      OR CONCAT(c.ime, ' ', c.priimek) LIKE ?
      OR CAST(p.vsebina_obrazca AS CHAR) LIKE ?
    )`);
    params.push(search, search, search, search);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.naslov,
        p.status,
        p.arhivirno_leto,
        p.ustvarjeno_dne,
        p.oddano_dne,
        p.pot_do_datoteke,
        kp.id AS kategorija_id,
        kp.naziv AS kategorija_naziv,
        c.id AS avtor_id,
        c.ime AS avtor_ime,
        c.priimek AS avtor_priimek,
        v.id AS vod_id,
        v.ime_voda
      FROM porocilo p
      JOIN kategorija_porocila kp ON kp.id = p.kategorija_porocila_id
      JOIN clan c ON c.id = p.avtor_id
      LEFT JOIN vod v ON v.id = p.vod_id
      ${whereSql}
      ORDER BY p.arhivirno_leto DESC, p.oddano_dne DESC, p.ustvarjeno_dne DESC
    `, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Poročil ni bilo mogoče pridobiti.' });
  }
});

router.get('/porocila/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.naslov,
        p.vsebina_obrazca,
        p.status,
        p.arhivirno_leto,
        p.ustvarjeno_dne,
        p.oddano_dne,
        p.pot_do_datoteke,
        p.predloga_id,
        kp.id AS kategorija_id,
        kp.naziv AS kategorija_naziv,
        c.id AS avtor_id,
        c.ime AS avtor_ime,
        c.priimek AS avtor_priimek,
        v.id AS vod_id,
        v.ime_voda
      FROM porocilo p
      JOIN kategorija_porocila kp ON kp.id = p.kategorija_porocila_id
      JOIN clan c ON c.id = p.avtor_id
      LEFT JOIN vod v ON v.id = p.vod_id
      WHERE p.id = ?
      LIMIT 1
    `, [Number(req.params.id)]);

    if (!rows.length) {
      res.status(404).json({ error: 'Poročilo ne obstaja.' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Poročila ni bilo mogoče pridobiti.' });
  }
});

module.exports = router;
