import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fileUpload from 'express-fileupload';

import errorMiddleware from './middleware/errorMiddleware.js';

const app = express();

app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

import authRoute from './routes/authRoute.js';
import userRoute from './routes/userRoute.js';
import mineRoute from './routes/mineRoute.js';
import materialRoute from './routes/materialRoute.js';
import searchRoute from './routes/searchRoute.js';
import connectionRoute from './routes/connectionRoute.js';
import truckRoute from './routes/truckRoute.js';
import tripRoute from './routes/tripRoute.js';
import requestRoute from './routes/requestRoute.js';
import notificationRoute from './routes/notificationRoute.js';

app.use('/api/v1/auth', authRoute);
app.use('/api/v1/user', userRoute);
app.use('/api/v1/mine', mineRoute);
app.use('/api/v1/material', materialRoute);
app.use('/api/v1/search', searchRoute);
app.use('/api/v1/connection', connectionRoute);
app.use('/api/v1/truck', truckRoute);
app.use('/api/v1/trips', tripRoute);
app.use('/api/v1/requests', requestRoute);
app.use('/api/v1/notifications', notificationRoute);

// Serve static files if in production
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, 'dist')));
//     app.get('*', (req, res) => {
//         res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
//     });
// }

app.use(errorMiddleware);

export default app;