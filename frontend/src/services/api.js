import axios from 'axios';

// Create axios instance for our API
const api = axios.create({
  baseURL: window.__env.reidAnalyticsServerUrl + "/api",
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds timeout
});

// Create axios instance for our API
export const authApi = axios.create({
  baseURL: window.__env.authServerUrl + "/api",
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds timeout
});

// Add a request interceptor to handle authentication
api.interceptors.request.use(
  (config) => {
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add it to the headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    // Do something with request error
    return Promise.reject(error);
  }
);

// Add authentication token to requests for all APIs
const setupInterceptors = (api) => {
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      return response.data;
    },
    (error) => {
      // Handle token expiration or unauthorized access
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        // If the token is expired or invalid, redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      // Return error message
      return Promise.reject(
        error.response?.data?.error || 
        error.response?.data?.message || 
        error.message || 
        'Something went wrong'
      );
    }
  );
};
setupInterceptors(api)
setupInterceptors(authApi)

// Function to handle API responses with better error messages
export const handleApiResponse = async (apiCall) => {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export default api;