import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';

// Defina a interface no início do arquivo ou em um arquivo separado de tipos
interface StockItem {
  current_stock: number;
  min_stock: number;
  product_id: string;
}
interface Movement {
  type: 'IN' | 'OUT';
  quantity: number;
}

interface Product {
  current_stock?: Movement[];
  // outras propriedades do produto
}

export class ProductController {
  async create(req: Request, res: Response) {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      categoryId: z.string().uuid(),
      sku: z.string().min(1),
      price: z.preprocess((val) => Number(val), z.number().min(0).default(0)),
      minStock: z.preprocess(
        (val) => Number(val),
        z.number().int().min(0).default(0),
      ),
      initialStock: z.preprocess(
        (val) => Number(val),
        z.number().int().min(0).default(0),
      ),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const file = req.file;
    const {
      name,
      description,
      categoryId,
      sku,
      price,
      minStock,
      initialStock,
    } = schema.parse(req.body);

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([
        {
          name,
          description,
          category_id: categoryId,
          sku,
          price,
          min_stock: minStock,
          initial_stock: initialStock,
          image_url: file ? `/uploads/${file.filename}` : null,
          created_by: req.user.id,
        },
      ])
      .select()
      .single();

    if (productError) {
      return res.status(500).json({ message: 'Error creating product' });
    }

    if (initialStock > 0) {
      const { error: stockError } = await supabase
        .from('stock_movements')
        .insert([
          {
            product_id: product.id,
            type: 'IN',
            quantity: initialStock,
            notes: 'Initial stock',
            created_by: req.user.id,
          },
        ]);

      if (stockError) {
        return res.status(201).json({
          ...product,
          warning: 'Product created but failed to set initial stock',
        });
      }
    }

    return res.status(201).json({
      ...product,
      currentStock: initialStock,
    });
  }

  async list(req: Request, res: Response) {
    const schema = z.object({
      search: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      sort: z
        .enum(['name', 'sku', 'price', 'created_at'])
        .optional()
        .default('name'),
      order: z.enum(['asc', 'desc']).optional().default('asc'),
      minStock: z.enum(['below', 'above']).optional(),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { search, categoryId, sort, order, minStock } = schema.parse(
      req.query,
    );

    let query = supabase
      .from('products')
      .select(
        `
        *,
        category:categories(name),
        current_stock:stock_movements(
          quantity,
          type
        )
      `,
      )
      .eq('created_by', req.user.id)
      .order(sort, { ascending: order === 'asc' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (minStock === 'below') {
      const { data: stockData } = await supabase.rpc('get_current_stock');
      if (stockData) {
        const belowMinStockProducts = stockData
          .filter((item: StockItem) => item.current_stock < item.min_stock) // Especifica o tipo 'StockItem' para 'item'
          .map((item: StockItem) => item.product_id); // Especifica o tipo 'StockItem' para 'item'
        query = query.in('id', belowMinStockProducts);
      }
    }

    const { data: products, error } = await query;

    if (error) {
      return res.status(500).json({ message: 'Error fetching products' });
    }

    const productsWithStock = products?.map((product: Product) => {
      const currentStock =
          product.current_stock?.reduce((total: number, movement: Movement) => {
              return (
                  total +
                  (movement.type === 'IN' ? movement.quantity : -movement.quantity)
              );
          }, 0) ?? 0;
  
      return {
          ...product,
          currentStock,
          current_stock: undefined,
      };
  });
  
  

    return res.json(productsWithStock);
  }

  async update(req: Request, res: Response) {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      categoryId: z.string().uuid(),
      sku: z.string().min(1),
      price: z.preprocess((val) => Number(val), z.number().min(0)),
      minStock: z.preprocess((val) => Number(val), z.number().int().min(0)),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const file = req.file;
    const { name, description, categoryId, sku, price, minStock } =
      schema.parse(req.body);

    const updateData: any = {
      name,
      description,
      category_id: categoryId,
      sku,
      price,
      min_stock: minStock,
    };

    if (file) {
      updateData.image_url = `/uploads/${file.filename}`;
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('created_by', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Error updating product' });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { error: stockError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('product_id', id);

      if (stockError) {
        return res
          .status(500)
          .json({ message: 'Error deleting stock movements' });
      }

      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('created_by', req.user.id);

      if (productError) {
        return res.status(500).json({ message: 'Error deleting product' });
      }

      return res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir produto e movimentações:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}
