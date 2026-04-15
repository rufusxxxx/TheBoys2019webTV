function showMessage(message, type = 'info', containerId = 'message') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const classes = {
    success: 'toast-success',
    error: 'toast-error',
    info: 'toast-info'
  };
  container.innerHTML = `<div class="toast-message ${classes[type]}">${message}</div>`;
  setTimeout(() => {
    if (container.firstChild) container.firstChild.remove();
  }, 5000);
}

function clearMessage(containerId = 'message') {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}

async function getValidSession() {
  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) return null;
  return session;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = '/';
}

async function requireAuth() {
  const session = await getValidSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }
  return session;
}

function generateSafeFileName(originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${random}.${ext}`;
}

function showConfirmModal(options) {
  return new Promise((resolve) => {
    const existingModal = document.getElementById('customConfirmModal');
    if (existingModal) existingModal.remove();
    const modalHtml = `
      <div id="customConfirmModal" class="modal confirm-modal" style="display: flex;">
        <div class="modal-content confirm-modal-content">
          <h3 style="margin-bottom: 1rem;">${options.title || 'Підтвердження'}</h3>
          <p style="margin-bottom: 1.5rem;">${options.message}</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="confirm-yes" class="confirm-btn-yes" style="background: var(--danger);">${options.yesText || 'Так'}</button>
            <button id="confirm-no" class="confirm-btn-no secondary">${options.noText || 'Скасувати'}</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('customConfirmModal');
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    const closeModal = (result) => {
      modal.remove();
      resolve(result);
    };
    yesBtn.onclick = () => closeModal(true);
    noBtn.onclick = () => closeModal(false);
    modal.onclick = (e) => {
      if (e.target === modal) closeModal(false);
    };
  });
}