import { createTheme, Theme, ThemeOptions } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Color palette
const colors = {
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3',
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
  },
  secondary: {
    50: '#fce4ec',
    100: '#f8bbd9',
    200: '#f48fb1',
    300: '#f06292',
    400: '#ec407a',
    500: '#e91e63',
    600: '#d81b60',
    700: '#c2185b',
    800: '#ad1457',
    900: '#880e4f',
  },
  success: {
    50: '#e8f5e8',
    100: '#c8e6c9',
    200: '#a5d6a7',
    300: '#81c784',
    400: '#66bb6a',
    500: '#4caf50',
    600: '#43a047',
    700: '#388e3c',
    800: '#2e7d32',
    900: '#1b5e20',
  },
  warning: {
    50: '#fff8e1',
    100: '#ffecb3',
    200: '#ffe082',
    300: '#ffd54f',
    400: '#ffca28',
    500: '#ffc107',
    600: '#ffb300',
    700: '#ffa000',
    800: '#ff8f00',
    900: '#ff6f00',
  },
  error: {
    50: '#ffebee',
    100: '#ffcdd2',
    200: '#ef9a9a',
    300: '#e57373',
    400: '#ef5350',
    500: '#f44336',
    600: '#e53935',
    700: '#d32f2f',
    800: '#c62828',
    900: '#b71c1c',
  },
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
};

// Typography configuration
const typography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
  ].join(','),
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.43,
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'none' as const,
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.66,
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08333em',
  },
};

// Component overrides
const getComponentOverrides = (mode: PaletteMode) => ({
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        scrollbarColor: mode === 'dark' ? '#6b6b6b #2b2b2b' : '#959595 #f5f5f5',
        '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
          backgroundColor: mode === 'dark' ? '#2b2b2b' : '#f5f5f5',
          width: 8,
          height: 8,
        },
        '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
          borderRadius: 8,
          backgroundColor: mode === 'dark' ? '#6b6b6b' : '#959595',
          minHeight: 24,
          border: mode === 'dark' ? '2px solid #2b2b2b' : '2px solid #f5f5f5',
        },
        '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
          backgroundColor: mode === 'dark' ? '#959595' : '#6b6b6b',
        },
        '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
          backgroundColor: mode === 'dark' ? '#959595' : '#6b6b6b',
        },
        '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
          backgroundColor: mode === 'dark' ? '#959595' : '#6b6b6b',
        },
        '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
          backgroundColor: mode === 'dark' ? '#2b2b2b' : '#f5f5f5',
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: mode === 'dark' 
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        transition: 'box-shadow 0.3s ease-in-out, transform 0.2s ease-in-out',
        '&:hover': {
          boxShadow: mode === 'dark'
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
            : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          transform: 'translateY(-1px)',
        },
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 600,
        padding: '8px 16px',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
        },
      },
      contained: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
      elevation1: {
        boxShadow: mode === 'dark'
          ? '0 1px 3px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: 'none',
        borderBottom: `1px solid ${mode === 'dark' ? colors.grey[800] : colors.grey[200]}`,
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: `1px solid ${mode === 'dark' ? colors.grey[800] : colors.grey[200]}`,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
        },
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
});

// Create theme function
export const createAppTheme = (mode: PaletteMode): Theme => {
  const isDark = mode === 'dark';
  
  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: colors.primary[600],
        light: colors.primary[400],
        dark: colors.primary[800],
        contrastText: '#ffffff',
      },
      secondary: {
        main: colors.secondary[600],
        light: colors.secondary[400],
        dark: colors.secondary[800],
        contrastText: '#ffffff',
      },
      success: {
        main: colors.success[600],
        light: colors.success[400],
        dark: colors.success[800],
      },
      warning: {
        main: colors.warning[600],
        light: colors.warning[400],
        dark: colors.warning[800],
      },
      error: {
        main: colors.error[600],
        light: colors.error[400],
        dark: colors.error[800],
      },
      background: {
        default: isDark ? '#0a0a0a' : '#fafafa',
        paper: isDark ? '#1a1a1a' : '#ffffff',
      },
      text: {
        primary: isDark ? colors.grey[100] : colors.grey[900],
        secondary: isDark ? colors.grey[400] : colors.grey[600],
      },
      divider: isDark ? colors.grey[800] : colors.grey[200],
    },
    typography,
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
    components: getComponentOverrides(mode),
  };

  return createTheme(themeOptions);
};

// Default themes
export const lightTheme = createAppTheme('light');
export const darkTheme = createAppTheme('dark');

export default createAppTheme;
