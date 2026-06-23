import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { corsOptions } from "./config/cors.js";
import { apiRateLimiter } from "./middlewares/rateLimit.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import routes from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRateLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
