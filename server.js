import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory room state
// rooms[roomId] = {
//   code: string,
//   selection: {anchor:{line,ch}, head:{line,ch}} | null,
//   students: { [socketId]: { name, ready } },
//   teacherId: socketId | null
// }
const rooms = {};

function makeRoomId(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/teacher', (req, res) => {
  // Create room and redirect teacher to room page
  let id;
  do { id = makeRoomId(); } while (rooms[id]);
  rooms[id] = { code: '// เริ่มพิมพ์โค้ดที่นี่\n', selection: null, students: {}, teacherId: null };
  res.redirect(`/teacher/${id}`);
});

app.get('/teacher/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

app.get('/student/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

io.on('connection', (socket) => {
  // Join room
  socket.on('join-room', ({ role, roomId, name }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error-message', 'ไม่พบห้องเรียน (room not found)');
      return;
    }
    socket.join(roomId);

    if (role === 'teacher') {
      room.teacherId = socket.id;
      // Send current state to teacher
      socket.emit('room-state', {
        roomId,
        code: room.code,
        students: room.students,
        allReady: Object.keys(room.students).length > 0 && Object.values(room.students).every(s => s.ready === true),
      });
    } else if (role === 'student') {
      const sanitized = String(name || '').trim();
      if (!sanitized) {
        socket.emit('error-message', 'กรุณาใส่ชื่อก่อนเข้าเรียน');
        return;
      }
      room.students[socket.id] = { name: sanitized, ready: false };
      // Notify teacher about student list/ready status change
      io.to(room.teacherId || '').emit('students-updated', room.students);
      // Send initial code & selection to student
      socket.emit('init-code', { code: room.code, selection: room.selection });
    }
  });

  // Teacher updates code
  socket.on('teacher-code-update', ({ roomId, code }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.teacherId) return;
    room.code = code;
    socket.to(roomId).emit('code-update', code);
  });

  // Teacher selection highlight
  socket.on('teacher-selection', ({ roomId, selection }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.teacherId) return;
    room.selection = selection;
    socket.to(roomId).emit('selection-update', selection);
  });

  // Student toggles ready
  socket.on('student-ready', ({ roomId, ready }) => {
    const room = rooms[roomId];
    if (!room || !room.students[socket.id]) return;
    room.students[socket.id].ready = !!ready;
    io.to(room.teacherId || '').emit('students-updated', room.students);
    const allReady = Object.keys(room.students).length > 0 && Object.values(room.students).every(s => s.ready === true);
    io.to(room.teacherId || '').emit('all-ready', allReady);
  });

  // Teacher reset all students to unready
  socket.on('teacher-reset-ready', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.teacherId) return; // ตรวจสอบว่าเป็นครู

    // รีเซ็ตทุก student ให้ยังไม่พร้อม
    Object.values(room.students).forEach(s => { s.ready = false; });

    // ส่งอัพเดทกลับไปหาครู
    io.to(room.teacherId || '').emit('students-updated', room.students);
    io.to(room.teacherId || '').emit('all-ready', false);

    io.to(roomId).emit('reset-ready');
  });




  // Clean up on disconnect
  socket.on('disconnect', () => {
    // find room containing this socket
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.teacherId === socket.id) {
        room.teacherId = null;
        // notify students that teacher left (optional)
        io.to(roomId).emit('teacher-left');
      }
      if (room.students[socket.id]) {
        delete room.students[socket.id];
        io.to(room.teacherId || '').emit('students-updated', room.students);
        const allReady = Object.keys(room.students).length > 0 && Object.values(room.students).every(s => s.ready === true);
        io.to(room.teacherId || '').emit('all-ready', allReady);
      }
    }
  });
});


const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
