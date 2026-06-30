const argon2 = require('argon2');
const express = require('express');
const { requireAuth } = require('../auth');
const pool = require('../db');

const router = express.Router();

router.post('/auth/prijava', async (req, res) => {
  const prijava = String(req.body.prijava || '').trim();
  const geslo = String(req.body.geslo || '');

  if (!prijava || !geslo) {
    res.status(400).json({ error: 'Vnesi uporabniško ime in geslo.' });
    return;
  }

  try {
    const [members] = await pool.query(`
      SELECT id, ime, priimek, uporabnisko_ime, e_posta, geslo_hash
      FROM clan
      WHERE uporabnisko_ime = ? OR e_posta = ?
      LIMIT 1
    `, [prijava, prijava]);

    const member = members[0];
    let passwordMatches = false;

    if (member) {
      try {
        passwordMatches = await argon2.verify(member.geslo_hash, geslo);
      } catch {
        passwordMatches = false;
      }
    }

    if (!member || !passwordMatches) {
      res.status(401).json({ error: 'Napačno uporabniško ime ali geslo.' });
      return;
    }

    const [roles] = await pool.query(`
      SELECT v.naziv
      FROM dodelitev_vloge dv
      JOIN vloga v ON v.id = dv.vloga_id
      WHERE dv.clan_id = ?
        AND dv.dodeljena_dne <= CURDATE()
        AND (dv.odvzeta_dne IS NULL OR dv.odvzeta_dne >= CURDATE())
      ORDER BY v.naziv
    `, [member.id]);

    const user = {
      id: member.id,
      ime: member.ime,
      priimek: member.priimek,
      uporabnisko_ime: member.uporabnisko_ime,
      e_posta: member.e_posta,
      vloge: roles.map((role) => role.naziv),
    };

    req.session.user = user;
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Prijava trenutno ni mogoča.' });
  }
});

router.get('/auth/me', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Uporabnik ni prijavljen.' });
    return;
  }

  res.json({ user: req.session.user });
});

router.post('/auth/geslo', requireAuth, async (req, res) => {
  const currentPassword = String(req.body.trenutno_geslo || '');
  const newPassword = String(req.body.novo_geslo || '');

  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: 'Novo geslo mora vsebovati od 8 do 128 znakov.' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [members] = await connection.query(`
      SELECT geslo_hash
      FROM clan
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `, [req.session.user.id]);
    const member = members[0];

    if (!member) {
      await connection.rollback();
      res.status(404).json({ error: 'Uporabniški račun ne obstaja.' });
      return;
    }

    let passwordMatches = false;

    try {
      passwordMatches = await argon2.verify(member.geslo_hash, currentPassword);
    } catch {
      passwordMatches = false;
    }

    if (!passwordMatches) {
      await connection.rollback();
      res.status(401).json({ error: 'Trenutno geslo ni pravilno.' });
      return;
    }

    if (newPassword === currentPassword) {
      await connection.rollback();
      res.status(409).json({ error: 'Novo geslo mora biti drugačno od trenutnega.' });
      return;
    }

    const passwordHash = await argon2.hash(newPassword);

    await connection.query(
      'UPDATE clan SET geslo_hash = ? WHERE id = ?',
      [passwordHash, req.session.user.id],
    );
    await connection.query(`
      INSERT INTO dnevnik_sprememb (akcija, tabela, zapis_id, avtor_id)
      VALUES ('PASSWORD_CHANGE', 'clan', ?, ?)
    `, [req.session.user.id, req.session.user.id]);

    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Gesla ni bilo mogoče spremeniti.' });
  } finally {
    connection.release();
  }
});

router.post('/auth/odjava', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);
      res.status(500).json({ error: 'Odjava ni uspela.' });
      return;
    }

    res.clearCookie('taborniski.sid');
    res.status(204).end();
  });
});

module.exports = router;
