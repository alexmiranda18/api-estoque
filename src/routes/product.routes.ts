import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { auth } from '../middlewares/auth';
import { upload } from '../config/multer';

const productController = new ProductController();
export const productRoutes = Router();

productRoutes.use(auth);

productRoutes.post('/', upload.single('image'), productController.create);
productRoutes.get('/', productController.list);
productRoutes.put('/:id', upload.single('image'), productController.update);
productRoutes.delete('/:id', productController.delete);