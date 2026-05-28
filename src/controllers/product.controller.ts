import { Request, Response } from "express";
import { P } from "../libs/types/common";
import { ProductInput, ProductUpdateInput } from "../libs/types/product";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import ProductService from "../services/product.service";

const productService = new ProductService();
const productController: P = {};

productController.getProducts = async (req: Request, res: Response) => {
  try {
    logger.info("Product controller [getProducts]");
    const inquiry = req.query as any;
    const { list, total } = await productService.getProducts(inquiry);
    res
      .status(HttpCode.OK)
      .json(ok(list, { total, page: inquiry.page, limit: inquiry.limit }));
  } catch (error) {
    logger.error("Product controller [getProducts] failed", error);
    catchHttp(res, error);
  }
};

productController.getProduct = async (req: Request, res: Response) => {
  try {
    logger.info("Product controller [getProduct]");
    const product = await productService.getProduct(String(req.params.id));
    res.status(HttpCode.OK).json(ok({ product }));
  } catch (error) {
    logger.error("Product controller [getProduct] failed", error);
    catchHttp(res, error);
  }
};

productController.createProduct = async (req: Request, res: Response) => {
  try {
    logger.info("Product controller [createProduct]");
    const input: ProductInput = req.body;
    const product = await productService.createProduct(input);
    res.status(HttpCode.CREATED).json(ok({ product }));
  } catch (error) {
    logger.error("Product controller [createProduct] failed", error);
    catchHttp(res, error);
  }
};

productController.updateProduct = async (req: Request, res: Response) => {
  try {
    logger.info("Product controller [updateProduct]");
    const input: ProductUpdateInput = req.body;
    const product = await productService.updateProduct(String(req.params.id), input);
    res.status(HttpCode.OK).json(ok({ product }));
  } catch (error) {
    logger.error("Product controller [updateProduct] failed", error);
    catchHttp(res, error);
  }
};

productController.deleteProduct = async (req: Request, res: Response) => {
  try {
    logger.info("Product controller [deleteProduct]");
    await productService.deleteProduct(String(req.params.id));
    res.status(HttpCode.OK).json(ok({ deleted: true }));
  } catch (error) {
    logger.error("Product controller [deleteProduct] failed", error);
    catchHttp(res, error);
  }
};

export default productController;
