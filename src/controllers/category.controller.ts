import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';

export class CategoryController {
  async create(req: Request, res: Response) {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { name, description } = schema.parse(req.body);

    const { data: category, error } = await supabase
      .from('categories')
      .insert([
        {
          name,
          description,
          created_by: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Error creating category' });
    }

    return res.status(201).json(category);
  }

  async list(req: Request, res: Response) {
    const schema = z.object({
      search: z.string().optional(),
      sort: z.enum(['name', 'created_at']).optional().default('name'),
      order: z.enum(['asc', 'desc']).optional().default('asc'),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  
    const { search, sort, order } = schema.parse(req.query);
  
    let query = supabase
      .from('categories')
      .select('*')
      .eq('created_by', req.user.id)  // Filtra pelo ID do usuário
      .order(sort, { ascending: order === 'asc' });
  
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
  
    const { data: categories, error } = await query;
  
    if (error) {
      return res.status(500).json({ message: 'Error fetching categories' });
    }
  
    return res.json(categories);
  }

  async update(req: Request, res: Response) {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    });

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name, description } = schema.parse(req.body);

    const { data: category, error } = await supabase
      .from('categories')
      .update({ name, description })
      .eq('id', id)
      .eq('created_by', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Error updating category' });
    }

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    return res.json(category);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', id)
      .single();

    if (!productsError) {
      return res.status(400).json({ 
        message: 'Cannot delete category with associated products' 
      });
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('created_by', req.user.id);

    if (error) {
      return res.status(500).json({ message: 'Error deleting category' });
    }

    return res.status(204).send();
  }
}
