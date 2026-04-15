const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');

router.post('/register', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const redirectUrl = `${process.env.FRONTEND_URL || 'https://the-boys-2019-kino-tvseries.onrender.com/'}/auth-callback.html?flow=signup`;

  const { error } = await supabaseAdmin.auth.signUp({
    email,
    password: 'temporary-placeholder',
    options: { emailRedirectTo: redirectUrl }
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Confirmation email sent. Please check your inbox.' });
});

router.post('/set-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'User ID and password required' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Password set successfully. You can now log in.' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  // Перевірка бана
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_banned')
    .eq('id', data.user.id)
    .single();

  if (profileError) return res.status(500).json({ error: 'Database error' });
  if (profile && profile.is_banned) {
    await supabaseAdmin.auth.admin.signOut(data.user.id);
    return res.status(403).json({ error: 'От халепа, схоже акаунт заблоковано' });
  }

  res.json({ session: data.session, user: data.user });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const redirectUrl = `${process.env.FRONTEND_URL || 'https://the-boys-2019-kino-tvseries.onrender.com/'}/auth-callback.html?flow=reset`;

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Password reset email sent.' });
});

router.post('/reset-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'User ID and password required' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Password updated successfully.' });
});

module.exports = router;
