const { supabaseAdmin } = require('../supabase');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired token' });

  // Перевірка бана
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_banned')
    .eq('id', data.user.id)
    .single();

  if (profileError) return res.status(500).json({ error: 'Database error' });
  if (profile && profile.is_banned) {
    return res.status(403).json({ error: 'Your account has been banned' });
  }

  req.user = data.user;
  next();
}

module.exports = { authenticate };