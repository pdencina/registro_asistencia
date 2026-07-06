const API_BASE = '/api';

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  } catch (err) {
    throw new Error('Sin conexión a internet. Verifica tu red.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `Error ${response.status}` }));
    throw new Error(error.error || `Error ${response.status}`);
  }

  return response.json();
}

// Employees API
export const employeesApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/employees${query ? `?${query}` : ''}`);
  },
  getById: (id) => request(`/employees/${id}`),
  create: (data) => request('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => request(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
};

// Attendance API
export const attendanceApi = {
  register: (data) => request('/attendance/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getToday: () => request('/attendance/today'),
  getHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/attendance/history${query ? `?${query}` : ''}`);
  },
  getSummary: (date) => {
    const query = date ? `?date=${date}` : '';
    return request(`/attendance/summary${query}`);
  },
  getEmployeeStatus: (id) => request(`/attendance/status/${id}`),
};

// Devices API
export const devicesApi = {
  check: (deviceId) => request(`/devices?device_id=${deviceId}`),
  authorize: (deviceId, pin, name, lat, lng) => request('/devices', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, pin, name, lat, lng }),
  }),
};
