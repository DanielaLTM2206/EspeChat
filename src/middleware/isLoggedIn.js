const CookieHelper = require('../utils/cookieHelper');
const JWTHelper = require('../utils/jwtHelper');

module.exports = (req, res, next) => {
  const token = req.cookies?.token || CookieHelper.get(req.headers.cookie, 'token');
  
  if (!token) {
    return res.redirect("/register");
  }

  try {
    const decoded = JWTHelper.verify(token);
    req.user = decoded;
    next();
  } catch (error) {
    // Si la verificación falla (por firma inválida o expiración), limpiamos la cookie y redirigimos
    res.clearCookie('token');
    res.redirect("/register");
  }
};

