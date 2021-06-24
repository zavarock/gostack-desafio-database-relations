import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('This customer does not exist!');
    }

    const findProducts = await this.productsRepository.findAllById(products);
    if (products.length !== findProducts.length) {
      throw new AppError('There are invalid products!');
    }

    const soldQuantity = (id: string): number =>
      products.find(product => product.id === id)?.quantity || 1;

    const hasProducWithInsufficientQuantities = findProducts.some(
      findProduct => findProduct.quantity < soldQuantity(findProduct.id),
    );

    if (hasProducWithInsufficientQuantities) {
      throw new AppError(
        'One or more products contain insufficient quantities!',
      );
    }

    const orderProducts = findProducts.map(findProduct => {
      return {
        product_id: findProduct.id,
        price: findProduct.price,
        quantity: soldQuantity(findProduct.id),
      };
    });

    const updatedProducts = findProducts.map(findProduct => {
      const newQuantity = findProduct.quantity - soldQuantity(findProduct.id);

      return {
        id: findProduct.id,
        quantity: newQuantity,
      };
    });

    await this.productsRepository.updateQuantity(updatedProducts);

    return this.ordersRepository.create({
      customer,
      products: orderProducts,
    });
  }
}

export default CreateOrderService;
