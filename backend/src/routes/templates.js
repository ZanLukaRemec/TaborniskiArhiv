const express = require('express');
const { requireRole } = require('../auth');
const pool = require('../db');

const router = express.Router();
const FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'checkbox']);

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function fieldNameFromLabel(label, usedNames) {
  const baseName = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 45) || 'polje';
  let name = baseName;
  let suffix = 2;

  while (usedNames.has(name)) {
    name = `${baseName.slice(0, 42)}_${suffix}`;
    suffix += 1;
  }

  usedNames.add(name);
  return name;
}

router.use(requireRole('administrator'));

router.get('/predloge', async (req, res) => {
  try {
    const [[categories], [templates]] = await Promise.all([
      pool.query(`
        SELECT id, naziv, opis
        FROM kategorija_porocila
        ORDER BY naziv
      `),
      pool.query(`
        SELECT
          po.id,
          po.kategorija_id,
          po.struktura_obrazca,
          DATE_FORMAT(po.veljavno_od, '%Y-%m-%d') AS veljavno_od,
          DATE_FORMAT(po.veljavno_do, '%Y-%m-%d') AS veljavno_do
        FROM predloga_obrazca po
        ORDER BY po.kategorija_id, po.veljavno_od DESC
      `),
    ]);

    res.json(categories.map((category) => ({
      ...category,
      predloge: templates.filter((template) => template.kategorija_id === category.id),
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Predlog ni bilo mogoče pridobiti.' });
  }
});

router.post('/predloge', async (req, res) => {
  const categoryId = Number(req.body.kategorija_id);
  const name = String(req.body.naziv || '').trim();
  const validFrom = String(req.body.veljavno_od || '');
  const validTo = req.body.veljavno_do ? String(req.body.veljavno_do) : null;
  const submittedFields = req.body.polja;

  if (!Number.isInteger(categoryId)) {
    res.status(400).json({ error: 'Izberi veljavno kategorijo.' });
    return;
  }

  if (name.length < 2 || name.length > 100) {
    res.status(400).json({ error: 'Naziv predloge mora vsebovati od 2 do 100 znakov.' });
    return;
  }

  if (!isValidDate(validFrom) || (validTo && !isValidDate(validTo))) {
    res.status(400).json({ error: 'Obdobje veljavnosti ni pravilno.' });
    return;
  }

  if (validTo && validTo < validFrom) {
    res.status(400).json({ error: 'Končni datum ne sme biti pred začetnim datumom.' });
    return;
  }

  if (!Array.isArray(submittedFields) || !submittedFields.length || submittedFields.length > 20) {
    res.status(400).json({ error: 'Predloga mora imeti od 1 do 20 polj.' });
    return;
  }

  const usedNames = new Set();
  const fields = [];

  for (const submittedField of submittedFields) {
    const label = String(submittedField.oznaka || '').trim();
    const type = String(submittedField.tip || '');

    if (label.length < 2 || label.length > 100) {
      res.status(400).json({ error: 'Vsako polje mora imeti oznako od 2 do 100 znakov.' });
      return;
    }

    if (!FIELD_TYPES.has(type)) {
      res.status(400).json({ error: `Tip polja »${label}« ni veljaven.` });
      return;
    }

    fields.push({
      ime: fieldNameFromLabel(label, usedNames),
      oznaka: label,
      tip: type,
      obvezno: Boolean(submittedField.obvezno),
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [categories] = await connection.query(`
      SELECT id
      FROM kategorija_porocila
      WHERE id = ?
      LIMIT 1
    `, [categoryId]);

    if (!categories.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Izbrana kategorija ne obstaja.' });
      return;
    }

    const [latestTemplates] = await connection.query(`
      SELECT
        id,
        DATE_FORMAT(veljavno_od, '%Y-%m-%d') AS veljavno_od,
        DATE_FORMAT(veljavno_do, '%Y-%m-%d') AS veljavno_do
      FROM predloga_obrazca
      WHERE kategorija_id = ?
      ORDER BY veljavno_od DESC
      LIMIT 1
      FOR UPDATE
    `, [categoryId]);
    const latestTemplate = latestTemplates[0];

    if (latestTemplate && validFrom <= latestTemplate.veljavno_od) {
      await connection.rollback();
      res.status(409).json({
        error: 'Nova predloga mora začeti veljati po začetku zadnje različice.',
      });
      return;
    }

    if (
      latestTemplate
      && (!latestTemplate.veljavno_do || validFrom <= latestTemplate.veljavno_do)
    ) {
      await connection.query(`
        UPDATE predloga_obrazca
        SET veljavno_do = DATE_SUB(?, INTERVAL 1 DAY)
        WHERE id = ?
      `, [validFrom, latestTemplate.id]);
    }

    const structure = JSON.stringify({
      naziv: name,
      polja: fields,
    });
    const [result] = await connection.query(`
      INSERT INTO predloga_obrazca (
        struktura_obrazca,
        veljavno_od,
        veljavno_do,
        kategorija_id
      )
      VALUES (?, ?, ?, ?)
    `, [structure, validFrom, validTo, categoryId]);

    await connection.query(`
      INSERT INTO dnevnik_sprememb (akcija, tabela, zapis_id, avtor_id)
      VALUES ('CREATE', 'predloga_obrazca', ?, ?)
    `, [result.insertId, req.session.user.id]);

    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Predloge ni bilo mogoče ustvariti.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
