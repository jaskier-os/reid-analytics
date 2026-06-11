const axios = require('axios');
const config = require('../config/config');

const LOCALHOST_PATTERN = /^https?:\/\/localhost(:\d+)?/;

function extractBestName(person) {
  let osintName = null;
  const info = person.information_found;
  if (info && typeof info === 'object') {
    for (const source of Object.values(info)) {
      if (source && source.names && source.names.length > 0) {
        osintName = source.names[0];
        break;
      }
      if (source && source.fullName) {
        osintName = source.fullName;
        break;
      }
    }
  }
  return osintName || person.display_name || null;
}

class ReidService {
  constructor() {
    this.apiUrl = process.env.TRAITS_API_URL || 'http://localhost:3001';
    this.apiKey = process.env.TRAITS_API_KEY || '';
    this.workerUrl = process.env.REID_WORKER_URL || 'http://localhost:5000';
    this.streamId = process.env.REID_STREAM_ID || 'analytics-reid';

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  normalizeSnapshotUrls(data) {
    const sightings = data?.sightings;
    if (!Array.isArray(sightings)) return data;
    for (const sighting of sightings) {
      if (sighting.snapshot_path && LOCALHOST_PATTERN.test(sighting.snapshot_path)) {
        const url = new URL(sighting.snapshot_path);
        const path = url.pathname.replace(/^\/api\//, '/api/reid/');
        sighting.snapshot_path = config.baseUrl + path;
      }
    }
    return data;
  }

  async getPersons(limit = 20, offset = 0, isActive) {
    try {
      const params = { limit, offset };
      if (isActive !== undefined) params.is_active = isActive;
      const response = await this.axiosInstance.get('/api/persons', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching persons:', error.message);
      throw error;
    }
  }

  async updatePerson(personId, data) {
    try {
      const response = await this.axiosInstance.put(`/api/persons/${personId}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating person ${personId}:`, error.message);
      throw error;
    }
  }

  async deletePerson(personId) {
    try {
      const response = await this.axiosInstance.delete(`/api/persons/${personId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting person ${personId}:`, error.message);
      throw error;
    }
  }

  async getPerson(personId) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching person ${personId}:`, error.message);
      throw error;
    }
  }

  async getPersonSightings(personId, limit = 50, offset = 0) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/sightings`, {
        params: { limit, offset }
      });
      return this.normalizeSnapshotUrls(response.data);
    } catch (error) {
      console.error(`Error fetching sightings for person ${personId}:`, error.message);
      throw error;
    }
  }

  async getPersonSnapshotSightings(personId) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/sightings`, {
        params: { has_snapshot: 'true', limit: 500 }
      });
      return this.normalizeSnapshotUrls(response.data);
    } catch (error) {
      console.error(`Error fetching snapshot sightings for person ${personId}:`, error.message);
      throw error;
    }
  }

  async getSimilarPersons(personId, threshold = 0.7, limit = 10) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/similar`, {
        params: { threshold, limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching similar persons for ${personId}:`, error.message);
      throw error;
    }
  }

  async getAllSightings(limit = 100, offset = 0, startDate = null, endDate = null) {
    try {
      const params = { limit, offset };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await this.axiosInstance.get('/api/sightings', { params });
      return this.normalizeSnapshotUrls(response.data);
    } catch (error) {
      console.error('Error fetching sightings:', error.message);
      throw error;
    }
  }

  async getPersonTraits(personId) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/traits`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching traits for person ${personId}:`, error.message);
      throw error;
    }
  }

  async searchPersons(query) {
    try {
      const response = await this.axiosInstance.get('/api/persons/search', {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching persons:', error.message);
      throw error;
    }
  }

  async getCameras() {
    try {
      const response = await this.axiosInstance.get('/api/cameras');
      return response.data;
    } catch (error) {
      console.error('Error fetching cameras:', error.message);
      throw error;
    }
  }

  async getPersonImage(personId) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/image`, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching image for person ${personId}:`, error.message);
      throw error;
    }
  }

  async getPersonFace3D(personId) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/face3d`, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching 3D face model for person ${personId}:`, error.message);
      throw error;
    }
  }

  async updatePersonInformation(personId, source, data) {
    try {
      const response = await this.axiosInstance.put(`/api/persons/${personId}/information`, { source, data });
      return response.data;
    } catch (error) {
      console.error(`Error updating information for person ${personId}:`, error.message);
      throw error;
    }
  }

  async createPerson(data) {
    try {
      const response = await this.axiosInstance.post('/api/persons', data);
      return response.data;
    } catch (error) {
      console.error('Error creating person:', error.message);
      throw error;
    }
  }

  async crossSearchPersons(type, value) {
    try {
      const response = await this.axiosInstance.get('/api/persons/cross-search', {
        params: { type, value }
      });
      return response.data;
    } catch (error) {
      console.error('Error cross-searching persons:', error.message);
      throw error;
    }
  }

  async crossSearchByPerson(personId) {
    try {
      const response = await this.axiosInstance.get(`/api/persons/${personId}/cross-search`);
      return response.data;
    } catch (error) {
      console.error(`Error cross-searching by person ${personId}:`, error.message);
      throw error;
    }
  }

  async createSighting(data) {
    try {
      const response = await this.axiosInstance.post('/api/sightings', data);
      return response.data;
    } catch (error) {
      console.error('Error creating sighting:', error.message);
      throw error;
    }
  }

  async uploadOsintAsset({ filename, content_type, asset_type, person_id, source, data }) {
    try {
      const response = await this.axiosInstance.post('/api/osint-assets', {
        filename, content_type, asset_type, person_id, source, data
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading OSINT asset:', error.message);
      throw error;
    }
  }

  async getOsintAsset(filename) {
    try {
      const response = await this.axiosInstance.get(`/api/osint-assets/by-filename/${encodeURIComponent(filename)}`, {
        responseType: 'arraybuffer'
      });
      return {
        data: Buffer.from(response.data),
        content_type: response.headers['content-type']
      };
    } catch (error) {
      console.error(`Error fetching OSINT asset ${filename}:`, error.message);
      throw error;
    }
  }

  feedFrameAccumulator(base64) {
    const frameUrl = `${this.workerUrl}/api/streams/${this.streamId}/frame`;
    console.log('[reidService] REID_WORKER_FRAME imgLen=' + base64.length + ' -> ' + frameUrl);
    axios.post(frameUrl, {
      frame: base64
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    }).then((res) => {
      console.log('[reidService] REID_WORKER_FRAME_RESP status=' + res.status + ' frame_count=' + (res.data?.frame_count ?? '?'));
    }).catch((error) => {
      console.error('[reidService] REID_WORKER_FRAME error: ' + error.message);
    });
  }

  async searchByPhoto(imageBuffer, threshold = 0.7, limit = 10) {
    try {
      const base64 = imageBuffer.toString('base64');
      this.feedFrameAccumulator(base64);
      console.log('[reidService] REID_WORKER_REQ imgLen=' + base64.length + ' -> ' + this.workerUrl + '/api/identify');
      const response = await axios.post(`${this.workerUrl}/api/identify`, {
        image: base64
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 600000
      });

      console.log('[reidService] REID_WORKER_RESP status=' + response.status + ' persons=' + (response.data?.persons?.length || (response.data?.person ? 1 : 0)));
      const { person, match } = response.data;
      const displayName = extractBestName(person);
      return {
        persons: [{
          id: person.id || person._id,
          display_name: displayName || null,
          similarity: match.similarity,
          is_new: match.is_new
        }]
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return { persons: [] };
      }
      console.error('Error searching by photo:', error.message);
      throw error;
    }
  }
}

module.exports = new ReidService();
