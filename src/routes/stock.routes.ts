import { Router } from 'express';
import { StockController } from '../controllers/stock.controller';
import { auth } from '../middlewares/auth';

const stockController = new StockController();
export const stockRoutes = Router();

stockRoutes.use(auth);

stockRoutes.post('/movements', stockController.createMovement);
stockRoutes.get('/movements', stockController.listMovements);
stockRoutes.get('/products/:productId', stockController.getProductStock);
stockRoutes.delete('/movements/:id', stockController.deleteMovement);