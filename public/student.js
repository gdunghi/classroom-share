// student.js
const socket = io();
const roomId = window.location.pathname.split('/').pop();
document.getElementById('roomLabel').textContent = roomId;

const viewer = CodeMirror.fromTextArea(document.getElementById('viewer'), {
  mode: 'text/x-sql',   // หรือ 'shell' / 'javascript'
  lineNumbers: true,
  readOnly: true,
  theme: 'darcula'
});

let nameInput = document.getElementById('displayName');
let joinBtn = document.getElementById('joinBtn');
let readyBtn = document.getElementById('readyBtn');
let ready = false;
let highlightMark = null;

function setReadyUI() {
  readyBtn.textContent = ready ? 'พร้อมแล้ว' : 'กดเมื่อพร้อม';
  readyBtn.classList.toggle('secondary', !ready);
}

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { alert('กรุณาใส่ชื่อก่อน'); return; }
  socket.emit('join-room', { role: 'student', roomId, name });
  nameInput.disabled = true;
  joinBtn.disabled = true;
  readyBtn.disabled = false;
});

readyBtn.addEventListener('click', () => {
  ready = !ready;
  setReadyUI();
  socket.emit('student-ready', { roomId, ready });
});

socket.on('init-code', ({ code, selection }) => {
  viewer.setValue(code || '');
  applySelection(selection);
});

socket.on('code-update', (code) => {
  viewer.setValue(code || '');
});

socket.on('selection-update', (selection) => {
  applySelection(selection);
});

function applySelection(selection) {
  if (highlightMark) {
    highlightMark.clear();
    highlightMark = null;
  }
  if (selection && selection.anchor && selection.head) {
    try {
      const from = selection.anchor;
      const to = selection.head;
      highlightMark = viewer.markText(from, to, { className: 'highlight' });
      viewer.scrollIntoView({ from, to }, 100);
    } catch (e) {
      // ignore
    }
  }
}
