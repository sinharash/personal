// src/components/DeprecationBanner.tsx
import React from "react";
import { Box, Typography, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import WarningIcon from "@mui/icons-material/Warning";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface DeprecationBannerProps {
  title?: string;
  message?: string;
  buttonText?: string;
  newPagePath: string;
  showIcon?: boolean;
}

export const DeprecationBanner: React.FC<DeprecationBannerProps> = ({
  title = "🚨 IMPORTANT: This Page is Being Deprecated 🚨",
  message = "We've launched a brand new, improved experience! This page will be retired soon. Please switch to the new Create MERNA Resources interface for better features, improved performance, and enhanced functionality.",
  buttonText = "Switch to New Page Now",
  newPagePath,
  showIcon = true,
}) => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        background:
          "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFA500 100%)",
        color: "white",
        p: 4,
        borderRadius: 3,
        mb: 4,
        mx: 3,
        boxShadow: "0 8px 32px rgba(255, 107, 107, 0.4)",
        border: "3px solid #fff",
        position: "relative",
        overflow: "hidden",
        animation: "pulse 2s ease-in-out infinite",
        "@keyframes pulse": {
          "0%, 100%": {
            boxShadow: "0 8px 32px rgba(255, 107, 107, 0.4)",
          },
          "50%": {
            boxShadow: "0 8px 48px rgba(255, 107, 107, 0.6)",
          },
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "-100%",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
          animation: "shimmer 3s infinite",
        },
        "@keyframes shimmer": {
          "0%": { left: "-100%" },
          "100%": { left: "100%" },
        },
      }}
    >
      <Stack spacing={3} alignItems="center">
        {/* Warning Icon with Animation */}
        {showIcon && (
          <Box
            sx={{
              animation: "bounce 1s ease-in-out infinite",
              "@keyframes bounce": {
                "0%, 100%": { transform: "translateY(0)" },
                "50%": { transform: "translateY(-10px)" },
              },
            }}
          >
            <WarningIcon
              sx={{
                fontSize: "4rem",
                filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
              }}
            />
          </Box>
        )}

        {/* Main Heading */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 900,
            textAlign: "center",
            textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
            letterSpacing: "1px",
          }}
        >
          {title}
        </Typography>

        {/* Description */}
        <Typography
          variant="h6"
          sx={{
            textAlign: "center",
            maxWidth: "700px",
            lineHeight: 1.6,
            textShadow: "1px 1px 2px rgba(0,0,0,0.2)",
            fontWeight: 500,
          }}
        >
          {message}
        </Typography>

        {/* Call-to-Action Button */}
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate(newPagePath)}
          sx={{
            mt: 2,
            backgroundColor: "white",
            color: "#FF6B6B",
            fontSize: "1.1rem",
            fontWeight: "bold",
            py: 2,
            px: 4,
            borderRadius: 2,
            textTransform: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            transition: "all 0.3s ease",
            "&:hover": {
              backgroundColor: "#f0f0f0",
              transform: "translateY(-2px) scale(1.05)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
            },
            animation: "buttonPulse 2s ease-in-out infinite",
            "@keyframes buttonPulse": {
              "0%, 100%": {
                transform: "scale(1)",
              },
              "50%": {
                transform: "scale(1.05)",
              },
            },
          }}
        >
          {buttonText}
        </Button>

        {/* Additional Info */}
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            opacity: 0.95,
            fontStyle: "italic",
          }}
        >
          Don't worry - all your data and configurations are safe and will be
          available in the new interface
        </Typography>
      </Stack>
    </Box>
  );
};


>>>>>>>>>
softer pastel ViewTransition


// Softer pastel version
export const DeprecationBanner: React.FC<DeprecationBannerProps> = ({
  title = "This Page is Moving to a New Location",
  message = "We've launched an improved experience! This page will be deprecated soon. Please use the new Create MERNA Resources interface for enhanced features and better performance.",
  buttonText = "Go to New Page",
  newPagePath,
  showIcon = true,
}) => {
  const navigate = useNavigate();

  return (
    <Paper
      elevation={2}
      sx={{
        background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
        borderLeft: '5px solid #5e35b1',
        p: 3,
        borderRadius: 2,
        mb: 3,
        mx: 3,
        position: 'relative',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(94, 53, 177, 0.15)',
        },
      }}
    >
      <Stack direction="row" spacing={3} alignItems="center">
        {/* Icon */}
        {showIcon && (
          <Box
            sx={{
              backgroundColor: '#5e35b1',
              color: 'white',
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: '2rem' }} />
          </Box>
        )}

        {/* Content */}
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: '#5e35b1'
            }}
          >
            {title}
          </Typography>

          <Typography 
            variant="body2" 
            sx={{ 
              color: '#424242',
              lineHeight: 1.6
            }}
          >
            {message}
          </Typography>
        </Stack>

        {/* Button */}
        <Button 
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate(newPagePath)}
          sx={{
            backgroundColor: '#5e35b1',
            color: 'white',
            py: 1.2,
            px: 3,
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            flexShrink: 0,
            '&:hover': {
              backgroundColor: '#4527a0',
              transform: 'translateX(4px)',
            },
          }}
        >
          {buttonText}
        </Button>
      </Stack>
    </Paper>
  );
};

// more backstage animation purple color 

// src/components/DeprecationBanner.tsx
import React from 'react';
import { Box, Typography, Button, Stack, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface DeprecationBannerProps {
  title?: string;
  message?: string;
  buttonText?: string;
  newPagePath: string;
  showIcon?: boolean;
}

export const DeprecationBanner: React.FC<DeprecationBannerProps> = ({
  title = "This Page is Moving to a New Location",
  message = "We've launched an improved experience! This page will be deprecated soon. Please use the new Create MERNA Resources interface for enhanced features and better performance.",
  buttonText = "Go to New Page",
  newPagePath,
  showIcon = true,
}) => {
  const navigate = useNavigate();

  return (
    <Paper
      elevation={3}
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        p: 3.5,
        borderRadius: 2,
        mb: 3,
        mx: 3,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 40px rgba(102, 126, 234, 0.3)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
          animation: 'shimmer 4s infinite',
        },
        '@keyframes shimmer': {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
      }}
    >
      <Stack direction="row" spacing={3} alignItems="center">
        {/* Icon on the left */}
        {showIcon && (
          <Box
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: '2.5rem' }} />
          </Box>
        )}

        {/* Content in the middle */}
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              letterSpacing: '0.5px'
            }}
          >
            {title}
          </Typography>

          <Typography 
            variant="body1" 
            sx={{ 
              lineHeight: 1.6,
              opacity: 0.95,
              fontWeight: 400
            }}
          >
            {message}
          </Typography>
        </Stack>

        {/* Button on the right */}
        <Button 
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate(newPagePath)}
          sx={{
            backgroundColor: 'white',
            color: '#667eea',
            fontSize: '0.95rem',
            fontWeight: 600,
            py: 1.5,
            px: 3,
            borderRadius: 1.5,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            flexShrink: 0,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f8f9fa',
              transform: 'translateX(4px)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            },
          }}
        >
          {buttonText}
        </Button>
      </Stack>
    </Paper>
  );
};

>>>>>>>>>>>
// very first bold design but button on right side :

// src/components/DeprecationBanner.tsx
import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface DeprecationBannerProps {
  title?: string;
  message?: string;
  buttonText?: string;
  newPagePath: string;
  showIcon?: boolean;
}

export const DeprecationBanner: React.FC<DeprecationBannerProps> = ({
  title = "🚨 IMPORTANT: This Page is Being Deprecated 🚨",
  message = "We've launched a brand new, improved experience! This page will be retired soon. Please switch to the new Create MERNA Resources interface for better features, improved performance, and enhanced functionality.",
  buttonText = "Switch to New Page Now",
  newPagePath,
  showIcon = true,
}) => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFA500 100%)',
        color: 'white',
        p: 3.5,
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
      <Stack direction="row" spacing={3} alignItems="center">
        {/* Warning Icon on the left */}
        {showIcon && (
          <Box
            sx={{
              animation: 'bounce 1s ease-in-out infinite',
              '@keyframes bounce': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-10px)' },
              },
              flexShrink: 0,
            }}
          >
            <WarningIcon sx={{ fontSize: '3.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
          </Box>
        )}

        {/* Content in the middle */}
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 900,
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              letterSpacing: '0.5px'
            }}
          >
            {title}
          </Typography>

          <Typography 
            variant="body1" 
            sx={{ 
              lineHeight: 1.6,
              textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
              fontWeight: 400
            }}
          >
            {message}
          </Typography>
        </Stack>

        {/* Button on the right */}
        <Button 
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate(newPagePath)}
          sx={{
            backgroundColor: 'white',
            color: '#FF6B6B',
            fontSize: '1rem',
            fontWeight: 'bold',
            py: 2,
            px: 4,
            borderRadius: 2,
            textTransform: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            flexShrink: 0,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f0f0f0',
              transform: 'translateX(4px) scale(1.05)',
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
          {buttonText}
        </Button>
      </Stack>
    </Box>
  );
};

// same above just change this 
// Option 1: Blue/Teal (Works well with dark theme)

// Change just the background and border colors:
sx={{
  background: 'linear-gradient(135deg, #3a7bd5 0%, #00d2ff 100%)',
  // ... rest stays the same
  boxShadow: '0 8px 32px rgba(58, 123, 213, 0.4)',
  border: '3px solid rgba(255, 255, 255, 0.3)',
  '@keyframes pulse': {
    '0%, 100%': {
      boxShadow: '0 8px 32px rgba(58, 123, 213, 0.4)',
    },
    '50%': {
      boxShadow: '0 8px 48px rgba(58, 123, 213, 0.6)',
    },
  },
}}

// Button color:
sx={{
  // ...
  color: '#3a7bd5',
}}

// option 2 for 
//Option 2: Purple/Pink (Matches Backstage theme better)


// Change colors to match the "tooling" card aesthetic:
sx={{
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  // ... rest stays the same
  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
  border: '3px solid rgba(255, 255, 255, 0.3)',
  '@keyframes pulse': {
    '0%, 100%': {
      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
    },
    '50%': {
      boxShadow: '0 8px 48px rgba(102, 126, 234, 0.6)',
    },
  },
}}

// Button color:
sx={{
  // ...
  color: '#667eea',
}}

// option 3
//Option 3: Amber/Gold (Matches the tan/beige tooling card)

// More subtle, matches the tooling card color you mentioned:
sx={{
  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  // ... rest stays the same
  boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4)',
  border: '3px solid rgba(255, 255, 255, 0.3)',
  '@keyframes pulse': {
    '0%, 100%': {
      boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4)',
    },
    '50%': {
      boxShadow: '0 8px 48px rgba(245, 158, 11, 0.6)',
    },
  },
}}

// Button color:
sx={{
  // ...
  color: '#f59e0b',
}}