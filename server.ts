import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'supersecret';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://wfjwukoounzliqpoiwry.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmand1a29vdW56bGlxcG9pd3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0OTI4OTksImV4cCI6MjEwMjA2ODg5OX0.EYcs4DW9y0n6iUEQp-vdv27tWAf59R6ODwZSZQSDwkU'
);

// Setup Multer for memory uploads (Serverless-compatible)
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middlewares
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  next();
};

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  const { npm, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { npm } });
    if (!user) return res.status(401).json({ error: 'Kredensial tidak valid' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Kredensial tidak valid' });

    const token = jwt.sign({ id: user.id, npm: user.npm, role: user.role, name: user.name, campus: user.campus }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, npm: user.npm, name: user.name, role: user.role, campus: user.campus } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user: { id: user.id, npm: user.npm, name: user.name, role: user.role, campus: user.campus } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ADMIN ROUTES ---
app.delete('/api/admin/tasks/:taskId', authMiddleware, adminMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

    const submissions = await prisma.submission.findMany({ where: { taskId } });
    for (const sub of submissions) {
      if (sub.proofUrl) {
        const fileName = sub.proofUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('proofs').remove([fileName]);
        }
      }
    }

    await prisma.submission.deleteMany({ where: { taskId } });
    await prisma.task.delete({ where: { id: taskId } });
    res.json({ message: 'Tugas berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus tugas' });
  }
});

app.delete('/api/admin/students/:studentId', authMiddleware, adminMiddleware, async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  try {
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({ error: 'Mahasiswa tidak ditemukan' });
    }

    const submissions = await prisma.submission.findMany({ where: { studentId } });
    for (const sub of submissions) {
      if (sub.proofUrl) {
        const fileName = sub.proofUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('proofs').remove([fileName]);
        }
      }
    }

    await prisma.submission.deleteMany({ where: { studentId } });
    await prisma.notification.deleteMany({ where: { userId: studentId } });
    await prisma.user.delete({ where: { id: studentId } });
    res.json({ message: 'Mahasiswa berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus mahasiswa' });
  }
});

app.post('/api/admin/import-students', authMiddleware, adminMiddleware, async (req, res) => {
  const { students } = req.body; // array of { npm, name, campus }
  try {
    let imported = 0;
    const defaultPassword = await bcrypt.hash('12345', 10);
    for (const student of students) {
      if (!student.npm || !student.name || !student.campus) continue;
      
      const exists = await prisma.user.findUnique({ where: { npm: String(student.npm) } });
      if (!exists) {
        await prisma.user.create({
          data: {
            npm: String(student.npm),
            name: student.name,
            campus: student.campus,
            password: defaultPassword,
            role: 'STUDENT',
          }
        });
        imported++;
      }
    }
    res.json({ message: `${imported} mahasiswa berhasil diimport.` });
  } catch (error) {
    res.status(500).json({ error: 'Gagal import data' });
  }
});

app.post('/api/admin/students', authMiddleware, adminMiddleware, async (req, res) => {
  const { npm, name, campus } = req.body;
  try {
    if (!npm || !name || !campus) return res.status(400).json({ error: 'Data tidak lengkap' });
    
    const exists = await prisma.user.findUnique({ where: { npm: String(npm) } });
    if (exists) return res.status(400).json({ error: 'NPM sudah terdaftar' });

    const defaultPassword = await bcrypt.hash('12345', 10);
    const student = await prisma.user.create({
      data: {
        npm: String(npm),
        name,
        campus,
        password: defaultPassword,
        role: 'STUDENT',
      }
    });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambahkan mahasiswa' });
  }
});

app.get('/api/admin/students', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, npm: true, name: true, campus: true, createdAt: true }
    });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/tasks', authMiddleware, adminMiddleware, async (req, res) => {
  const { title, description, igPostUrl } = req.body;
  try {
    const task = await prisma.task.create({
      data: { title, description, igPostUrl }
    });

    // Notify all students
    const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });
    if (students.length > 0) {
      const notifications = students.map(s => ({
        userId: s.id,
        message: `Tugas Baru: ${title}. Segera berikan like, komen, dan repost!`,
      }));
      await prisma.notification.createMany({ data: notifications });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat tugas' });
  }
});

app.get('/api/admin/tasks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { submissions: true }
        }
      }
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report for a specific task (who has liked/uploaded vs who hasn't)
app.get('/api/admin/tasks/:taskId/report', authMiddleware, adminMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Not found' });

    const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });
    const submissions = await prisma.submission.findMany({ where: { taskId } });

    const report = students.map(student => {
      const submission = submissions.find(s => s.studentId === student.id);
      return {
        id: student.id,
        npm: student.npm,
        name: student.name,
        campus: student.campus,
        hasUploaded: !!submission,
        proofUrl: submission ? submission.proofUrl : null,
        submittedAt: submission ? submission.createdAt : null,
      };
    });

    res.json({ task, report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- STUDENT ROUTES ---
app.get('/api/student/tasks', authMiddleware, async (req: any, res: any) => {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
    const submissions = await prisma.submission.findMany({ where: { studentId: req.user.id } });

    const tasksWithStatus = tasks.map(t => {
      const submission = submissions.find(s => s.taskId === t.id);
      return {
        ...t,
        hasUploaded: !!submission,
        submission: submission || null,
      };
    });
    res.json(tasksWithStatus);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/student/tasks/:taskId/submit', authMiddleware, upload.single('proof'), async (req: any, res: any) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const exists = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });
    if (exists) {
      return res.status(400).json({ error: 'Anda sudah mengunggah bukti untuk tugas ini' });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileName = `${uniqueSuffix}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase Storage Error:", uploadError);
      return res.status(500).json({ error: 'Gagal mengunggah ke penyimpanan cloud' });
    }

    const { data: publicUrlData } = supabase.storage
      .from('proofs')
      .getPublicUrl(fileName);

    const submission = await prisma.submission.create({
      data: {
        taskId,
        studentId,
        proofUrl: publicUrlData.publicUrl,
      }
    });
    res.json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengunggah bukti' });
  }
});

app.get('/api/student/notifications', authMiddleware, async (req: any, res: any) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create initial admin user if none exists
async function seedAdmin() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL is not set. Skipping admin seed.');
      return;
    }
    const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          npm: 'admin',
          name: 'Administrator',
          campus: 'Pusat',
          password: hashedPassword,
          role: 'ADMIN',
        }
      });
      console.log('Default admin created: npm=admin, password=admin123');
    }
  } catch (error) {
    console.error('⚠️ Failed to seed admin user. Database might not be connected yet.', error);
  }
}

async function startServer() {
  await seedAdmin();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
