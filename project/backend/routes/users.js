const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { authenticate } = require('../middleware/auth');

router.get('/profile', authenticate, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;
  
  let { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  
  if (!data) {
    const defaultName = `user_${userId.substring(0, 8)}`;
    const defaultAvatar = 'https://ggwkwcsivwltosovppou.supabase.co/storage/v1/object/public/avatars/abstract-user-flat-3.svg';
    const defaultBio = 'No information';
    
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({ 
        id: userId, 
        email: email, 
        name: defaultName, 
        bio: defaultBio,
        avatar_url: defaultAvatar
      })
      .select()
      .single();
    if (insertError) return res.status(400).json({ error: insertError.message });
    data = newProfile;
  } else {
    let updated = false;
    if (!data.name) {
      data.name = `user_${userId.substring(0, 8)}`;
      updated = true;
    }
    if (!data.bio) {
      data.bio = 'No information';
      updated = true;
    }
    if (!data.avatar_url) {
      data.avatar_url = 'https://ggwkwcsivwltosovppou.supabase.co/storage/v1/object/public/avatars/abstract-user-flat-3.svg';
      updated = true;
    }
    if (updated) {
      await supabaseAdmin
        .from('profiles')
        .update({ name: data.name, bio: data.bio, avatar_url: data.avatar_url })
        .eq('id', userId);
    }
  }
  
  res.json({ profile: data });
});

router.get('/:userId/public', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, avatar_url, bio, created_at, role')
    .eq('id', userId)
    .single();

  if (error) return res.status(404).json({ error: 'User not found' });
  res.json({ profile: data });
});

router.put('/profile', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { name, bio, avatar_url } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name.trim() || `user_${userId.substring(0, 8)}`;
  if (bio !== undefined) updates.bio = bio.trim() || 'No information';
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;