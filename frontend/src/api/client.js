import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

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
export const extractTranscripts = (transcriptIds) =>
  api.post("/extract/", { transcript_ids: transcriptIds });

export const getExtractionResult = (transcriptId) =>
  api.get(`/extract/${transcriptId}`);

export const exportCSV = (transcriptId) =>
  `http://localhost:8000/api/extract/${transcriptId}/export/csv`;

export const exportJSON = (transcriptId) =>
  `http://localhost:8000/api/extract/${transcriptId}/export/json`;

export const exportPDF = (transcriptId) =>
  `http://localhost:8000/api/extract/${transcriptId}/export/pdf`;

// Chat
export const startSession = (transcriptIds) =>
  api.post("/chat/session", { transcript_ids: transcriptIds });

export const askQuestion = (sessionId, question) =>
  api.post(`/chat/session/${sessionId}/ask`, { question });

export const getSession = (sessionId) =>
  api.get(`/chat/session/${sessionId}`);

export default api;
