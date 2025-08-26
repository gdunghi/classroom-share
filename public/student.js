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
let codeViewer = document.getElementById('codeViewer');
let studentName = document.getElementById('studentName');
let studentRegister= document.getElementById('studentRegister');
let ready = false;
let highlightMark = null;



if(!nameInput.value) {
  codeViewer.style.visibility = "hidden";
  readyBtn.style.visibility = "hidden";
  studentRegister.style.visibility = "visible";
}


function setReadyUI() {
  readyBtn.textContent = ready ? 'พร้อมแล้ว' : 'กดเพื่อบอกว่าพร้อม';
  readyBtn.classList.toggle('secondary', !ready);
}

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert('กรุณาใส่ชื่อก่อน');
    return;
  }
  socket.emit('join-room', {role: 'student', roomId, name});
  nameInput.disabled = true;
  joinBtn.disabled = true;
  readyBtn.disabled = false;
  codeViewer.style.visibility = "visible";
  readyBtn.style.visibility = "visible";
  studentRegister.style.visibility = "hidden";
  studentName.innerText = "Hi, " + name + "!";
});

readyBtn.addEventListener('click', () => {
  ready = !ready;
  setReadyUI();
  socket.emit('student-ready', {roomId, ready});
});

socket.on('init-code', ({code, selection}) => {
  viewer.setValue(code || '');
  applySelection(selection);
});

socket.on('code-update', (code) => {
  viewer.setValue(code || '');
});

socket.on('selection-update', (selection) => {
  applySelection(selection);
});

socket.on('reset-ready', () => {
  ready = false;
  setReadyUI();
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
      highlightMark = viewer.markText(from, to, {className: 'highlight'});
      viewer.scrollIntoView({from, to}, 100);
    } catch (e) {
      // console.error(e);
    }
  }
}

