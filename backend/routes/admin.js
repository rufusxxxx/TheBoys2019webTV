const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { authenticate, requireAdmin } = require('../middleware/admin');

router.use(authenticate);
router.use(requireAdmin);

router.get('/users', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ users: data });
});

router.post('/users/:userId/ban', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_banned: true })
    .eq('id', userId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data });
});

router.post('/users/:userId/unban', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_banned: false })
    .eq('id', userId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data });
});

router.delete('/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;

  // Отримуємо коментар, щоб дізнатися URL зображення
  const { data: comment, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('image_url')
    .eq('id', commentId)
    .single();

  if (fetchError) return res.status(404).json({ error: 'Comment not found' });

  // Видаляємо зображення з Storage, якщо воно є
  if (comment.image_url) {
    try {
      const fileName = comment.image_url.split('/').pop();
      if (fileName) {
        await supabaseAdmin.storage.from('comments').remove([fileName]);
      }
    } catch (storageErr) {
      console.error('Error deleting image from storage:', storageErr);
    }
  }

  // Видаляємо коментар з бази
  const { error } = await supabaseAdmin.from('comments').delete().eq('id', commentId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Comment deleted' });
});

router.get('/dashboard', async (req, res) => {
  const { count: usersCount } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const { count: commentsCount } = await supabaseAdmin
    .from('comments')
    .select('*', { count: 'exact', head: true });

  res.json({
    usersCount: usersCount || 0,
    commentsCount: commentsCount || 0,
  });
});

module.exports = router;