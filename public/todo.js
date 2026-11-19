(() => {
  const form = $('todoForm');
  const message = $('todoMessage');
  const reminder = $('todoReminder');
  const status = $('todoStatus');
  const enable = $('todoEnablePush');
  const submit = form.querySelector('[type=submit]');
  let submissionId;
  let loadVersion = 0;

  let hasPrivateAccess = false;

  function setPrivateAccess(allowed) {
    hasPrivateAccess = allowed;
    $('todoLoginForm').hidden = allowed;
    $('todoContent').hidden = !allowed;
    $('todoTab').textContent = allowed ? 'À faire' : 'Accès Olivier';
    if (!allowed) {
      loadVersion++;
      $('todoList').replaceChildren();
      $('todoDoneList').replaceChildren();
    }
  }

  async function access(method = 'GET', body) {
    const response = await fetch('/api/todo-access', {
      method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Accès indisponible.');
    return data;
  }

  $('todoLoginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      await access('POST', { key: $('todoAccessKey').value });
      $('todoAccessKey').value = '';
      setPrivateAccess(true);
      await load();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $('todoLogout').addEventListener('click', async () => {
    try {
      await access('DELETE');
      setPrivateAccess(false);
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
  });

  async function request(method, body) {
    const legacy = localStorage.getItem('cdv-todo-owner');
    const headers = { 'Content-Type': 'application/json' };
    if (legacy) headers.Authorization = 'Bearer ' + legacy;
    const response = await fetch('/api/todo', {
      method, credentials: 'same-origin',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) setPrivateAccess(false);
    if (!response.ok) throw new Error(data?.error || 'Liste indisponible pour le moment.');
    if (legacy) localStorage.removeItem('cdv-todo-owner');
    return data;
  }

  async function currentSubscription() {
    if (!('serviceWorker' in navigator) || notificationPermission() !== 'granted') return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ? registration.pushManager?.getSubscription() : null;
  }

  function notificationPermission() {
    return 'Notification' in window ? Notification.permission : null;
  }

  async function registerSubscription() {
    const subscription = await currentSubscription();
    if (!subscription) throw new Error('Active les notifications sur cet appareil. Sur iPhone, ouvre le planning depuis l’écran d’accueil.');
    await api('/api/push-subscriptions', {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    return subscription;
  }

  function taskRow(task) {
    const row = document.createElement('li');
    const content = document.createElement('div');
    content.textContent = task.message;
    row.append(content);
    if (task.remind_at && !task.completed_at) {
      const date = document.createElement('small');
      const when = new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris'
      }).format(new Date(task.remind_at));
      date.textContent = task.sent_at ? 'Rappel envoyé' : 'Rappel le ' + when;
      content.append(date);
    }
    if (!task.completed_at) {
      const done = document.createElement('button');
      done.type = 'button';
      done.textContent = '✓ Fait';
      done.setAttribute('aria-label', 'Terminer ' + task.message);
      done.addEventListener('click', async () => {
        done.disabled = true;
        try {
          await request('PATCH', { id: task.id });
          await load();
        } catch (error) {
          status.textContent = error.message;
          done.disabled = false;
        }
      });
      row.append(done);
    }
    return row;
  }

  async function load() {
    const version = ++loadVersion;
    status.textContent = 'Chargement…';
    try {
      const tasks = await request('GET');
      if (version !== loadVersion) return;
      const pending = tasks.filter(task => !task.completed_at);
      const completed = tasks.filter(task => task.completed_at);
      $('todoList').replaceChildren(...pending.map(taskRow));
      $('todoDoneList').replaceChildren(...completed.map(taskRow));
      $('todoDone').hidden = !completed.length;
      status.textContent = pending.length ? '' : 'Aucune tâche à faire.';
    } catch (error) {
      if (version === loadVersion) status.textContent = error.message;
    }
  }

  enable.addEventListener('click', async () => {
    enable.disabled = true;
    try {
      if (!(await currentSubscription())) await enablePushNotifications();
      await registerSubscription();
      enable.textContent = '✓ Notifications activées';
      status.textContent = 'Les rappels de cette liste seront envoyés sur cet appareil.';
    } catch (error) {
      status.textContent = error.message;
      enable.disabled = false;
    }
  });

  form.addEventListener('input', () => { if (!submit.disabled) submissionId = undefined; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = message.value.trim();
    if (!value || submit.disabled) return;
    const date = reminder.value ? new Date(reminder.value) : null;
    if (date && (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())) {
      status.textContent = 'Choisis une date et une heure à venir.';
      return;
    }
    submit.disabled = message.disabled = reminder.disabled = true;
    status.textContent = 'Enregistrement…';
    try {
      const subscription = date ? await registerSubscription() : null;
      submissionId ||= crypto.randomUUID();
      await request('POST', {
        id: submissionId, message: value,
        remind_at: date?.toISOString(), endpoint: subscription?.endpoint
      });
      submissionId = undefined;
      form.reset();
      await load();

    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = message.disabled = reminder.disabled = false;
      if (!submissionId) message.focus();
    }
  });

  async function showView() {
    const active = location.hash === '#a-faire';
    $('planningView').hidden = active;
    $('todoView').hidden = !active;
    document.body.classList.toggle('todo-active', active);
    (active ? $('planningTab') : $('todoTab')).removeAttribute('aria-current');
    (active ? $('todoTab') : $('planningTab')).setAttribute('aria-current', 'page');
    try {
      const session = await access();
      setPrivateAccess(session.authenticated);
      if (active && !session.configured) status.textContent = 'Configure ton code privé dans Cloudflare pour ouvrir ta liste.';
    } catch (error) {
      setPrivateAccess(false);
      if (active) status.textContent = error.message;
    }
    if (active && hasPrivateAccess) {
      load();
      currentSubscription().then(subscription => {
        if (subscription) enable.textContent = '✓ Notifications activées';
      }).catch(() => {});
    } else {
      window.dispatchEvent(new Event('resize'));
    }
  }
  window.addEventListener('hashchange', showView);
  setPrivateAccess(false);
  showView();
})();
