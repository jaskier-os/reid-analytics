import api from './api';

const reidService = {
  async getPersons(limit = 20, offset = 0, isActive) {
    try {
      const params = { limit, offset };
      if (isActive !== undefined) params.is_active = isActive;
      const response = await api.get('/reid/persons', { params });
      return response;
    } catch (error) {
      console.error('Error fetching persons:', error);
      throw error;
    }
  },

  async hidePerson(personId) {
    try {
      const response = await api.put(`/reid/persons/${personId}`, { is_active: false });
      return response;
    } catch (error) {
      console.error(`Error hiding person ${personId}:`, error);
      throw error;
    }
  },

  async unhidePerson(personId) {
    try {
      const response = await api.put(`/reid/persons/${personId}`, { is_active: true });
      return response;
    } catch (error) {
      console.error(`Error unhiding person ${personId}:`, error);
      throw error;
    }
  },

  async deletePerson(personId) {
    try {
      const response = await api.delete(`/reid/persons/${personId}`);
      return response;
    } catch (error) {
      console.error(`Error deleting person ${personId}:`, error);
      throw error;
    }
  },

  async getPerson(personId) {
    try {
      const response = await api.get(`/reid/persons/${personId}`);
      return response; // Interceptor already unwrapped response.data
    } catch (error) {
      console.error(`Error fetching person ${personId}:`, error);
      throw error;
    }
  },

  async getPersonSightings(personId, limit = 50, offset = 0) {
    try {
      const response = await api.get(`/reid/persons/${personId}/sightings`, {
        params: { limit, offset }
      });
      return response;
    } catch (error) {
      console.error(`Error fetching sightings for person ${personId}:`, error);
      throw error;
    }
  },

  async getPersonSnapshots(personId) {
    try {
      const response = await api.get(`/reid/persons/${personId}/snapshots`);
      return response;
    } catch (error) {
      console.error(`Error fetching snapshots for person ${personId}:`, error);
      throw error;
    }
  },

  async getSimilarPersons(personId, threshold = 0.7, limit = 10) {
    try {
      const response = await api.get(`/reid/persons/${personId}/similar`, {
        params: { threshold, limit }
      });
      return response;
    } catch (error) {
      console.error(`Error fetching similar persons for ${personId}:`, error);
      throw error;
    }
  },

  async getAllSightings(limit = 100, offset = 0, startDate = null, endDate = null) {
    try {
      const params = { limit, offset };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/reid/sightings', { params });
      return response;
    } catch (error) {
      console.error('Error fetching sightings:', error);
      throw error;
    }
  },

  async getPersonTraits(personId) {
    try {
      const response = await api.get(`/reid/persons/${personId}/traits`);
      return response;
    } catch (error) {
      console.error(`Error fetching traits for person ${personId}:`, error);
      throw error;
    }
  },

  async searchPersons(query) {
    try {
      const response = await api.get('/reid/persons/search', {
        params: { q: query }
      });
      return response;
    } catch (error) {
      console.error('Error searching persons:', error);
      throw error;
    }
  },

  async getCameras() {
    try {
      const response = await api.get('/reid/cameras');
      return response;
    } catch (error) {
      console.error('Error fetching cameras:', error);
      throw error;
    }
  },

  getPersonImageUrl(personId) {
    return `/api/reid/persons/${personId}/image`;
  },

  getPersonFace3DUrl(personId) {
    return `/api/reid/persons/${personId}/face3d`;
  },

  async searchPersonInfo(personId, { service = 'sherlock', searchType, query, options }) {
    try {
      const response = await api.post(`/reid/persons/${personId}/search-info`, {
        service,
        searchType,
        query,
        options
      });
      return response;
    } catch (error) {
      console.error(`Error running OSINT search for ${personId}:`, error);
      throw error;
    }
  },

  async searchByPhoto(imageFile, threshold = 0.7, limit = 10) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('threshold', threshold.toString());
      formData.append('limit', limit.toString());

      const response = await api.post('/reid/persons/search/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      console.error('Error searching by photo:', error);
      throw error;
    }
  }
};

export default reidService;
