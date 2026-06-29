const express = require('express');
const { requireAuth } = require('../auth');
const pool = require('../db');

const router = express.Router();
const REPORT_STATUSES = new Set(['osnutek', 'arhivirano']);

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

function parseJsonObject(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseMetadata(content) {
  return parseJsonObject(content)._meta || {};
}

function isAdministrator(user) {
  return user.vloge.includes('administrator');
}

function canManageReport(report, user) {
  return report.avtor_id === user.id || isAdministrator(user);
}

function normalizeFormContent(fields, submittedContent, metadata, requireComplete) {
  if (!submittedContent || typeof submittedContent !== 'object' || Array.isArray(submittedContent)) {
    return { error: 'Vsebina poročila ni veljavna.' };
  }

  const content = {};

  if (Object.keys(metadata).length) {
    content._meta = metadata;
  }

  for (const field of fields) {
    const value = submittedContent[field.ime];
    const isEmpty = value === undefined
      || value === null
      || (typeof value === 'string' && value.trim() === '');

    if (isEmpty) {
      if (requireComplete && field.obvezno) {
        return { error: `Polje »${field.oznaka}« je obvezno.` };
      }

      continue;
    }

    if (field.tip === 'number') {
      const numberValue = Number(value);

      if (!Number.isFinite(numberValue)) {
        return { error: `Polje »${field.oznaka}« mora biti število.` };
      }

      content[field.ime] = numberValue;
    } else if (field.tip === 'date') {
      const dateValue = String(value);
      const parsedDate = new Date(`${dateValue}T00:00:00Z`);
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
        && !Number.isNaN(parsedDate.getTime())
        && parsedDate.toISOString().slice(0, 10) === dateValue;

      if (!isValidDate) {
        return { error: `Polje »${field.oznaka}« mora biti veljaven datum.` };
      }

      content[field.ime] = dateValue;
    } else if (field.tip === 'checkbox') {
      content[field.ime] = Boolean(value);
    } else {
      content[field.ime] = String(value).trim();
    }
  }

  return { content };
}

async function getReportOptions(userId, year) {
  const { from, to } = getYearBounds(year);
  const [[categories], [templates], [roles], [groups]] = await Promise.all([
    pool.query(`
      SELECT id, naziv, opis
      FROM kategorija_porocila
      ORDER BY naziv
    `),
    pool.query(`
      SELECT id, kategorija_id, struktura_obrazca
      FROM predloga_obrazca
      WHERE veljavno_od <= ?
        AND (veljavno_do IS NULL OR veljavno_do >= ?)
      ORDER BY kategorija_id, veljavno_od DESC
    `, [to, from]),
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

  const templatesByCategory = new Map();

  for (const template of templates) {
    if (!templatesByCategory.has(template.kategorija_id)) {
      templatesByCategory.set(template.kategorija_id, template);
    }
  }

  return {
    kategorije: categories
      .map((category) => {
        const template = templatesByCategory.get(category.id);

        return {
          ...category,
          kontekst: getCategoryContext(category.naziv),
          predloga_id: template?.id || null,
          struktura_obrazca: template?.struktura_obrazca || null,
          ima_predlogo: Boolean(template),
        };
      })
      .filter((category) => (
        category.kontekst === 'osnovno'
        || (category.kontekst === 'vod' && groups.length > 0)
        || (category.kontekst === 'vloga' && roles.length > 0)
      )),
    vloge: roles,
    vodi: groups,
  };
}

async function getEditableReport(reportId) {
  const [rows] = await pool.query(`
    SELECT
      p.id,
      p.status,
      p.avtor_id,
      p.vsebina_obrazca,
      po.struktura_obrazca
    FROM porocilo p
    LEFT JOIN predloga_obrazca po ON po.id = p.predloga_id
    WHERE p.id = ?
    LIMIT 1
  `, [reportId]);

  return rows[0] || null;
}

router.use(requireAuth);

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

router.get('/porocila/moznosti', async (req, res) => {
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
  const { leto, kategorija, q, status, moji, limit } = req.query;
  const where = [];
  const params = [];

  if (leto) {
    const year = Number(leto);

    if (!Number.isInteger(year)) {
      res.status(400).json({ error: 'Arhivsko leto ni veljavno.' });
      return;
    }

    where.push('p.arhivirno_leto = ?');
    params.push(year);
  }

  if (kategorija) {
    const categoryId = Number(kategorija);

    if (!Number.isInteger(categoryId)) {
      res.status(400).json({ error: 'Kategorija ni veljavna.' });
      return;
    }

    where.push('p.kategorija_porocila_id = ?');
    params.push(categoryId);
  }

  if (status) {
    if (!REPORT_STATUSES.has(status)) {
      res.status(400).json({ error: 'Status poročila ni veljaven.' });
      return;
    }

    where.push('p.status = ?');
    params.push(status);
  }

  if (moji !== undefined && moji !== '1') {
    res.status(400).json({ error: 'Filter za lastna poročila ni veljaven.' });
    return;
  }

  if (moji === '1') {
    where.push('p.avtor_id = ?');
    params.push(req.session.user.id);
  }

  if (!isAdministrator(req.session.user)) {
    where.push('(p.status = \'arhivirano\' OR p.avtor_id = ?)');
    params.push(req.session.user.id);
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

  let limitSql = '';

  if (limit !== undefined) {
    const resultLimit = Number(limit);

    if (!Number.isInteger(resultLimit) || resultLimit < 1 || resultLimit > 100) {
      res.status(400).json({ error: 'Omejitev števila poročil ni veljavna.' });
      return;
    }

    limitSql = 'LIMIT ?';
    params.push(resultLimit);
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
      ${limitSql}
    `, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Poročil ni bilo mogoče pridobiti.' });
  }
});

router.post('/porocila', async (req, res) => {
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

    if (!category.predloga_id) {
      res.status(400).json({ error: 'Izbrana kategorija nima aktivne predloge.' });
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
      category.predloga_id,
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

router.put('/porocila/:id', async (req, res) => {
  const reportId = Number(req.params.id);

  if (!Number.isInteger(reportId)) {
    res.status(400).json({ error: 'Neveljaven identifikator poročila.' });
    return;
  }

  try {
    const report = await getEditableReport(reportId);

    if (!report) {
      res.status(404).json({ error: 'Poročilo ne obstaja.' });
      return;
    }

    if (!canManageReport(report, req.session.user)) {
      res.status(403).json({ error: 'Urejaš lahko samo svoje osnutke.' });
      return;
    }

    if (report.status !== 'osnutek') {
      res.status(409).json({ error: 'Arhiviranega poročila ni mogoče urejati.' });
      return;
    }

    const template = parseJsonObject(report.struktura_obrazca);
    const fields = Array.isArray(template.polja) ? template.polja : [];

    if (!fields.length) {
      res.status(400).json({ error: 'Poročilo nima predloge za urejanje.' });
      return;
    }

    const normalized = normalizeFormContent(
      fields,
      req.body.vsebina_obrazca,
      parseMetadata(report.vsebina_obrazca),
      false,
    );

    if (normalized.error) {
      res.status(400).json({ error: normalized.error });
      return;
    }

    await pool.query(`
      UPDATE porocilo
      SET vsebina_obrazca = ?
      WHERE id = ?
    `, [JSON.stringify(normalized.content), reportId]);

    res.json({ id: reportId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Osnutka ni bilo mogoče shraniti.' });
  }
});

router.post('/porocila/:id/oddaja', async (req, res) => {
  const reportId = Number(req.params.id);

  if (!Number.isInteger(reportId)) {
    res.status(400).json({ error: 'Neveljaven identifikator poročila.' });
    return;
  }

  try {
    const report = await getEditableReport(reportId);

    if (!report) {
      res.status(404).json({ error: 'Poročilo ne obstaja.' });
      return;
    }

    if (!canManageReport(report, req.session.user)) {
      res.status(403).json({ error: 'Oddaš lahko samo svoje osnutke.' });
      return;
    }

    if (report.status !== 'osnutek') {
      res.status(409).json({ error: 'Poročilo je že arhivirano.' });
      return;
    }

    const template = parseJsonObject(report.struktura_obrazca);
    const fields = Array.isArray(template.polja) ? template.polja : [];

    if (!fields.length) {
      res.status(400).json({ error: 'Poročilo nima predloge za oddajo.' });
      return;
    }

    const currentContent = parseJsonObject(report.vsebina_obrazca);
    const normalized = normalizeFormContent(
      fields,
      currentContent,
      parseMetadata(currentContent),
      true,
    );

    if (normalized.error) {
      res.status(400).json({ error: normalized.error });
      return;
    }

    const [result] = await pool.query(`
      UPDATE porocilo
      SET vsebina_obrazca = ?, status = 'arhivirano', oddano_dne = NOW()
      WHERE id = ? AND status = 'osnutek'
    `, [JSON.stringify(normalized.content), reportId]);

    if (!result.affectedRows) {
      res.status(409).json({ error: 'Poročilo je bilo medtem že arhivirano.' });
      return;
    }

    res.json({ id: reportId, status: 'arhivirano' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Poročila ni bilo mogoče oddati.' });
  }
});

router.get('/porocila/:id', async (req, res) => {
  const reportId = Number(req.params.id);

  if (!Number.isInteger(reportId)) {
    res.status(400).json({ error: 'Neveljaven identifikator poročila.' });
    return;
  }

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
        po.struktura_obrazca,
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
      LEFT JOIN predloga_obrazca po ON po.id = p.predloga_id
      WHERE p.id = ?
      LIMIT 1
    `, [reportId]);
    const report = rows[0];

    if (!report) {
      res.status(404).json({ error: 'Poročilo ne obstaja.' });
      return;
    }

    const canView = report.status === 'arhivirano'
      || report.avtor_id === req.session.user.id
      || isAdministrator(req.session.user);

    if (!canView) {
      res.status(403).json({ error: 'Do tega osnutka nimaš dostopa.' });
      return;
    }

    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Poročila ni bilo mogoče pridobiti.' });
  }
});

module.exports = router;
