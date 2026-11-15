let currentFilter = 'all';

const healthBadge = document.getElementById('health-badge');
const checksList = document.getElementById('checks-list');
const form = document.getElementById('check-form');
const formError = document.getElementById('form-error');
const lastSync = document.getElementById('last-sync');

function formatUptime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function fetchInfo() {
  try {
    const res = await fetch('/api/info');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();

    document.getElementById('meta-cloud').textContent = info.cloudProvider;
    document.getElementById('meta-version').textContent = info.version;
    document.getElementById('meta-env').textContent = info.environment;
    document.getElementById('meta-host').textContent = info.hostname;
    document.getElementById('meta-uptime').textContent = formatUptime(info.uptimeSeconds);
    document.getElementById('meta-memory').textContent = `${info.memory.rssMB} MB / ${info.memory.heapUsedMB} MB`;

    healthBadge.textContent = 'HEALTHY';
    healthBadge.className = 'badge badge-ok';
    lastSync.textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
  } catch {
    healthBadge.textContent = 'UNREACHABLE';
    healthBadge.className = 'badge badge-error';
  }
}

async function fetchChecks() {
  const query = currentFilter === 'all' ? '' : `?status=${encodeURIComponent(currentFilter)}`;
  const res = await fetch(`/api/checks${query}`);
  if (!res.ok) {
    checksList.innerHTML = '<li class="check-item"><span class="panel-subtitle">Failed to load checks.</span></li>';
    return;
  }
  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    checksList.innerHTML = '<li class="check-item"><span class="panel-subtitle">No checks matching filter.</span></li>';
    return;
  }

  checksList.innerHTML = data.items
    .map(
      (item) => `
      <li class="check-item ${item.status === 'verified' ? 'verified' : ''}">
        <div class="check-main">
          <span class="check-title">${escapeHtml(item.title)}</span>
          <div class="check-meta">
            <span class="pill pill-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
            <span class="pill pill-${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
            <span>service: <code>${escapeHtml(item.service)}</code></span>
          </div>
        </div>
        <div class="check-actions">
          <button class="btn-ghost" data-action="toggle" data-id="${escapeHtml(item.id)}" type="button">
            ${item.status === 'verified' ? 'Reopen' : 'Verify'}
          </button>
          <button class="btn-ghost btn-danger" data-action="delete" data-id="${escapeHtml(item.id)}" type="button">
            Delete
          </button>
        </div>
      </li>`
    )
    .join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const payload = {
    title: document.getElementById('check-title').value,
    service: document.getElementById('check-service').value || 'general',
    severity: document.getElementById('check-severity').value,
  };

  const res = await fetch('/api/checks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create check.' }));
    formError.textContent = err.error;
    formError.hidden = false;
    return;
  }

  form.reset();
  await fetchChecks();
});

checksList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === 'toggle') {
    await fetch(`/api/checks/${encodeURIComponent(id)}/toggle`, { method: 'PATCH' });
  } else if (action === 'delete') {
    await fetch(`/api/checks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  await fetchChecks();
});

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    await fetchChecks();
  });
});

await Promise.all([fetchInfo(), fetchChecks()]);
setInterval(fetchInfo, 5000);
