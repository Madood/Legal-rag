export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const TOKEN_COSTS = {
  standard: 1,
  crossStatute: 2,
  doctrineHigh: 2,
  aiFallback: 3,
  clarification: 0,
} as const;

export const SUPPORTED_STATUTES = ['BGB', 'STGB', 'HGB', 'GG', 'EU-GDPR'] as const;
