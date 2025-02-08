/*
  # Initial Schema Setup for Inventory Management

  1. New Tables
    - users
    - categories
    - products
    - stock_movements
*/

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  reset_token text,
  reset_token_expires timestamptz,
  google_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Categories table
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies for categories table
CREATE POLICY "Categories are readable by authenticated users"
  ON categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Categories are insertable by authenticated users"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Categories are updatable by creator"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Products table
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) NOT NULL,
  sku text UNIQUE NOT NULL,
  image_url text,
  min_stock integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies for products table
CREATE POLICY "Products are readable by authenticated users"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Products are insertable by authenticated users"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Products are updatable by creator"
  ON products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Stock Movements table
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity integer NOT NULL,
  notes text,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies for stock_movements table
CREATE POLICY "Stock movements are readable by authenticated users"
  ON stock_movements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Stock movements are insertable by authenticated users"
  ON stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();