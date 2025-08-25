// teacher.js
const socket = io();
const roomId = window.location.pathname.split('/').pop();
document.getElementById('roomLabel').textContent = roomId;

const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
  mode: 'text/x-sql',
  lineNumbers: true,
  theme: 'darcula'
});

let selectionDebounce;
let suppressChange = false;
const marks = [];

function clearMarks() {
  while (marks.length) {
    const m = marks.pop();
    m.clear();
  }
}

socket.emit('join-room', {role: 'teacher', roomId});

socket.on('room-state', ({code, students, allReady}) => {
  suppressChange = true;
  editor.setValue(code || '');
  suppressChange = false;
  renderStudents(students);
  setAllReady(allReady);
});

socket.on('students-updated', (students) => {
  renderStudents(students);
});

socket.on('all-ready', (allReady) => setAllReady(allReady));

function setAllReady(flag) {
  const badge = document.getElementById('allReadyBadge');
  if (flag) {
    badge.textContent = 'ทุกคนพร้อมแล้ว';
    badge.style.background = '#22c55e';
  } else {
    badge.textContent = 'รอทุกคนพร้อม…';
    badge.style.background = '#ef4444';
  }
}

function renderStudents(students) {
  const ul = document.getElementById('studentList');
  ul.innerHTML = '';
  Object.entries(students || {}).forEach(([id, s]) => {
    const li = document.createElement('li');
    if (s.ready) li.classList.add('ready');
    console.log(s)
    li.innerHTML = `<span>${s.name}</span><span class="pill">${s.ready ? 'พร้อม' : 'ยังไม่พร้อม'}</span>`;
    ul.appendChild(li);
  });
}

// Broadcast code changes
editor.on('change', () => {
  if (suppressChange) return;
  const code = editor.getValue();
  socket.emit('teacher-code-update', {roomId, code});
});

// Broadcast selection highlights (debounced)
editor.on('cursorActivity', () => {
  clearTimeout(selectionDebounce);
  selectionDebounce = setTimeout(() => {
    const sel = editor.listSelections()[0];
    // Only broadcast if a range is selected
    if (sel && (sel.anchor.line !== sel.head.line || sel.anchor.ch !== sel.head.ch)) {
      socket.emit('teacher-selection', {roomId, selection: {anchor: sel.anchor, head: sel.head}});
    } else {
      socket.emit('teacher-selection', {roomId, selection: null});
    }
  }, 60);
});

// Copy student link
document.getElementById('copyStudentLink').addEventListener('click', async () => {
  const url = window.location.origin + '/student/' + roomId;
  await navigator.clipboard.writeText(url);
  const btn = document.getElementById('copyStudentLink');
  const old = btn.textContent;
  btn.textContent = 'คัดลอกแล้ว';
  setTimeout(() => btn.textContent = old, 1200);
});
