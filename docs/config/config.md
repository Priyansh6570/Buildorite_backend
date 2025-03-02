# Configuration Documentation

## database.js

The `database.js` file is responsible for connecting to the MongoDB database using Mongoose. It exports an asynchronous function `connectDB` that attempts to establish a connection to the database using the connection string provided in the environment variable `DB_URL`.

### Example

```javascript
import mongoose from 'mongoose';
mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DB_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
```

## .env

The `.env` file contains environment variables that are used to configure the application. Below are the variables used:

- `NODE_ENV`: Specifies the environment in which the application is running (e.g., development, production).
- `PORT`: The port number on which the server will run.
- `DB_URL`: The connection string for the MongoDB database.
- `CLOUDINARY_CLOUD_NAME`: The Cloudinary cloud name for image storage.
- `CLOUDINARY_API_KEY`: The Cloudinary API key.
- `CLOUDINARY_API_SECRET`: The Cloudinary API secret.
- `JWT_SECRET`: The secret key used for signing JSON Web Tokens (JWT).
- `JWT_EXPIRE_TIME`: The expiration time for JWT tokens.

### Example

```properties
NODE_ENV="development"
PORT=3000
DB_URL="your_mongodb_connection_string"
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
JWT_SECRET="your_jwt_secret"
JWT_EXPIRE_TIME="30d"
```
