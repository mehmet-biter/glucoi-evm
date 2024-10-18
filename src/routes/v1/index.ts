import express from 'express';
import authRoute from './auth.route';
import evmRoute from './wallet.route';
import testRoute from './test.route';


const router = express.Router();

const defaultRoutes = [
  {
    path: "/auth",
    route: authRoute,
  },
  {
    path: "/evm",
    route: evmRoute,
  },
  {
    path: "/test",
    route: testRoute,
  },
];



defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */


export default router;
