const express = require('express');
const { requireAuth } = require('../auth');
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

router.get('/vodi', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, ime_voda, starostna_skupina
      FROM vod
      ORDER BY ime_voda
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Vodov ni bilo mogoče pridobiti.' });
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

router.post('/porocila', requireAuth, async (req, res) => {
  const naslov = String(req.body.naslov || '').trim();
  const kategorijaId = Number(req.body.kategorija_id);
  const arhivirnoLeto = Number(req.body.arhivirno_leto);
  const vodId = req.body.vod_id ? Number(req.body.vod_id) : null;
  const nextYear = new Date().getFullYear() + 1;

  if (!naslov || naslov.length > 200) {
    res.status(400).json({ error: 'Naslov mora vsebovati največ 200 znakov.' });
    return;
  }

  if (!Number.isInteger(kategorijaId)) {
    res.status(400).json({ error: 'Izberi veljavno kategorijo.' });
    return;
  }

  if (!Number.isInteger(arhivirnoLeto) || arhivirnoLeto < 2000 || arhivirnoLeto > nextYear) {
    res.status(400).json({ error: 'Izberi veljavno arhivsko leto.' });
    return;
  }

  if (vodId !== null && !Number.isInteger(vodId)) {
    res.status(400).json({ error: 'Izberi veljaven vod.' });
    return;
  }

  try {
    const [[category], [groups]] = await Promise.all([
      pool.query('SELECT id FROM kategorija_porocila WHERE id = ? LIMIT 1', [kategorijaId]),
      vodId === null
        ? Promise.resolve([[]])
        : pool.query('SELECT id FROM vod WHERE id = ? LIMIT 1', [vodId]),
    ]);

    if (!category.length) {
      res.status(400).json({ error: 'Izbrana kategorija ne obstaja.' });
      return;
    }

    if (vodId !== null && !groups.length) {
      res.status(400).json({ error: 'Izbrani vod ne obstaja.' });
      return;
    }

    const [templates] = await pool.query(`
      SELECT id
      FROM predloga_obrazca
      WHERE kategorija_id = ?
        AND veljavno_od <= ?
        AND (veljavno_do IS NULL OR veljavno_do >= ?)
      ORDER BY veljavno_od DESC
      LIMIT 1
    `, [
      kategorijaId,
      `${arhivirnoLeto}-12-31`,
      `${arhivirnoLeto}-01-01`,
    ]);

    const [result] = await pool.query(`
      INSERT INTO porocilo (
        naslov,
        vsebina_obrazca,
        status,
        arhivirno_leto,
        predloga_id,
        kategorija_porocila_id,
        vod_id,
        avtor_id
      )
      VALUES (?, ?, 'osnutek', ?, ?, ?, ?, ?)
    `, [
      naslov,
      '{}',
      arhivirnoLeto,
      templates[0]?.id || null,
      kategorijaId,
      vodId,
      req.session.user.id,
    ]);

    res.status(201).json({
      id: result.insertId,
      status: 'osnutek',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Osnutka ni bilo mogoče ustvariti.' });
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
