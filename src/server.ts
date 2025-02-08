import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/api', routes);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});