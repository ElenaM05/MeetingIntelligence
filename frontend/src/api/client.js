import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (email, password, name) =>
  api.post("/auth/register", { email, password, name });

export const login = (email, password) =>
  api.post("/auth/login", { email, password });

export const getMe = () => api.get("/auth/me");

// Transcripts
export const uploadTranscripts = (files, project = "default") => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("project", project);
  return api.post("/transcripts/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const listTranscripts = (project) =>
  api.get("/transcripts/", { params: project ? { project } : {} });

export const getTranscript = (id) => api.get(`/transcripts/${id}`);

export const deleteTranscript = (id) => api.delete(`/transcripts/${id}`);

// Extraction
export const getExtractionResult = (transcriptId) =>
  api.get(`/extract/${transcriptId}`);

export const extractTranscripts = (transcriptIds) =>
  api.post("/extract/", { transcript_ids: transcriptIds });

const downloadWithAuth = async (url, filename) => {
  const token = localStorage.getItem("token");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Export failed");
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  setTimeout(() => {
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 100);
};

export const exportCSV = (transcriptId) =>
  downloadWithAuth(
    `http://localhost:8000/api/extract/${transcriptId}/export/csv`,
    `extraction_${transcriptId}.csv`
  );

export const exportJSON = (transcriptId) =>
  downloadWithAuth(
    `http://localhost:8000/api/extract/${transcriptId}/export/json`,
    `extraction_${transcriptId}.json`
  );

export const exportPDF = (transcriptId) =>
  downloadWithAuth(
    `http://localhost:8000/api/extract/${transcriptId}/export/pdf`,
    `extraction_${transcriptId}.pdf`
  );
// Chat
export const startSession = (transcriptIds) =>
  api.post("/chat/session", { transcript_ids: transcriptIds });

export const askQuestion = (sessionId, question) =>
  api.post(`/chat/session/${sessionId}/ask`, { question });

export const getSession = (sessionId) =>
  api.get(`/chat/session/${sessionId}`);

export default api;