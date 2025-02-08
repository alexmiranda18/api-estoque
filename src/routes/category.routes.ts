import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { auth } from '../middlewares/auth';

const categoryController = new CategoryController();
export const categoryRoutes = Router();

categoryRoutes.use(auth);

categoryRoutes.post('/', categoryController.create);
categoryRoutes.get('/', categoryController.list);
categoryRoutes.put('/:id', categoryController.update);
categoryRoutes.delete('/:id', categoryController.delete);