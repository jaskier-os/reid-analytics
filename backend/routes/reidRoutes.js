const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getPersons,
  getPerson,
  getPersonSightings,
  getPersonSnapshotSightings,
  getSimilarPersons,
  getAllSightings,
  getPersonTraits,
  searchPersons,
  getCameras,
  getPersonImage,
  getPersonFace3D,
  searchByPhoto,
  updatePerson,
  deletePerson,
  updatePersonInformation,
  crossSearchPersons,
  crossSearchByPerson,
  searchPersonInfo,
  searchPhone,
  batchPhoneLookup,
  createSighting,
  getOsintPhoto,
  getOsintReport
} = require('../controllers/reidController');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Sherlock / OSINT features are disabled by default. Set ENABLE_OSINT=true to
// register the OSINT/sherlock routes; otherwise they are not mounted (404).
const OSINT_ENABLED = String(process.env.ENABLE_OSINT).toLowerCase() === 'true';

if (OSINT_ENABLED) {
  // OSINT assets
  router.get('/osint-photos/:filename', getOsintPhoto);
  router.get('/osint-reports/:filename', getOsintReport);

  // Standalone search routes (phone-number / OSINT lookup)
  router.post('/search-phone', searchPhone);
  router.post('/persons/batch-phone-lookup', batchPhoneLookup);
}

// Persons routes
router.get('/persons', getPersons);
router.get('/persons/search', searchPersons);
router.get('/persons/cross-search', crossSearchPersons);
router.post('/persons/search/photo', upload.single('image'), searchByPhoto);
router.put('/persons/:id', updatePerson);
router.put('/persons/:id/information', updatePersonInformation);
if (OSINT_ENABLED) {
  // Person OSINT/sherlock info lookup
  router.post('/persons/:id/search-info', searchPersonInfo);
}
router.delete('/persons/:id', deletePerson);
router.get('/persons/:id', getPerson);
router.get('/persons/:id/sightings', getPersonSightings);
router.get('/persons/:id/snapshots', getPersonSnapshotSightings);
router.get('/persons/:id/similar', getSimilarPersons);
router.get('/persons/:id/traits', getPersonTraits);
router.get('/persons/:id/image', getPersonImage);
router.get('/persons/:id/face3d', getPersonFace3D);
router.get('/persons/:id/cross-search', crossSearchByPerson);

// Sightings routes
router.get('/sightings', getAllSightings);
router.post('/sightings', createSighting);

// Cameras routes
router.get('/cameras', getCameras);

module.exports = router;
