// Add these imports at the top (around lines 1-20)
import { Box, Typography, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Then add this banner right after line 131 (in your return statement)

function MernaRouteContent() {
  const navigate = useNavigate();
  
  // ... your existing code ...

  return (
    <>
      {/* SUPER EYE-CATCHING DEPRECATION BANNER */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFA500 100%)',
          color: 'white',
          p: 4,
          borderRadius: 3,
          mb: 4,
          mx: 3,
          boxShadow: '0 8px 32px rgba(255, 107, 107, 0.4)',
          border: '3px solid #fff',
          position: 'relative',
          overflow: 'hidden',
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': {
              boxShadow: '0 8px 32px rgba(255, 107, 107, 0.4)',
            },
            '50%': {
              boxShadow: '0 8px 48px rgba(255, 107, 107, 0.6)',
            },
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'shimmer 3s infinite',
          },
          '@keyframes shimmer': {
            '0%': { left: '-100%' },
            '100%': { left: '100%' },
          },
        }}
      >
        <Stack spacing={3} alignItems="center">
          {/* Warning Icon with Animation */}
          <Box
            sx={{
              animation: 'bounce 1s ease-in-out infinite',
              '@keyframes bounce': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-10px)' },
              },
            }}
          >
            <WarningIcon sx={{ fontSize: '4rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
          </Box>

          {/* Main Heading */}
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 900,
              textAlign: 'center',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              letterSpacing: '1px'
            }}
          >
            🚨 IMPORTANT: This Page is Being Deprecated 🚨
          </Typography>

          {/* Description */}
          <Typography 
            variant="h6" 
            sx={{ 
              textAlign: 'center',
              maxWidth: '700px',
              lineHeight: 1.6,
              textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
              fontWeight: 500
            }}
          >
            We've launched a <strong>brand new, improved experience</strong>! 
            This page will be retired soon. Please switch to the new 
            <strong> Create MERNA Resources</strong> interface for better features, 
            improved performance, and enhanced functionality.
          </Typography>

          {/* Call-to-Action Button */}
          <Button 
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/create/tasks/cloud-experience/merna/messaging')}
            sx={{
              mt: 2,
              backgroundColor: 'white',
              color: '#FF6B6B',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              py: 2,
              px: 4,
              borderRadius: 2,
              textTransform: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#f0f0f0',
                transform: 'translateY(-2px) scale(1.05)',
                boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
              },
              animation: 'buttonPulse 2s ease-in-out infinite',
              '@keyframes buttonPulse': {
                '0%, 100%': {
                  transform: 'scale(1)',
                },
                '50%': {
                  transform: 'scale(1.05)',
                },
              },
            }}
          >
            Switch to New Page Now
          </Button>

          {/* Additional Info */}
          <Typography 
            variant="body2" 
            sx={{ 
              textAlign: 'center',
              opacity: 0.95,
              fontStyle: 'italic'
            }}
          >
            Don't worry - all your data and configurations are safe and will be available in the new interface
          </Typography>
        </Stack>
      </Box>

      {/* Your existing content below */}
      <Stack direction="row" spacing={6} alignItems="center" mx={5} justifyContent="space-between">
        {/* ... rest of your code ... */}