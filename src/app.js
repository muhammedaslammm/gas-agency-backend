import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import authRouter from "./routers/auth.routes.js";
import productRouter from "./routers/product.routes.js";
import supplierRouter from "./routers/supplier.routes.js";
import stockPurchaseRouter from "./routers/stockPurchase.router.js";
import routeRouter from "./routers/route.routes.js";
import customerRouter from "./routers/customer.routes.js";
import saleRouter from "./routers/sale.routes.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParser());

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Request Delivered!" });
});

app.use("/api", authRouter);
app.use("/api", productRouter);
app.use("/api", supplierRouter);
app.use("/api", stockPurchaseRouter);
app.use("/api", routeRouter);
app.use("/api", customerRouter);
app.use("/api", saleRouter);

app.use(errorHandler);

export default app;
