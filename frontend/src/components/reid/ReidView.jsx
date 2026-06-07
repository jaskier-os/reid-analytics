import React, { useState } from 'react';
import { Box } from '@mui/material';
import PersonCatalogue from './PersonCatalogue';
import PersonDetail from './PersonDetail';

const ReidView = () => {
  const [selectedPerson, setSelectedPerson] = useState(null);

  const handlePersonClick = (person) => {
    setSelectedPerson(person);
  };

  const handleCloseDetail = () => {
    setSelectedPerson(null);
  };

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      <PersonCatalogue onPersonClick={handlePersonClick} />

      {selectedPerson && (
        <PersonDetail
          person={selectedPerson}
          onClose={handleCloseDetail}
          onPersonClick={handlePersonClick}
        />
      )}
    </Box>
  );
};

export default ReidView;
