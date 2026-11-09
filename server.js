// server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
if (!process.env.DATABASE_URL) {
  console.error("\u274C DATABASE_URL tidak di-set! Pastikan file .env sudah ada dan berisi DATABASE_URL.");
  process.exit(1);
}
var app = express();
var PORT = process.env.PORT || 3005;
var SECRET_KEY = process.env.JWT_SECRET || "kunci_rahasia_genbi_tegal_2024";
var prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});
var UPLOAD_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "uploads", "proofs") : path.join(process.cwd(), "uploads", "proofs");
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Upload directory initialization notice:", e);
}
async function deleteStoredFile(urlOrFileName) {
  if (!urlOrFileName) return;
  const fileName = urlOrFileName.includes("/") ? urlOrFileName.split("/").pop() : urlOrFileName;
  if (!fileName) return;
  try {
    await prisma.proofFile.deleteMany({
      where: { fileName }
    });
  } catch (e) {
    console.warn("Gagal menghapus file dari database Neon:", fileName, e);
  }
  const localPath = path.join(UPLOAD_DIR, fileName);
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
    } catch (e) {
      console.warn("Gagal menghapus cache lokal:", localPath, e);
    }
  }
}
function detectTaskPlatform(urls = [], explicitPlatform) {
  if (explicitPlatform === "YOUTUBE" || explicitPlatform === "INSTAGRAM" || explicitPlatform === "MIXED") {
    return explicitPlatform;
  }
  const arr = toStringArray(urls);
  const validUrls = arr.filter((u) => u && typeof u === "string" && u.trim().length > 0);
  if (validUrls.length === 0) return "INSTAGRAM";
  const ytCount = validUrls.filter((u) => u.toLowerCase().includes("youtube.com") || u.toLowerCase().includes("youtu.be")).length;
  const igCount = validUrls.filter((u) => u.toLowerCase().includes("instagram.com")).length;
  if (ytCount > 0 && igCount === 0) return "YOUTUBE";
  if (igCount > 0 && ytCount === 0) return "INSTAGRAM";
  if (ytCount > 0 && igCount > 0) return "MIXED";
  return "INSTAGRAM";
}
function toStringArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}
var storage = multer.memoryStorage();
var upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
    // 25MB limit
  }
});
app.use(cors());
app.use(express.json({ limit: "10mb" }));
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (!req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
    next();
  });
}
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.get("/uploads/proofs/:fileName", (req, res) => {
  const { fileName } = req.params;
  const localPath = path.join(UPLOAD_DIR, fileName);
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  return res.status(404).send("File bukti tidak ditemukan di server lokal");
});
var authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
var adminMiddleware = (req, res, next) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  next();
};
app.post("/api/auth/login", async (req, res) => {
  const { npm, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { npm } });
    if (!user) return res.status(401).json({ error: "Kredensial tidak valid" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Kredensial tidak valid" });
    const token = jwt.sign({ id: user.id, npm: user.npm, role: user.role, name: user.name, campus: user.campus }, SECRET_KEY, { expiresIn: "1d" });
    res.json({ token, user: { id: user.id, npm: user.npm, name: user.name, role: user.role, campus: user.campus } });
  } catch (error) {
    console.error("Login error:", error);
    if (error.message?.includes("tenant/user") || error.message?.includes("P1001") || error.message?.includes("database")) {
      return res.status(500).json({
        error: "Koneksi database terputus. Silakan masukkan DATABASE_URL Neon yang baru di pengaturan environment."
      });
    }
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ user: { id: user.id, npm: user.npm, name: user.name, role: user.role, campus: user.campus } });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.delete("/api/admin/tasks/:taskId", authMiddleware, adminMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
    const submissions = await prisma.submission.findMany({ where: { taskId } });
    for (const sub of submissions) {
      if (Array.isArray(sub.proofUrls)) {
        for (const url of sub.proofUrls) {
          await deleteStoredFile(url);
        }
      }
    }
    await prisma.submission.deleteMany({ where: { taskId } });
    await prisma.task.delete({ where: { id: taskId } });
    res.json({ message: "Tugas berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.delete("/api/admin/students/:studentId", authMiddleware, adminMiddleware, async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  try {
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== "STUDENT") {
      return res.status(404).json({ error: "Mahasiswa tidak ditemukan" });
    }
    const submissions = await prisma.submission.findMany({ where: { studentId } });
    for (const sub of submissions) {
      if (Array.isArray(sub.proofUrls)) {
        for (const url of sub.proofUrls) {
          await deleteStoredFile(url);
        }
      }
    }
    await prisma.submission.deleteMany({ where: { studentId } });
    await prisma.notification.deleteMany({ where: { userId: studentId } });
    await prisma.user.delete({ where: { id: studentId } });
    res.json({ message: "Mahasiswa berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/admin/students/bulk-delete", authMiddleware, adminMiddleware, async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: "Tidak ada mahasiswa yang dipilih" });
  }
  try {
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: "STUDENT" }
    });
    const validStudentIds = students.map((s) => s.id);
    if (validStudentIds.length === 0) {
      return res.status(404).json({ error: "Mahasiswa tidak valid" });
    }
    const submissions = await prisma.submission.findMany({ where: { studentId: { in: validStudentIds } } });
    for (const sub of submissions) {
      if (Array.isArray(sub.proofUrls)) {
        for (const url of sub.proofUrls) {
          await deleteStoredFile(url);
        }
      }
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
app.post("/api/admin/import-students", authMiddleware, adminMiddleware, async (req, res) => {
  const { students } = req.body;
  try {
    const defaultPassword = await bcrypt.hash("12345", 10);
    const validStudents = students.filter((s) => s.npm && s.name && s.campus).map((s) => ({
      npm: String(s.npm),
      name: s.name,
      campus: s.campus,
      password: defaultPassword,
      role: "STUDENT"
    }));
    if (validStudents.length === 0) {
      return res.status(400).json({ error: "Tidak ada data valid untuk diimport" });
    }
    const totalInput = validStudents.length;
    const result = await prisma.user.createMany({
      data: validStudents,
      skipDuplicates: true
    });
    const skipped = totalInput - result.count;
    res.json({
      message: `${result.count} mahasiswa baru berhasil diimport. ${skipped > 0 ? `${skipped} data dilewati (NPM sudah ada).` : ""}`.trim()
    });
  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/admin/students", authMiddleware, adminMiddleware, async (req, res) => {
  const { npm, name, campus } = req.body;
  try {
    if (!npm || !name || !campus) return res.status(400).json({ error: "Data tidak lengkap" });
    const exists = await prisma.user.findUnique({ where: { npm: String(npm) } });
    if (exists) return res.status(400).json({ error: "NPM sudah terdaftar" });
    const defaultPassword = await bcrypt.hash("12345", 10);
    const student = await prisma.user.create({
      data: {
        npm: String(npm),
        name,
        campus,
        password: defaultPassword,
        role: "STUDENT"
      }
    });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.put("/api/admin/students/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { npm, name, campus, password } = req.body;
  try {
    const dataToUpdate = { npm: String(npm), name, campus };
    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }
    const updatedStudent = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });
    res.json(updatedStudent);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "NPM sudah terdaftar" });
    }
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/admin/students", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, npm: true, name: true, campus: true, createdAt: true }
    });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/admin/tasks", authMiddleware, adminMiddleware, async (req, res) => {
  const { title, description, igPostUrls, igPostUrl, deadline, isOpen, platform } = req.body;
  try {
    if (!title || !description) {
      return res.status(400).json({ error: "Judul dan deskripsi tugas wajib diisi" });
    }
    const allUrls = igPostUrls || (igPostUrl ? [igPostUrl] : []);
    const resolvedPlatform = detectTaskPlatform(allUrls, platform);
    const task = await prisma.task.create({
      data: {
        title,
        description,
        platform: resolvedPlatform,
        igPostUrl: igPostUrl || null,
        igPostUrls: allUrls,
        // MySQL Json? field
        deadline: deadline ? new Date(deadline) : null,
        isOpen: isOpen !== void 0 ? Boolean(isOpen) : true
      }
    });
    try {
      const students = await prisma.user.findMany({ where: { role: "STUDENT" } });
      if (students.length > 0) {
        const deadlineText = task.deadline ? ` (Batas waktu: ${new Date(task.deadline).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })})` : "";
        const actionText = resolvedPlatform === "YOUTUBE" ? "Tonton video, berikan like & komentar!" : resolvedPlatform === "MIXED" ? "Selesaikan tugas dan unggah bukti!" : "Segera berikan like, komen, dan repost!";
        const tagText = resolvedPlatform === "YOUTUBE" ? " (YouTube)" : resolvedPlatform === "MIXED" ? " (YouTube & IG)" : "";
        const notifications = students.map((s) => ({
          userId: s.id,
          message: `Tugas Baru${tagText}: ${title}${deadlineText}. ${actionText}`
        }));
        await prisma.notification.createMany({ data: notifications });
      }
    } catch (notifErr) {
      console.warn("Warning: Gagal mengirim notifikasi massal:", notifErr);
    }
    res.json({ ...task, igPostUrls: toStringArray(task.igPostUrls) });
  } catch (error) {
    console.error("Admin Task Create Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.patch("/api/admin/tasks/:taskId", authMiddleware, adminMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const { title, description, igPostUrls, deadline, isOpen, platform } = req.body;
  try {
    const updateData = {};
    if (title !== void 0) updateData.title = title;
    if (description !== void 0) updateData.description = description;
    if (igPostUrls !== void 0) {
      updateData.igPostUrls = igPostUrls;
      if (platform === void 0) {
        updateData.platform = detectTaskPlatform(igPostUrls);
      }
    }
    if (platform !== void 0) updateData.platform = platform;
    if (deadline !== void 0) updateData.deadline = deadline ? new Date(deadline) : null;
    if (isOpen !== void 0) updateData.isOpen = Boolean(isOpen);
    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.patch("/api/admin/tasks/:taskId/toggle", authMiddleware, adminMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  try {
    const current = await prisma.task.findUnique({ where: { id: taskId } });
    if (!current) return res.status(404).json({ error: "Tugas tidak ditemukan" });
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { isOpen: !current.isOpen }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/admin/tasks", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { submissions: { where: { status: "SUBMITTED" } } }
        }
      }
    });
    const now = /* @__PURE__ */ new Date();
    const tasksWithClosedStatus = tasks.map((t) => ({
      ...t,
      igPostUrls: toStringArray(t.igPostUrls),
      platform: t.platform || detectTaskPlatform(toStringArray(t.igPostUrls) || (t.igPostUrl ? [t.igPostUrl] : [])),
      isClosed: !t.isOpen || (t.deadline ? now > new Date(t.deadline) : false)
    }));
    res.json(tasksWithClosedStatus);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/admin/report/all", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: "asc" } });
    const students = await prisma.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } });
    const submissions = await prisma.submission.findMany();
    const formattedTasks = tasks.map((t) => ({
      ...t,
      platform: t.platform || detectTaskPlatform(t.igPostUrls || (t.igPostUrl ? [t.igPostUrl] : []))
    }));
    res.json({ tasks: formattedTasks, students, submissions });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/admin/tasks/:taskId/report", authMiddleware, adminMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Not found" });
    const students = await prisma.user.findMany({ where: { role: "STUDENT" } });
    const submissions = await prisma.submission.findMany({ where: { taskId } });
    const report = students.map((student) => {
      const submission = submissions.find((s) => s.studentId === student.id);
      const totalLinks = task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls.length : task.igPostUrl ? 1 : 1;
      const uploadedCount = submission ? submission.proofUrls.filter((url) => !!url).length : 0;
      const isCompleted = submission ? submission.status === "SUBMITTED" || uploadedCount >= totalLinks : false;
      const isExplicitlySubmitted = submission ? submission.status === "SUBMITTED" : false;
      return {
        id: student.id,
        npm: student.npm,
        name: student.name,
        campus: student.campus,
        hasUploaded: isExplicitlySubmitted,
        status: submission ? submission.status : "UNSUBMITTED",
        uploadedCount,
        totalLinks,
        proofUrls: submission ? submission.proofUrls : [],
        submittedAt: submission ? submission.createdAt : null
      };
    });
    const taskWithPlatform = {
      ...task,
      platform: task.platform || detectTaskPlatform(task.igPostUrls || (task.igPostUrl ? [task.igPostUrl] : []))
    };
    res.json({ task: taskWithPlatform, report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/student/tasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
    const submissions = await prisma.submission.findMany({ where: { studentId: req.user.id } });
    const now = /* @__PURE__ */ new Date();
    const tasksWithStatus = tasks.map((t) => {
      const submission = submissions.find((s) => s.taskId === t.id);
      const totalLinks = t.igPostUrls && t.igPostUrls.length > 0 ? t.igPostUrls.length : t.igPostUrl ? 1 : 1;
      const isSubmitted = submission ? submission.status === "SUBMITTED" : false;
      const isClosed = !t.isOpen || (t.deadline ? now > new Date(t.deadline) : false);
      return {
        ...t,
        platform: t.platform || detectTaskPlatform(t.igPostUrls || (t.igPostUrl ? [t.igPostUrl] : [])),
        hasUploaded: isSubmitted,
        isClosed,
        submission: submission || null
      };
    });
    res.json(tasksWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/student/tasks/:taskId/submit", authMiddleware, upload.single("proof"), async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  const linkIndex = parseInt(req.body.linkIndex || "0");
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
    const isClosed = !task.isOpen || (task.deadline ? /* @__PURE__ */ new Date() > new Date(task.deadline) : false);
    if (isClosed) {
      return res.status(403).json({ error: "Tugas ini telah ditutup atau telah melewati batas waktu pengumpulan." });
    }
    const totalLinks = task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls.length : task.igPostUrl ? 1 : 1;
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const originalExt = path.extname(req.file.originalname || "").toLowerCase();
    const ext = originalExt && originalExt !== ".heic" && originalExt !== ".heif" ? originalExt : ".jpg";
    const baseClean = req.file.originalname ? path.basename(req.file.originalname, originalExt).replace(/[^a-zA-Z0-9]/g, "") : "proof";
    const fileName = `${uniqueSuffix}-${baseClean || "proof"}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, req.file.buffer);
    const filePublicUrl = `/uploads/proofs/${fileName}`;
    let submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });
    if (submission) {
      const oldUrl = submission.proofUrls[linkIndex];
      if (oldUrl && oldUrl !== filePublicUrl) {
        await deleteStoredFile(oldUrl);
      }
      const newProofUrls = [...submission.proofUrls];
      while (newProofUrls.length < totalLinks) newProofUrls.push("");
      newProofUrls[linkIndex] = filePublicUrl;
      submission = await prisma.submission.update({
        where: { id: submission.id },
        data: {
          proofUrls: newProofUrls,
          status: "PENDING"
        }
      });
    } else {
      const initialProofUrls = new Array(totalLinks).fill("");
      initialProofUrls[linkIndex] = filePublicUrl;
      submission = await prisma.submission.upsert({
        where: {
          taskId_studentId: {
            taskId,
            studentId
          }
        },
        update: {
          proofUrls: initialProofUrls,
          status: "PENDING",
          updatedAt: /* @__PURE__ */ new Date()
        },
        create: {
          taskId,
          studentId,
          proofUrls: initialProofUrls,
          status: "PENDING"
        }
      });
    }
    res.json(submission);
  } catch (error) {
    console.error("Submission Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/student/tasks/:taskId/finalize", authMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
    const isClosed = !task.isOpen || (task.deadline ? /* @__PURE__ */ new Date() > new Date(task.deadline) : false);
    if (isClosed) {
      return res.status(403).json({ error: "Tugas ini telah ditutup atau telah melewati batas waktu pengumpulan." });
    }
    const totalLinks = task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls.length : task.igPostUrl ? 1 : 1;
    const submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });
    if (!submission) {
      return res.status(400).json({ error: "Belum ada bukti foto yang diunggah" });
    }
    const uploadedCount = submission.proofUrls.filter((url) => !!url).length;
    if (uploadedCount < totalLinks) {
      return res.status(400).json({ error: `Harap lengkapi semua foto bukti (${uploadedCount}/${totalLinks} terunggah)` });
    }
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "SUBMITTED" }
    });
    res.json({ message: "Tugas berhasil disubmit!", submission: updated });
  } catch (error) {
    console.error("Finalize Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/student/tasks/:taskId/unsubmit", authMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
    const isClosed = !task.isOpen || (task.deadline ? /* @__PURE__ */ new Date() > new Date(task.deadline) : false);
    if (isClosed) {
      return res.status(403).json({ error: "Tidak dapat membatalkan submit karena batas waktu pengumpulan telah berakhir atau tugas ditutup." });
    }
    const submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });
    if (!submission) {
      return res.status(404).json({ error: "Data pengumpulan tidak ditemukan" });
    }
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "PENDING" }
    });
    res.json({ message: "Pengumpulan tugas berhasil dibatalkan. Anda dapat mengganti foto bukti dan mengirimkan kembali.", submission: updated });
  } catch (error) {
    console.error("Unsubmit Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.post("/api/student/tasks/:taskId/remove-proof", authMiddleware, async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  const studentId = req.user.id;
  const linkIndex = parseInt(req.body.linkIndex || "0");
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
    const isClosed = !task.isOpen || (task.deadline ? /* @__PURE__ */ new Date() > new Date(task.deadline) : false);
    if (isClosed) {
      return res.status(403).json({ error: "Tugas ini telah ditutup atau telah melewati batas waktu pengumpulan." });
    }
    const submission = await prisma.submission.findUnique({ where: { taskId_studentId: { taskId, studentId } } });
    if (!submission) {
      return res.status(404).json({ error: "Data pengumpulan tidak ditemukan" });
    }
    const newProofUrls = [...submission.proofUrls];
    if (newProofUrls[linkIndex]) {
      const oldUrl = newProofUrls[linkIndex];
      newProofUrls[linkIndex] = "";
      await deleteStoredFile(oldUrl);
    }
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        proofUrls: newProofUrls,
        status: "PENDING"
      }
    });
    res.json({ message: "Bukti berhasil dihapus", submission: updated });
  } catch (error) {
    console.error("Remove Proof Error:", error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
app.get("/api/student/notifications", authMiddleware, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});
async function seedAdmin() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("\u26A0\uFE0F DATABASE_URL is not set. Skipping admin seed.");
      return;
    }
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await prisma.user.create({
        data: {
          npm: "admin",
          name: "Administrator",
          campus: "Pusat",
          password: hashedPassword,
          role: "ADMIN"
        }
      });
      console.log("Default admin created: npm=admin, password=admin123");
    }
  } catch (error) {
    console.error("\u26A0\uFE0F Failed to seed admin user. Database might not be connected yet.", error);
  }
}
async function startServer() {
  await seedAdmin();
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  server_default as default
};
