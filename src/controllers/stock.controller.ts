import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';

export class StockController {
  async createMovement(req: Request, res: Response) {
    console.log('Chamando createMovement', req.body);

    const schema = z.object({
      productId: z.string().uuid(),
      type: z.enum(['IN', 'OUT']),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { productId, type, quantity, notes } = schema.parse(req.body);

    const { data: movement, error } = await supabase
      .from('stock_movements')
      .insert([
        {
          product_id: productId,
          type,
          quantity,
          notes,
          created_by: req.user.id, // Filtra pelo ID do usuário
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Error creating stock movement' });
    }

    return res.status(201).json(movement);
  }

  async getProductStock(req: Request, res: Response) {
    const { productId } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('type, quantity')
      .eq('product_id', productId)
      .eq('created_by', req.user.id); // Filtra pelo ID do usuário

    if (error) {
      return res.status(500).json({ message: 'Error fetching stock movements' });
    }

    const currentStock = movements.reduce((total, movement) => {
      return total + (movement.type === 'IN' ? movement.quantity : -movement.quantity);
    }, 0);

    return res.json({ currentStock });
  }

  async listMovements(req: Request, res: Response) {
    const schema = z.object({
      productId: z.string().uuid().optional(),
      type: z.enum(['IN', 'OUT']).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      sort: z.enum(['created_at']).optional().default('created_at'),
      order: z.enum(['asc', 'desc']).optional().default('desc'),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { productId, type, startDate, endDate, sort, order } = schema.parse(req.query);

    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        product:products(name),
        user:users(full_name)
      `)
      .eq('created_by', req.user.id) // Filtra pelo ID do usuário
      .order(sort, { ascending: order === 'asc' });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: movements, error } = await query;

    if (error) {
      return res.status(500).json({ message: 'Error fetching stock movements' });
    }

    return res.json(movements);
  }

  async deleteMovement(req: Request, res: Response) {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('stock_movements')
      .delete()
      .eq('id', id)
      .eq('created_by', req.user.id); // Filtra pelo ID do usuário

    if (error) {
      return res.status(500).json({ message: 'Error deleting stock movement' });
    }

    return res.status(204).send();
  }
}
