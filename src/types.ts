export interface User {
  id: number;
  npm: string;
  name: string;
  campus: string;
  role: 'ADMIN' | 'STUDENT';
}

export interface Task {
  id: number;
  title: string;
  description: string;
  igPostUrl?: string;
  igPostUrls: string[];
  deadline?: string | null;
  isOpen: boolean;
  isClosed?: boolean;
  createdAt: string;
  _count?: {
    submissions: number;
  };
}

export interface Submission {
  id: number;
  taskId: number;
  studentId: number;
  proofUrls: string[];
  status: string;
  createdAt: string;
}

export interface StudentTask extends Task {
  hasUploaded: boolean;
  submission: Submission | null;
}

export interface Notification {
  id: number;
  userId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ReportItem {
  id: number;
  npm: string;
  name: string;
  campus: string;
  hasUploaded: boolean;
  proofUrls: string[];
  submittedAt: string | null;
}
