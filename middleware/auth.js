const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const sessions = new Map();
const attempts = new Map();
const COOKIE = 'photocenter_session';
const MAX_AGE = 8 * 60 * 60 * 1000;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
    const derived = await scrypt(password, parts[1], 64);
    return crypto.timingSafeEqual(derived, Buffer.from(parts[2], 'hex'));
  }
  // Existing database passwords are upgraded after a successful login.
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}
function tokenFromRequest(req) {
  const cookie = (req.headers.cookie || '').split(';').find(value => value.trim().startsWith(COOKIE + '='));
  return cookie ? cookie.trim().slice(COOKIE.length + 1) : '';
}
function sessionFor(req) {
  const token = tokenFromRequest(req);
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires <= Date.now()) { sessions.delete(token); return null; }
  return session;
}
function setSession(req, res, user) {
  sessions.delete(tokenFromRequest(req));
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + MAX_AGE });
  res.cookie(COOKIE, token, { httpOnly:true, sameSite:'strict', secure:req.secure, maxAge:MAX_AGE, path:'/' });
}
function logout(req, res) {
  sessions.delete(tokenFromRequest(req));
  res.clearCookie(COOKIE, { httpOnly:true, sameSite:'strict', secure:req.secure, path:'/' });
}
function requireAuth(req, res, next) {
  const session = sessionFor(req);
  if (!session) return res.status(401).json({error:true, message:'Войдите в систему, чтобы продолжить.'});
  req.user = session.user;
  next();
}
function sameOrigin(req, res, next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
    return res.status(403).json({error:true,message:'Запрос с другого сайта запрещён.'});
  }
  next();
}
function loginLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry || entry.until <= now) { entry = {count:0,until:now+15*60*1000}; attempts.set(key,entry); }
  if (entry.count >= 20) return res.status(429).json({error:true,message:'Слишком много попыток входа. Повторите через 15 минут.'});
  entry.count++;
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [key,value] of sessions) if (value.expires <= now) sessions.delete(key);
  for (const [key,value] of attempts) if (value.until <= now) attempts.delete(key);
}, 60000).unref();
module.exports = {hashPassword,verifyPassword,sessionFor,setSession,logout,requireAuth,sameOrigin,loginLimit};
