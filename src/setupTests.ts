// src/setupTests.ts
// Mock Convex hooks for component testing
jest.mock('convex/react', () => ({
  ...jest.requireActual('convex/react'),
  useQuery: jest.fn(() => undefined),
  useMutation: jest.fn(() => () => Promise.resolve()),
  useAction: jest.fn(() => () => Promise.resolve()),
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
  ConvexReactClient: jest.fn(),
}));

// Mock AsyncStorage if you use it
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        CONVEX_URL: 'https://test-convex-url.com',
      },
    },
  },
}));