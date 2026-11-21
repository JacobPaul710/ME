// Firebase project "ME" (these values are meant to be public; security comes from firestore.rules).
export const FIREBASE = {
  apiKey: 'AIzaSyDd4O8cvXkhmOCGIATYtqnTd6ENDnA-Tlw',
  projectId: 'me-app-f71c1',
};

export const ENDPOINTS = {
  auth: 'https://identitytoolkit.googleapis.com/v1',
  token: 'https://securetoken.googleapis.com/v1',
  firestore: 'https://firestore.googleapis.com/v1',
};

// USDA FoodData Central (branded and restaurant foods). DEMO_KEY works but is limited to about
// 30 searches an hour; a free personal key from https://api.data.gov/signup/ allows 1,000 an hour.
export const FDC = { url: 'https://api.nal.usda.gov/fdc/v1', key: 'DEMO_KEY' };

export const APP_VERSION = '3.84.0';
