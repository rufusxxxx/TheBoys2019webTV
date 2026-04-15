const { supabaseAdmin } = require('../supabase');
const { authenticate } = require('./auth');

async function requireAdmin(req, res, next) {
  const userId = req.user.id;
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !profile) return res.status(403).json({ error: 'Profile not found' });
  if (profile.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  next();
}

module.exports = { authenticate, requireAdmin };