const form = document.getElementById('feedbackForm');
const bugList = document.getElementById('bugList');
const improvementList = document.getElementById('improvementList');
const bugCount = document.getElementById('bugCount');
const improvementCount = document.getElementById('improvementCount');
const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const adminToggle = document.getElementById('adminToggle');
const adminPassword = document.getElementById('adminPassword');
const adminMessage = document.getElementById('adminMessage');
const adminBoard = document.getElementById('adminBoard');

let selectedImage = '';
let feedbacks = JSON.parse(localStorage.getItem('feedbackEntries') || '[]');

imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];

  if (!file) {
    selectedImage = '';
    preview.classList.remove('show');
    preview.removeAttribute('src');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedImage = reader.result;
    preview.src = reader.result;
    preview.classList.add('show');
  };
  reader.readAsDataURL(file);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const entry = {
    id: Date.now(),
    name: form.name.value.trim(),
    title: form.title.value.trim(),
    details: form.details.value.trim(),
    type: form.type.value,
    image: selectedImage,
    createdAt: new Date().toLocaleString(),
  };

  feedbacks.unshift(entry);
  localStorage.setItem('feedbackEntries', JSON.stringify(feedbacks));
  form.reset();
  selectedImage = '';
  preview.classList.remove('show');
  preview.removeAttribute('src');
  render();
  adminMessage.textContent = 'Thanks! Your feedback has been saved.';
});

adminToggle.addEventListener('click', () => {
  if (adminPassword.value === 'admin123') {
    adminBoard.classList.remove('hidden');
    adminMessage.textContent = 'Admin view unlocked.';
    render();
  } else {
    adminBoard.classList.add('hidden');
    adminMessage.textContent = 'Wrong password. Use admin123 to open the admin view.';
  }
});

function render() {
  const bugs = feedbacks.filter((item) => item.type === 'bug');
  const improvements = feedbacks.filter((item) => item.type === 'improvement');

  bugCount.textContent = bugs.length;
  improvementCount.textContent = improvements.length;

  bugList.innerHTML = bugs.length ? bugs.map(createCard).join('') : emptyState('No bug reports yet.');
  improvementList.innerHTML = improvements.length
    ? improvements.map(createCard).join('')
    : emptyState('No improvements or features added yet.');
}

function createCard(item) {
  return `
    <article class="card">
      <div class="meta">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.createdAt)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.details)}</p>
      <span class="tag">${item.type === 'bug' ? 'Bug' : 'Improvement'}</span>
      ${item.image ? `<img src="${item.image}" alt="Screenshot for ${escapeHtml(item.title)}" />` : ''}
    </article>
  `;
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

render();
