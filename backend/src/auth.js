function requireAuth(req, res, next) {
  if (!req.session.user) {
    res.status(401).json({ error: 'Za dostop je potrebna prijava.' });
    return;
  }

  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      res.status(401).json({ error: 'Za dostop je potrebna prijava.' });
      return;
    }

    const hasRole = req.session.user.vloge.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: 'Za to dejanje nimaš ustrezne vloge.' });
      return;
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
