// src/features/business-app/components/enable-merna.tsx

import React from "react";
import { Button, Tooltip, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useEntity } from "@backstage/plugin-catalog-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { currentUserOptions } from "../../../features/user/api/use-get-user-entity-options";

export const EnableMerna: React.FC = () => {
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { data: currentUser } = useSuspenseQuery(currentUserOptions());

  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Extract SOLMA ID from entity
  const solmaId = entity.metadata?.annotations?.["solma-id"];

  // Check if user is authorized (in contact list)
  React.useEffect(() => {
    const checkAuthorization = () => {
      try {
        if (!currentUser) {
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Get current user reference
        const userRef = currentUser.metadata?.name || "";
        const userEmail = currentUser.spec?.profile?.email || "";

        // Build list of authorized user refs from spec
        const authorizedUsers: string[] = [];

        // Check spec fields for contact roles
        const contactFields = [
          "technicalOwner",
          "technicalManager",
          "businessOwner",
          "businessManager",
          "technicalOwnerBackup",
          "technicalManagerBackup",
          "businessOwnerBackup",
          "businessManagerBackup",
          "technicalDirector",
          "businessDirector",
        ];

        contactFields.forEach((field) => {
          const value = entity.spec?.[field];
          if (value) {
            authorizedUsers.push(value as string);
          }
        });

        // Check relations array for contact relationships
        const relations = entity.relations || [];
        const contactRelationTypes = [
          "Technical Owner",
          "Technical Manager",
          "Business Owner",
          "Business Manager",
          "Backup Technical Owner",
          "Backup Technical Manager",
          "Backup Business Owner",
          "Backup Business Manager",
        ];

        relations.forEach((relation) => {
          if (contactRelationTypes.includes(relation.type)) {
            authorizedUsers.push(relation.targetRef);
          }
        });

        // Check if current user is in the authorized list
        const authorized = authorizedUsers.some((authUser) => {
          // Match by user ref (e.g., "user:default/jacob.parra.f28t")
          if (authUser.includes(userRef)) {
            return true;
          }
          // Match by email (e.g., "user:default/jacob.parra.f28t_statefarm.com")
          if (authUser.includes(userEmail.replace("@", "."))) {
            return true;
          }
          return false;
        });

        setIsAuthorized(authorized);
      } catch (error) {
        console.error("Authorization check failed:", error);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthorization();
  }, [entity, currentUser]);

  // Handle Enable MERNA click
  const handleEnableMerna = () => {
    // Build the template URL
    const templateUrl = "/create/templates/default/merna-workspace-create";

    // Pre-fill SOLMA field via query parameter
    const params = new URLSearchParams({
      "formData.solma": solmaId || "",
    });

    // Navigate to the workspace creation template
    navigate(`${templateUrl}?${params.toString()}`);
  };

  // Show loading state
  if (isLoading) {
    return (
      <Button
        variant="contained"
        color="primary"
        disabled
        startIcon={<CircularProgress size={16} />}
      >
        Loading...
      </Button>
    );
  }

  // Don't render button if user is not authorized
  if (!isAuthorized) {
    return null;
  }

  // Render button with tooltip if no SOLMA ID
  if (!solmaId) {
    return (
      <Tooltip title="SOLMA ID is required to enable MERNA">
        <span>
          <Button variant="contained" color="primary" disabled>
            Enable MERNA
          </Button>
        </span>
      </Tooltip>
    );
  }

  // Render enabled button
  return (
    <Button variant="contained" color="primary" onClick={handleEnableMerna}>
      Enable MERNA
    </Button>
  );
};


>>>>>>>>
//in testing module

// src/features/business-app/components/enable-merna.tsx

import React from 'react';
import { Button, Tooltip, CircularProgress, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useGetUserEntityOptions } from '../../../features/user/api/use-get-user-entity-options';

// Set this to true for testing - it will show the button even if not authorized
const TESTING_MODE = true;

export const EnableMerna: React.FC = () => {
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { data: currentUser } = useSuspenseQuery(useGetUserEntityOptions({ ref: true }));
  
  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [authDebugInfo, setAuthDebugInfo] = React.useState<string>('');
  
  // Extract SOLMA ID from entity
  const solmaId = entity.metadata?.annotations?.['solma-id'];
  
  // Check if user is authorized (in contact list)
  React.useEffect(() => {
    const checkAuthorization = () => {
      try {
        if (!currentUser) {
          setIsAuthorized(false);
          setAuthDebugInfo('No current user found');
          setIsLoading(false);
          return;
        }
        
        // Get current user reference
        const userRef = currentUser.metadata?.name || '';
        const userEmail = currentUser.spec?.profile?.email || '';
        const currentUserRef = `user:default/${userRef}`;
        
        console.log('Current User:', { userRef, userEmail, currentUserRef });
        
        // Build list of authorized user refs from spec
        const authorizedUsers: string[] = [];
        
        // Check spec fields for contact roles
        const contactFields = [
          'technicalOwner',
          'technicalManager',
          'businessOwner',
          'businessManager',
          'technicalOwnerBackup',
          'technicalManagerBackup',
          'businessOwnerBackup',
          'businessManagerBackup',
          'technicalDirector',
          'businessDirector'
        ];
        
        contactFields.forEach(field => {
          const value = entity.spec?.[field];
          if (value) {
            authorizedUsers.push(value as string);
          }
        });
        
        // Check relations array for contact relationships
        const relations = entity.relations || [];
        const contactRelationTypes = [
          'Technical Owner',
          'Technical Manager',
          'Business Owner',
          'Business Manager',
          'Backup Technical Owner',
          'Backup Technical Manager',
          'Backup Business Owner',
          'Backup Business Manager',
          'Technical Owner Of',
          'Technical Manager Of',
          'Business Owner Of',
          'Business Manager Of'
        ];
        
        relations.forEach(relation => {
          if (contactRelationTypes.includes(relation.type)) {
            authorizedUsers.push(relation.targetRef);
          }
        });
        
        console.log('Authorized Users:', authorizedUsers);
        
        // Check if current user is in the authorized list
        const authorized = authorizedUsers.some(authUser => {
          const normalizedAuthUser = authUser.toLowerCase();
          const normalizedUserRef = currentUserRef.toLowerCase();
          const normalizedUserName = userRef.toLowerCase();
          const normalizedEmail = userEmail.toLowerCase().replace('@', '.');
          
          // Match by full user ref
          if (normalizedAuthUser === normalizedUserRef) {
            return true;
          }
          // Match by username
          if (normalizedAuthUser.includes(normalizedUserName)) {
            return true;
          }
          // Match by email
          if (normalizedAuthUser.includes(normalizedEmail)) {
            return true;
          }
          return false;
        });
        
        setIsAuthorized(authorized);
        setAuthDebugInfo(
          authorized 
            ? `Authorized: ${currentUserRef}` 
            : `Not authorized: ${currentUserRef} not in contact list`
        );
        
        console.log('Authorization Result:', authorized);
      } catch (error) {
        console.error('Authorization check failed:', error);
        setIsAuthorized(false);
        setAuthDebugInfo(`Error: ${error}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthorization();
  }, [entity, currentUser]);
  
  // Handle Enable MERNA click
  const handleEnableMerna = () => {
    // Build the template URL
    const templateUrl = '/create/templates/default/merna-workspace-create';
    
    // Pre-fill SOLMA field via query parameter
    const params = new URLSearchParams({
      'formData.solma': solmaId || '',
    });
    
    console.log('Navigating to:', `${templateUrl}?${params.toString()}`);
    
    // Navigate to the workspace creation template
    navigate(`${templateUrl}?${params.toString()}`);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <Button
        variant="contained"
        color="primary"
        disabled
        startIcon={<CircularProgress size={16} />}
      >
        Checking Authorization...
      </Button>
    );
  }
  
  // In testing mode, always show the button (disabled if not authorized)
  // In production mode, hide button if not authorized
  if (!isAuthorized && !TESTING_MODE) {
    return null;
  }
  
  // Render button with tooltip if no SOLMA ID
  if (!solmaId) {
    return (
      <Box>
        <Tooltip title="SOLMA ID is required to enable MERNA">
          <span>
            <Button
              variant="contained"
              color="primary"
              disabled
            >
              Enable MERNA
            </Button>
          </span>
        </Tooltip>
        {TESTING_MODE && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            Testing Mode: Missing SOLMA ID
          </Typography>
        )}
      </Box>
    );
  }
  
  // Render button (enabled only if authorized)
  return (
    <Box>
      <Tooltip title={isAuthorized ? 'Click to create MERNA workspace' : authDebugInfo}>
        <span>
          <Button
            variant="contained"
            color="primary"
            onClick={handleEnableMerna}
            disabled={!isAuthorized}
          >
            Enable MERNA
          </Button>
        </span>
      </Tooltip>
      {TESTING_MODE && (
        <Typography 
          variant="caption" 
          color={isAuthorized ? 'success.main' : 'warning.main'} 
          sx={{ display: 'block', mt: 1 }}
        >
          Testing Mode: {authDebugInfo}
        </Typography>
      )}
    </Box>
  );
};