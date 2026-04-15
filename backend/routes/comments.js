const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { authenticate } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(`
        id,
        content,
        image_url,
        created_at,
        user_id,
        profiles ( id, name, avatar_url, role )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /comments error:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json({ comments: data });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, image_url } = req.body;

    if (!content && !image_url) {
      return res.status(400).json({ error: 'Content or image is required' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_banned')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(400).json({ error: profileError.message });
    }
    if (profile.is_banned) {
      return res.status(403).json({ error: 'You are banned' });
    }

    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert([{ user_id: userId, content: content || null, image_url: image_url || null }])
      .select()
      .single();

    if (error) {
      console.error('Insert comment error:', error);
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json({ comment: data });
  } catch (err) {
    console.error('Unexpected error in POST /comments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.id;

    // ќтримуЇмо коментар разом ≥з URL зображенн€
    const { data: comment, error: fetchError } = await supabaseAdmin
      .from('comments')
      .select('user_id, image_url')
      .eq('id', commentId)
      .single();

    if (fetchError) {
      console.error('Fetch comment error:', fetchError);
      return res.status(404).json({ error: 'Comment not found' });
    }

    // ѕерев≥рка прав: власник або адм≥н
    if (comment.user_id !== userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // якщо Ї зображенн€ Ц видал€Їмо файл з≥ Storage
    if (comment.image_url) {
      try {
        // ¬ит€гуЇмо ≥м'€ файлу з URL (останн€ частина п≥сл€ останнього слеша)
        const fileName = comment.image_url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabaseAdmin.storage
            .from('comments')
            .remove([fileName]);
          if (storageError) {
            console.error('Storage delete error:', storageError);
            // Ќе перериваЇмо видаленн€ коментар€, €кщо фото не видалилось, але логуЇмо
          }
        }
      } catch (storageErr) {
        console.error('Error deleting image from storage:', storageErr);
      }
    }

    // ¬идал€Їмо коментар з бази
    const { error } = await supabaseAdmin.from('comments').delete().eq('id', commentId);
    if (error) {
      console.error('Delete comment error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Unexpected error in DELETE /comments/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;