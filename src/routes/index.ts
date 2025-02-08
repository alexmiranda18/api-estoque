import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { categoryRoutes } from './category.routes';
import { productRoutes } from './product.routes';
import { stockRoutes } from './stock.routes';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/categories', categoryRoutes);
routes.use('/products', productRoutes);
routes.use('/stock', stockRoutes);