const argon2 = require('argon2');
const express = require('express');
const { requireRole } = require('../auth');
const pool = require('../db');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

router.use(requireRole('administrator'));

router.get('/uporabniki', async (req, res) => {
  try {
    const [[users], [roles], [groups], [assignments]] = await Promise.all([
      pool.query(`
        SELECT
          c.id,
          c.ime,
          c.priimek,
          c.uporabnisko_ime,
          c.e_posta,
          DATE_FORMAT(c.ustvarjeno_dne, '%Y-%m-%d %H:%i:%s') AS ustvarjeno_dne,
          DATE_FORMAT(c.datum_rojstva, '%Y-%m-%d') AS datum_rojstva,
          c.vod_id,
          v.ime_voda
        FROM clan c
        LEFT JOIN vod v ON v.id = c.vod_id
        ORDER BY c.priimek, c.ime
      `),
      pool.query(`
        SELECT id, naziv
        FROM vloga
        ORDER BY naziv
      `),
      pool.query(`
        SELECT id, ime_voda, starostna_skupina
        FROM vod
        ORDER BY ime_voda
      `),
      pool.query(`
        SELECT
          dv.id,
          dv.clan_id,
          dv.vloga_id,
          v.naziv,
          DATE_FORMAT(dv.dodeljena_dne, '%Y-%m-%d') AS dodeljena_dne,
          DATE_FORMAT(dv.odvzeta_dne, '%Y-%m-%d') AS odvzeta_dne
        FROM dodelitev_vloge dv
        JOIN vloga v ON v.id = dv.vloga_id
        ORDER BY dv.clan_id, dv.dodeljena_dne DESC, dv.id DESC
      `),
    ]);

    res.json({
      uporabniki: users.map((user) => ({
        ...user,
        dodelitve: assignments.filter((assignment) => assignment.clan_id === user.id),
      })),
      vloge: roles,
      vodi: groups,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Uporabnikov ni bilo mogoče pridobiti.' });
  }
});

router.post('/uporabniki', async (req, res) => {
  const firstName = String(req.body.ime || '').trim();
  const lastName = String(req.body.priimek || '').trim();
  const username = String(req.body.uporabnisko_ime || '').trim().toLowerCase();
  const email = String(req.body.e_posta || '').trim().toLowerCase();
  const password = String(req.body.geslo || '');
  const birthDate = req.body.datum_rojstva ? String(req.body.datum_rojstva) : null;
  const groupId = req.body.vod_id ? Number(req.body.vod_id) : null;
  const today = new Date().toISOString().slice(0, 10);

  if (firstName.length < 2 || firstName.length > 100) {
    res.status(400).json({ error: 'Ime mora vsebovati od 2 do 100 znakov.' });
    return;
  }

  if (lastName.length < 2 || lastName.length > 100) {
    res.status(400).json({ error: 'Priimek mora vsebovati od 2 do 100 znakov.' });
    return;
  }

  if (
    username.length < 3
    || username.length > 50
    || !USERNAME_PATTERN.test(username)
  ) {
    res.status(400).json({
      error: 'Uporabniško ime naj vsebuje od 3 do 50 malih črk, številk ali znakov . _ -.',
    });
    return;
  }

  if (email.length > 150 || !EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Vnesi veljaven e-poštni naslov.' });
    return;
  }

  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Geslo mora vsebovati od 8 do 128 znakov.' });
    return;
  }

  if (birthDate && (!isValidDate(birthDate) || birthDate > today)) {
    res.status(400).json({ error: 'Datum rojstva ni veljaven.' });
    return;
  }

  if (groupId !== null && !Number.isInteger(groupId)) {
    res.status(400).json({ error: 'Izbrani vod ni veljaven.' });
    return;
  }

  let passwordHash;

  try {
    passwordHash = await argon2.hash(password);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gesla ni bilo mogoče varno pripraviti.' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (groupId !== null) {
      const [groups] = await connection.query(
        'SELECT id FROM vod WHERE id = ? LIMIT 1',
        [groupId],
      );

      if (!groups.length) {
        await connection.rollback();
        res.status(404).json({ error: 'Izbrani vod ne obstaja.' });
        return;
      }
    }

    const [result] = await connection.query(`
      INSERT INTO clan (
        ime,
        priimek,
        uporabnisko_ime,
        e_posta,
        geslo_hash,
        datum_rojstva,
        vod_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      firstName,
      lastName,
      username,
      email,
      passwordHash,
      birthDate,
      groupId,
    ]);

    await connection.query(`
      INSERT INTO dnevnik_sprememb (akcija, tabela, zapis_id, avtor_id)
      VALUES ('CREATE', 'clan', ?, ?)
    `, [result.insertId, req.session.user.id]);

    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Uporabniško ime ali e-pošta že obstaja.' });
      return;
    }

    console.error(error);
    res.status(500).json({ error: 'Uporabniškega računa ni bilo mogoče ustvariti.' });
  } finally {
    connection.release();
  }
});

router.post('/uporabniki/:id/vloge', async (req, res) => {
  const userId = Number(req.params.id);
  const roleId = Number(req.body.vloga_id);
  const validFrom = String(req.body.dodeljena_dne || '');
  const validTo = req.body.odvzeta_dne ? String(req.body.odvzeta_dne) : null;

  if (!Number.isInteger(userId) || !Number.isInteger(roleId)) {
    res.status(400).json({ error: 'Uporabnik ali vloga nista veljavna.' });
    return;
  }

  if (!isValidDate(validFrom) || (validTo && !isValidDate(validTo))) {
    res.status(400).json({ error: 'Obdobje vloge ni veljavno.' });
    return;
  }

  if (validTo && validTo < validFrom) {
    res.status(400).json({ error: 'Zaključek vloge ne sme biti pred začetkom.' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [users] = await connection.query(
      'SELECT id FROM clan WHERE id = ? LIMIT 1',
      [userId],
    );
    const [roles] = await connection.query(
      'SELECT id FROM vloga WHERE id = ? LIMIT 1',
      [roleId],
    );

    if (!users.length || !roles.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Uporabnik ali vloga ne obstajata.' });
      return;
    }

    const [overlaps] = await connection.query(`
      SELECT id
      FROM dodelitev_vloge
      WHERE clan_id = ?
        AND vloga_id = ?
        AND dodeljena_dne <= COALESCE(?, '9999-12-31')
        AND COALESCE(odvzeta_dne, '9999-12-31') >= ?
      LIMIT 1
      FOR UPDATE
    `, [userId, roleId, validTo, validFrom]);

    if (overlaps.length) {
      await connection.rollback();
      res.status(409).json({ error: 'Izbrana vloga se prekriva z obstoječim obdobjem.' });
      return;
    }

    const [result] = await connection.query(`
      INSERT INTO dodelitev_vloge (
        dodeljena_dne,
        odvzeta_dne,
        vloga_id,
        clan_id
      )
      VALUES (?, ?, ?, ?)
    `, [validFrom, validTo, roleId, userId]);

    await connection.query(`
      INSERT INTO dnevnik_sprememb (akcija, tabela, zapis_id, avtor_id)
      VALUES ('ASSIGN', 'dodelitev_vloge', ?, ?)
    `, [result.insertId, req.session.user.id]);

    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Vloge ni bilo mogoče dodeliti.' });
  } finally {
    connection.release();
  }
});

router.post(
  '/uporabniki/:clanId/vloge/:assignmentId/odvzemi',
  async (req, res) => {
    const userId = Number(req.params.clanId);
    const assignmentId = Number(req.params.assignmentId);
    const validTo = String(req.body.odvzeta_dne || '');
    const today = new Date().toISOString().slice(0, 10);

    if (!Number.isInteger(userId) || !Number.isInteger(assignmentId)) {
      res.status(400).json({ error: 'Dodelitev vloge ni veljavna.' });
      return;
    }

    if (!isValidDate(validTo)) {
      res.status(400).json({ error: 'Datum zaključka ni veljaven.' });
      return;
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(`
        SELECT
          dv.id,
          DATE_FORMAT(dv.dodeljena_dne, '%Y-%m-%d') AS dodeljena_dne,
          DATE_FORMAT(dv.odvzeta_dne, '%Y-%m-%d') AS odvzeta_dne,
          v.naziv
        FROM dodelitev_vloge dv
        JOIN vloga v ON v.id = dv.vloga_id
        WHERE dv.id = ? AND dv.clan_id = ?
        LIMIT 1
        FOR UPDATE
      `, [assignmentId, userId]);
      const assignment = rows[0];

      if (!assignment) {
        await connection.rollback();
        res.status(404).json({ error: 'Dodelitev vloge ne obstaja.' });
        return;
      }

      if (assignment.odvzeta_dne) {
        await connection.rollback();
        res.status(409).json({ error: 'Vloga že ima določen datum zaključka.' });
        return;
      }

      if (validTo < assignment.dodeljena_dne) {
        await connection.rollback();
        res.status(400).json({ error: 'Zaključek vloge ne sme biti pred začetkom.' });
        return;
      }

      const isOwnActiveAdministratorRole = userId === req.session.user.id
        && assignment.naziv === 'administrator'
        && assignment.dodeljena_dne <= today;

      if (isOwnActiveAdministratorRole) {
        await connection.rollback();
        res.status(409).json({
          error: 'Lastne aktivne administratorske vloge ne moreš zaključiti.',
        });
        return;
      }

      await connection.query(`
        UPDATE dodelitev_vloge
        SET odvzeta_dne = ?
        WHERE id = ?
      `, [validTo, assignmentId]);
      await connection.query(`
        INSERT INTO dnevnik_sprememb (akcija, tabela, zapis_id, avtor_id)
        VALUES ('REVOKE', 'dodelitev_vloge', ?, ?)
      `, [assignmentId, req.session.user.id]);

      await connection.commit();
      res.json({ id: assignmentId, odvzeta_dne: validTo });
    } catch (error) {
      await connection.rollback();
      console.error(error);
      res.status(500).json({ error: 'Vloge ni bilo mogoče zaključiti.' });
    } finally {
      connection.release();
    }
  },
);

module.exports = router;
