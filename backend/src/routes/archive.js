const express = require('express');
const { requireAuth } = require('../auth');
const pool = require('../db');

const router = express.Router();

function getCategoryContext(name) {
  const normalizedName = name.trim().toLocaleLowerCase('sl-SI');

  if (normalizedName === 'delo z vodom') return 'vod';
  if (normalizedName === 'funkcije' || normalizedName === 'načrt dela') return 'vloga';
  return 'osnovno';
}

function getYearBounds(year) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function parseMetadata(content) {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?._meta || {};
  } catch {
    return {};
  }
}

async function getReportOptions(userId, year) {
  const { from, to } = getYearBounds(year);
  const [[categories], [roles], [groups]] = await Promise.all([
    pool.query(`
      SELECT id, naziv
      FROM kategorija_porocila
      ORDER BY naziv
    `),
    pool.query(`
      SELECT DISTINCT v.id, v.naziv
      FROM dodelitev_vloge dv
      JOIN vloga v ON v.id = dv.vloga_id
      WHERE dv.clan_id = ?
        AND dv.dodeljena_dne <= ?
        AND (dv.odvzeta_dne IS NULL OR dv.odvzeta_dne >= ?)
      ORDER BY v.naziv
    `, [userId, to, from]),
    pool.query(`
      SELECT DISTINCT v.id, v.ime_voda, v.starostna_skupina
      FROM vodenje_voda vv
      JOIN vod v ON v.id = vv.vod_id
      WHERE vv.vodnik_id = ?
        AND vv.datum_od <= ?
        AND (vv.datum_do IS NULL OR vv.datum_do >= ?)
      ORDER BY v.ime_voda
    `, [userId, to, from]),
  ]);

  return {
    kategorije: categories
      .map((category) => ({
        ...category,
        kontekst: getCategoryContext(category.naziv),
      }))
      .filter((category) => (
        category.kontekst === 'osnovno'
        || (category.kontekst === 'vod' && groups.length > 0)
        || (category.kontekst === 'vloga' && roles.length > 0)
      )),
    vloge: roles,
    vodi: groups,
  };
}

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

router.get('/porocila/moznosti', requireAuth, async (req, res) => {
  const year = Number(req.query.leto);
  const nextYear = new Date().getFullYear() + 1;

  if (!Number.isInteger(year) || year < 2000 || year > nextYear) {
    res.status(400).json({ error: 'Izberi veljavno arhivsko leto.' });
    return;
  }

  try {
    res.json(await getReportOptions(req.session.user.id, year));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Možnosti poročila ni bilo mogoče pridobiti.' });
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
  const kategorijaId = Number(req.body.kategorija_id);
  const arhivirnoLeto = Number(req.body.arhivirno_leto);
  const nextYear = new Date().getFullYear() + 1;

  if (!Number.isInteger(kategorijaId)) {
    res.status(400).json({ error: 'Izberi veljavno kategorijo.' });
    return;
  }

  if (!Number.isInteger(arhivirnoLeto) || arhivirnoLeto < 2000 || arhivirnoLeto > nextYear) {
    res.status(400).json({ error: 'Izberi veljavno arhivsko leto.' });
    return;
  }

  try {
    const options = await getReportOptions(req.session.user.id, arhivirnoLeto);
    const category = options.kategorije.find((item) => item.id === kategorijaId);

    if (!category) {
      res.status(403).json({ error: 'Za izbrano kategorijo nimaš ustrezne vloge.' });
      return;
    }

    let vodId = null;
    let selectedRoles = [];

    if (category.kontekst === 'vod') {
      vodId = Number(req.body.vod_id);
      const group = options.vodi.find((item) => item.id === vodId);

      if (!group) {
        res.status(403).json({ error: 'Poročilo lahko ustvariš le za vod, ki ga vodiš.' });
        return;
      }
    }

    if (category.kontekst === 'vloga') {
      const requestedRoleIds = Array.isArray(req.body.vloga_ids)
        ? [...new Set(req.body.vloga_ids.map(Number))]
        : [];

      if (!requestedRoleIds.length || requestedRoleIds.some((id) => !Number.isInteger(id))) {
        res.status(400).json({ error: 'Izberi vsaj eno funkcijo.' });
        return;
      }

      selectedRoles = requestedRoleIds.map((id) => (
        options.vloge.find((role) => role.id === id)
      ));

      if (selectedRoles.some((role) => !role)) {
        res.status(403).json({ error: 'Izbereš lahko le funkcije, ki so ti dodeljene.' });
        return;
      }
    }

    let existingReport = null;

    if (category.kontekst === 'vod') {
      const [rows] = await pool.query(`
        SELECT id, status
        FROM porocilo
        WHERE kategorija_porocila_id = ?
          AND arhivirno_leto = ?
          AND vod_id = ?
        LIMIT 1
      `, [kategorijaId, arhivirnoLeto, vodId]);

      existingReport = rows[0] || null;
    } else if (category.kontekst === 'vloga') {
      const [rows] = await pool.query(`
        SELECT id, status, avtor_id, vsebina_obrazca
        FROM porocilo
        WHERE kategorija_porocila_id = ?
          AND arhivirno_leto = ?
      `, [kategorijaId, arhivirnoLeto]);
      const selectedRoleIds = selectedRoles.map((role) => role.id);

      existingReport = rows.find((report) => {
        const metadata = parseMetadata(report.vsebina_obrazca);
        const storedRoleIds = Array.isArray(metadata.vloga_ids) ? metadata.vloga_ids : [];

        return storedRoleIds.some((id) => selectedRoleIds.includes(Number(id)))
          || (!storedRoleIds.length && report.avtor_id === req.session.user.id);
      }) || null;
    } else {
      const [rows] = await pool.query(`
        SELECT id, status
        FROM porocilo
        WHERE kategorija_porocila_id = ?
          AND arhivirno_leto = ?
          AND avtor_id = ?
        LIMIT 1
      `, [kategorijaId, arhivirnoLeto, req.session.user.id]);

      existingReport = rows[0] || null;
    }

    if (existingReport) {
      const statusMessage = existingReport.status === 'osnutek'
        ? 'že obstaja kot osnutek'
        : 'je že oddano in arhivirano';

      res.status(409).json({
        error: `Poročilo z izbranimi podatki ${statusMessage}.`,
        porocilo: {
          id: existingReport.id,
          status: existingReport.status,
        },
      });
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

    const group = options.vodi.find((item) => item.id === vodId);
    const contextName = category.kontekst === 'vod'
      ? group.ime_voda
      : selectedRoles.map((role) => role.naziv).join(', ');
    const naslov = contextName
      ? `${category.naziv} - ${contextName} (${arhivirnoLeto})`
      : `${category.naziv} (${arhivirnoLeto})`;
    const formContent = selectedRoles.length
      ? JSON.stringify({
          _meta: {
            vloga_ids: selectedRoles.map((role) => role.id),
            vloge_nazivi: selectedRoles.map((role) => role.naziv),
          },
        })
      : '{}';

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
      formContent,
      arhivirnoLeto,
      templates[0]?.id || null,
      kategorijaId,
      vodId,
      req.session.user.id,
    ]);

    res.status(201).json({
      id: result.insertId,
      naslov,
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
