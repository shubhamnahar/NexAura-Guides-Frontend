export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

export const endpoints = {
  auth: {
    login: `${API_BASE_URL}/api/auth/token`,
    register: `${API_BASE_URL}/api/auth/register`,
  },
  guides: {
    base: `${API_BASE_URL}/api/guides/`,
    public: `${API_BASE_URL}/api/guides/public`,
    search: `${API_BASE_URL}/api/guides/search`,
    detail: (id) => `${API_BASE_URL}/api/guides/${id}`,
    exportPdf: (id) => `${API_BASE_URL}/api/guides/${id}/export-pdf`,
  },
  analyze: {
    live: `${API_BASE_URL}/api/analyze_live`,
  },
};
