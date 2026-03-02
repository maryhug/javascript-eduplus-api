import app from './app.js';
import { connectMongo } from './config/mongodb.js';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectMongo();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
};

startServer();
