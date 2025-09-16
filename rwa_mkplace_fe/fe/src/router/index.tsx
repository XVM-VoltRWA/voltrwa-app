import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Home from '../pages/Home';
import Marketplace from '../pages/Marketplace';
import MyAssets from '../pages/MyAssets';
import CreateAsset from '../pages/CreateAsset';
import NotFound from '../pages/NotFound';

// Define route paths as constants to avoid typos
export const ROUTES = {
  HOME: '/',
  MARKETPLACE: '/marketplace',
  MY_ASSETS: '/my-assets',
  CREATE_ASSET: '/create',
  // Add more routes as needed
  ASSET_DETAIL: '/asset/:id',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const;

// Create and export the router
export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <MainLayout />,
    errorElement: <NotFound />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: ROUTES.MARKETPLACE,
        element: <Marketplace />,
      },
      {
        path: ROUTES.MY_ASSETS,
        element: <MyAssets />,
      },
      {
        path: ROUTES.CREATE_ASSET,
        element: <CreateAsset />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

// Type-safe route helper functions
export const getAssetDetailPath = (id: string) => `/asset/${id}`;
export const getProfilePath = (address?: string) => address ? `/profile/${address}` : '/profile';