const CookieHelper = require('../utils/cookieHelper');

module.exports = (req, res, next) => {
  const username = req.cookies?.username || CookieHelper.get(req.headers.cookie, 'username');
  
  if (username && username.trim() !== '') {
    next();
  } else {
    res.redirect("/register");
  }
};

