# 4. DATABASE SCHEMA — PART 2

## 4.1 Core Tables

### `products`
```sql
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  barcode VARCHAR(100),
  additional_barcodes JSONB,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id INT NOT NULL REFERENCES categories(category_id),
  brand_id INT REFERENCES brands(brand_id),
  weight_value DECIMAL(10,2),
  weight_unit VARCHAR(10), -- 'gram', 'kg'
  has_expiry BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active', -- active/inactive/discontinued
  primary_image_url VARCHAR(500),
  created_by INT REFERENCES users(user_id),
  updated_by INT REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_status ON products(status);
```

### `product_images`
```sql
CREATE TABLE product_images (
  image_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `product_suppliers`
```sql
CREATE TABLE product_suppliers (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  supplier_id INT NOT NULL REFERENCES suppliers(supplier_id),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);
```

### `product_uoms`
```sql
CREATE TABLE product_uoms (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  uom_name VARCHAR(50) NOT NULL, -- "Sak", "Pcs", "Box"
  is_base BOOLEAN DEFAULT false,
  conversion_to_base DECIMAL(10,2) DEFAULT 1, -- 1 Sak = 30 Pcs
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, uom_name)
);
```

### `product_pricing`
```sql
CREATE TABLE product_pricing (
  pricing_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  uom_id INT NOT NULL REFERENCES product_uoms(id),
  tier_1_retail DECIMAL(15,2) NOT NULL,
  tier_2_grosir DECIMAL(15,2),
  tier_3_member DECIMAL(15,2),
  tier_4_distributor DECIMAL(15,2),
  tier_5_reseller DECIMAL(15,2),
  tier_6_promo DECIMAL(15,2),
  minimum_price DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  effective_date DATE,
  created_by INT REFERENCES users(user_id),
  updated_by INT REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, branch_id, uom_id)
);

CREATE INDEX idx_pricing_product_branch ON product_pricing(product_id, branch_id);
```

### `categories`
```sql
CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INT REFERENCES categories(category_id),
  level INT NOT NULL, -- 1, 2, or 3
  description TEXT,
  icon_url VARCHAR(500),
  sort_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_level ON categories(level);
```

### `brands`
```sql
CREATE TABLE brands (
  brand_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `tags` & `product_tag_assignments`
```sql
CREATE TABLE tags (
  tag_id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7), -- Hex color code
  is_auto BOOLEAN DEFAULT false,
  auto_rule TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_tag_assignments (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  tag_id INT NOT NULL REFERENCES tags(tag_id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, tag_id)
);
```
