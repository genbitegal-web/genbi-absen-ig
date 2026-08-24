import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres.wfjwukoounzliqpoiwry:keluargagenbitegal@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = "postgresql://postgres.wfjwukoounzliqpoiwry:keluargagenbitegal@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
}

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'kunci_rahasia_genbi_tegal_2024';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://wfjwukoounzliqpoiwry.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmand1a29vdW56bGlxcG9pd3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0OTI4OTksImV4cCI6MjEwMjA2ODg5OX0.EYcs4DW9y0n6iUEQp-vdv27tWAf59R6ODwZSZQSDwkU'
);

// Setup Multer for memory uploads with generous size limits (Serverless-compatible)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

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
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user: { id: user.id, npm: user.npm, name: user.name, role: user.role, campus: user.campus } });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
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
    res.status(500).json({ error: error.message || "Unknown error" });
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
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.post('/api/admin/students/bulk-delete', authMiddleware, adminMiddleware, async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'Tidak ada mahasiswa yang dipilih' });
  }

  try {
    const students = await prisma.user.findMany({ 
      where: { id: { in: studentIds }, role: 'STUDENT' } 
    });
    
    const validStudentIds = students.map(s => s.id);
    
    if (validStudentIds.length === 0) {
      return res.status(404).json({ error: 'Mahasiswa tidak valid' });
    }

    const submissions = await prisma.submission.findMany({ where: { studentId: { in: validStudentIds } } });
    const filesToDelete = submissions
      .map(sub => sub.proofUrl ? sub.proofUrl.split('/').pop() : null)
      .filter((f): f is string => f !== null);

    if (filesToDelete.length > 0) {
      await supabase.storage.from('proofs').remove(filesToDelete);
    }

    await prisma.submission.deleteMany({ where: { studentId: { in: validStudentIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: validStudentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: validStudentIds } } });
    
    res.json({ message: `${validStudentIds.length} Mahasiswa berhasil dihapus` });
  } catch (error) {
    console.error("Bulk Delete Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.post('/api/admin/import-students', authMiddleware, adminMiddleware, async (req, res) => {
  const { students } = req.body; // array of { npm, name, campus }
  try {
    const defaultPassword = await bcrypt.hash('12345', 10);
    
    // Filter out invalid students
    const validStudents = students.filter((s: any) => s.npm && s.name && s.campus).map((s: any) => ({
      npm: String(s.npm),
      name: s.name,
      campus: s.campus,
      password: defaultPassword,
      role: 'STUDENT'
    }));

    if (validStudents.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data valid untuk diimport' });
    }

    const totalInput = validStudents.length;

    const result = await prisma.user.createMany({
      data: validStudents,
      skipDuplicates: true
    });

    const skipped = totalInput - result.count;
    res.json({ 
      message: `${result.count} mahasiswa baru berhasil diimport. ${skipped > 0 ? `${skipped} data dilewati (NPM sudah ada).` : ''}`.trim() 
    });
  } catch (error: any) {
    console.error("Import Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
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
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.put('/api/admin/students/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { npm, name, campus, password } = req.body;
  try {
    const dataToUpdate: any = { npm: String(npm), name, campus };
    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }
    const updatedStudent = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });
    res.json(updatedStudent);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'NPM sudah terdaftar' });
    }
    res.status(500).json({ error: error.message || "Unknown error" });
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
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.post('/api/admin/tasks', authMiddleware, adminMiddleware, async (req, res) => {
  const { title, description, igPostUrls, igPostUrl } = req.body;
  try {
    const task = await prisma.task.create({
      data: { 
        title, 
        description, 
        igPostUrl: igPostUrl || null,
        igPostUrls: igPostUrls || []
      }
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
    res.status(500).json({ error: error.message || "Unknown error" });
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
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.get('/api/admin/report/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
    const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, orderBy: { name: 'asc' } });
    const submissions = await prisma.submission.findMany();
    res.json({ tasks, students, submissions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unknown error" });
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
      const totalLinks = task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls.length : (task.igPostUrl ? 1 : 1);
      const hasUploaded = submission ? submission.proofUrls.filter(url => !!url).length >= totalLinks : false;
      return {
        id: student.id,
        npm: student.npm,
        name: student.name,
        campus: student.campus,
        hasUploaded,
        proofUrls: submission ? submission.proofUrls : [],
        submittedAt: submission ? submission.createdAt : null,
      };
    });

    res.json({ task, report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

// --- STUDENT ROUTES ---
app.get('/api/student/tasks', authMiddleware, async (req: any, res: any) => {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
    const submissions = await prisma.submission.findMany({ where: { studentId: req.user.id } });

    const tasksWithStatus = tasks.map(t => {
      const submission = submissions.find(s => s.taskId === t.id);
      const totalLinks = t.igPostUrls && t.igPostUrls.length > 0 ? t.igPostUrls.length : (t.igPostUrl ? 1 : 1);
      const hasUploaded = submission ? submission.proofUrls.filter(url => !!url).length >= totalLinks : false;
      return {
        ...t,
        hasUploaded,
        submission: submission || null,
      };
    });
    res.json(tasksWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.post('/api/student/tasks/:taskId/submit', authMiddleware, upload.single('proof'), async (req: any, res: any) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  const linkIndex = parseInt(req.body.linkIndex || "0");
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
    
    const totalLinks = task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls.length : (task.igPostUrl ? 1 : 1);

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const originalExt = path.extname(req.file.originalname || '').toLowerCase();
    const ext = originalExt && originalExt !== '.heic' && originalExt !== '.heif' ? originalExt : '.jpg';
    const baseClean = req.file.originalname 
      ? path.basename(req.file.originalname, originalExt).replace(/[^a-zA-Z0-9]/g, '') 
      : 'proof';
    const fileName = `${uniqueSuffix}-${baseClean || 'proof'}${ext}`;
    const contentType = req.file.mimetype && req.file.mimetype !== 'application/octet-stream' 
      ? req.file.mimetype 
      : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(fileName, req.file.buffer, {
        contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase Storage Error:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Unknown error" });
    }

    const { data: publicUrlData } = supabase.storage
      .from('proofs')
      .getPublicUrl(fileName);

    let submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });

    if (submission) {
      const newProofUrls = [...submission.proofUrls];
      while (newProofUrls.length < totalLinks) newProofUrls.push("");
      newProofUrls[linkIndex] = publicUrlData.publicUrl;
      submission = await prisma.submission.update({
        where: { id: submission.id },
        data: { 
          proofUrls: newProofUrls,
          status: 'PENDING'
        }
      });
    } else {
      const initialProofUrls = new Array(totalLinks).fill("");
      initialProofUrls[linkIndex] = publicUrlData.publicUrl;
      submission = await prisma.submission.create({
        data: {
          taskId,
          studentId,
          proofUrls: initialProofUrls,
          status: 'PENDING'
        }
      });
    }

    res.json(submission);
  } catch (error: any) {
    console.error("Submission Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.post('/api/student/tasks/:taskId/finalize', authMiddleware, async (req: any, res: any) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

    const totalLinks = task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls.length : (task.igPostUrl ? 1 : 1);
    const submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });

    if (!submission) {
      return res.status(400).json({ error: 'Belum ada bukti foto yang diunggah' });
    }

    const uploadedCount = submission.proofUrls.filter(url => !!url).length;
    if (uploadedCount < totalLinks) {
      return res.status(400).json({ error: `Harap lengkapi semua foto bukti (${uploadedCount}/${totalLinks} terunggah)` });
    }

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'SUBMITTED' }
    });

    res.json({ message: 'Tugas berhasil disubmit!', submission: updated });
  } catch (error: any) {
    console.error("Finalize Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.post('/api/student/tasks/:taskId/remove-proof', authMiddleware, async (req: any, res: any) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  const linkIndex = parseInt(req.body.linkIndex || "0");
  try {
    const submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });
    if (!submission) {
      return res.status(404).json({ error: 'Data pengumpulan tidak ditemukan' });
    }

    const newProofUrls = [...submission.proofUrls];
    if (newProofUrls[linkIndex]) {
      newProofUrls[linkIndex] = "";
    }

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        proofUrls: newProofUrls,
        status: 'PENDING'
      }
    });

    res.json({ message: 'Bukti berhasil dihapus', submission: updated });
  } catch (error: any) {
    console.error("Remove Proof Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
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
    res.status(500).json({ error: error.message || "Unknown error" });
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
    const { createServer: createViteServer } = await import('vite');
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
