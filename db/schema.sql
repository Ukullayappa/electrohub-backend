
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS wishlist CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    avatar VARCHAR(500),
    phone VARCHAR(20),
    address JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image VARCHAR(500),
    icon VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    discount_percent INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    sku VARCHAR(100) UNIQUE,
    images JSONB DEFAULT '[]',
    specifications JSONB DEFAULT '{}',
    features JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    is_featured BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    sold_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Wishlist table
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Cart items table
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    shipping DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    shipping_address JSONB,
    billing_address JSONB,
    notes TEXT,
    tracking_number VARCHAR(100),
    stripe_payment_intent VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    product_snapshot JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    body TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_rating ON products(rating DESC);
CREATE INDEX idx_cart_user ON cart_items(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);


-- Admin user (password: Admin@123)
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@electrohub.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('John Doe', 'john@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer'),
('Jane Smith', 'jane@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer');

-- Categories
INSERT INTO categories (name, slug, description, icon, image) VALUES
('Smartphones', 'smartphones', 'Latest smartphones and mobile devices', 'bi-phone', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'),
('Laptops', 'laptops', 'Powerful laptops for work and gaming', 'bi-laptop', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400'),
('Headphones', 'headphones', 'Premium audio headphones and earbuds', 'bi-headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'),
('Cameras', 'cameras', 'DSLR, mirrorless and action cameras', 'bi-camera', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400'),
('Tablets', 'tablets', 'iPads and Android tablets', 'bi-tablet', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400'),
('Smart Watches', 'smart-watches', 'Smartwatches and fitness trackers', 'bi-smartwatch', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'),
('Gaming', 'gaming', 'Gaming consoles, controllers and accessories', 'bi-controller', 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400'),
('Accessories', 'accessories', 'Cables, chargers and tech accessories', 'bi-plug', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400');

-- Products - Smartphones
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'iPhone 15 Pro Max',
  'iphone-15-pro-max',
  'The most powerful iPhone ever. Featuring the A17 Pro chip with a 48MP main camera system, titanium design, and Action button for quick access to your favorite features.',
  'Apple''s flagship with A17 Pro chip, 48MP camera, titanium frame',
  134999.00, 149999.00, 10, 50,
  1, 'Apple', 'APL-IP15PM-256',
  '["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600","https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600"]',
  '{"Display":"6.7-inch Super Retina XDR","Chip":"A17 Pro","Camera":"48MP Main","Battery":"Up to 29hr video","Storage":"256GB","RAM":"8GB","OS":"iOS 17","5G":"Yes"}',
  '["A17 Pro chip with 6-core GPU","48MP Main camera with 5x telephoto","Titanium design","Action Button","USB 3 speeds with USB-C","Emergency SOS via satellite"]',
  '["smartphone","apple","iphone","5g","premium"]',
  TRUE, TRUE, 4.8, 234, 1200
),
(
  'Samsung Galaxy S24 Ultra',
  'samsung-galaxy-s24-ultra',
  'The ultimate Galaxy experience with built-in S Pen, 200MP camera, and Galaxy AI features. Powered by Snapdragon 8 Gen 3.',
  'Samsung flagship with 200MP camera and built-in S Pen',
  124999.00, 139999.00, 11, 45,
  1, 'Samsung', 'SAM-S24U-256',
  '["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600","https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600"]',
  '{"Display":"6.8-inch Dynamic AMOLED 2X","Chip":"Snapdragon 8 Gen 3","Camera":"200MP Main","Battery":"5000mAh","Storage":"256GB","RAM":"12GB","OS":"Android 14","5G":"Yes"}',
  '["Built-in S Pen","Galaxy AI features","200MP quad camera system","100x Space Zoom","Titanium frame","IP68 water resistance"]',
  '["smartphone","samsung","galaxy","5g","s-pen"]',
  TRUE, TRUE, 4.7, 198, 980
),
(
  'OnePlus 12',
  'oneplus-12',
  'Hasselblad camera, Snapdragon 8 Gen 3, and 100W SUPERVOOC charging. Speed without compromise.',
  'Flagship killer with Hasselblad camera and 100W fast charging',
  64999.00, 69999.00, 7, 80,
  1, 'OnePlus', 'OP-12-256',
  '["https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600"]',
  '{"Display":"6.82-inch LTPO AMOLED","Chip":"Snapdragon 8 Gen 3","Camera":"50MP Hasselblad","Battery":"5400mAh","Storage":"256GB","RAM":"12GB","OS":"OxygenOS 14","5G":"Yes"}',
  '["Hasselblad tuned cameras","100W SUPERVOOC charging","50W wireless charging","Snapdragon 8 Gen 3","120Hz display"]',
  '["smartphone","oneplus","5g","fast-charging"]',
  FALSE, TRUE, 4.6, 142, 650
);

-- Products - Laptops
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'MacBook Pro 16" M3 Max',
  'macbook-pro-16-m3-max',
  'Supercharged by M3 Max chip with up to 128GB unified memory. Featuring a stunning Liquid Retina XDR display and all-day battery life.',
  'Apple M3 Max powered laptop with Liquid Retina XDR display',
  299999.00, 329999.00, 9, 30,
  2, 'Apple', 'APL-MBP16-M3MAX',
  '["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600","https://images.unsplash.com/photo-1611186871525-12a3e2c3dfe6?w=600"]',
  '{"Display":"16.2-inch Liquid Retina XDR","Chip":"Apple M3 Max","RAM":"36GB Unified","Storage":"1TB SSD","Battery":"Up to 22hr","GPU":"40-core GPU","Ports":"3x Thunderbolt 4, HDMI, SD"}',
  '["M3 Max chip performance","Liquid Retina XDR display","Up to 22 hours battery","ProMotion 120Hz","MagSafe charging","8K HDMI output"]',
  '["laptop","apple","macbook","m3","professional"]',
  TRUE, TRUE, 4.9, 87, 320
),
(
  'Dell XPS 15 OLED',
  'dell-xps-15-oled',
  'The perfect balance of performance and portability. Featuring a stunning OLED display, Intel Core i9, and NVIDIA GeForce RTX 4070.',
  'Premium laptop with OLED display and RTX 4070',
  189999.00, 209999.00, 10, 25,
  2, 'Dell', 'DEL-XPS15-OLED',
  '["https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=600"]',
  '{"Display":"15.6-inch OLED Touch","Processor":"Intel Core i9-13900H","RAM":"32GB DDR5","Storage":"1TB NVMe","GPU":"NVIDIA RTX 4070","Battery":"86WHr","Weight":"1.86kg"}',
  '["3.5K OLED display","NVIDIA RTX 4070","Intel Core i9","Thunderbolt 4","Fingerprint reader","Backlit keyboard"]',
  '["laptop","dell","xps","oled","rtx"]',
  TRUE, FALSE, 4.7, 65, 215
),
(
  'ASUS ROG Zephyrus G14',
  'asus-rog-zephyrus-g14',
  'Compact gaming powerhouse with AMD Ryzen 9 and NVIDIA RTX 4060. The ultimate gaming laptop under 1.65kg.',
  'Ultra-compact gaming laptop with Ryzen 9 and RTX 4060',
  129999.00, 144999.00, 10, 40,
  2, 'ASUS', 'ASUS-ROG-G14-2024',
  '["https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600"]',
  '{"Display":"14-inch QHD+ 165Hz","Processor":"AMD Ryzen 9 7940HS","RAM":"16GB DDR5","Storage":"1TB NVMe","GPU":"NVIDIA RTX 4060","Battery":"76WHr","Weight":"1.65kg"}',
  '["AniMe Matrix LED display","ROG Nebula display","MUX switch","165Hz QHD+","USB4 support","Wi-Fi 6E"]',
  '["laptop","asus","rog","gaming","amd","rtx"]',
  FALSE, TRUE, 4.6, 98, 380
);

-- Products - Headphones
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'Sony WH-1000XM5',
  'sony-wh-1000xm5',
  'Industry-leading noise cancellation meets exceptional sound quality. 30-hour battery life with quick charge. The benchmark in premium wireless headphones.',
  'Industry-leading noise cancellation with 30hr battery',
  29999.00, 34999.00, 14, 100,
  3, 'Sony', 'SNY-WH1000XM5',
  '["https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600","https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"]',
  '{"Driver":"30mm","Frequency":"4Hz-40,000Hz","Battery":"30 hours","Charge Time":"3.5 hours","Weight":"250g","Connectivity":"Bluetooth 5.2","ANC":"Industry-leading"}',
  '["8 microphones for noise cancellation","30-hour battery life","Quick charge (3min=3hrs)","Multipoint connection","360 Reality Audio","DSEE Extreme upscaling"]',
  '["headphones","sony","noise-cancelling","wireless","premium"]',
  TRUE, FALSE, 4.8, 312, 2100
),
(
  'Apple AirPods Pro 2nd Gen',
  'airpods-pro-2nd-gen',
  'Rebuilt from the ground up, AirPods Pro now feature up to 2x more Active Noise Cancellation, Adaptive Transparency, and Personalized Spatial Audio.',
  'Apple AirPods Pro with H2 chip and adaptive noise cancellation',
  24999.00, 26999.00, 7, 120,
  3, 'Apple', 'APL-APPRO2',
  '["https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=600"]',
  '{"Chip":"H2","ANC":"Up to 2x improved","Battery":"6hr (30hr with case)","Charging":"Lightning/MagSafe","Resistance":"IPX4","Driver":"Custom high-excursion"}',
  '["H2 chip","Adaptive Transparency","Personalized Spatial Audio","Touch control","Find My network","USB-C charging case"]',
  '["earbuds","apple","airpods","wireless","anc"]',
  TRUE, FALSE, 4.7, 289, 1800
),
(
  'Bose QuietComfort 45',
  'bose-quietcomfort-45',
  'Wireless noise cancelling headphones with world-class noise cancellation and premium audio performance. Up to 24 hours of battery life.',
  'World-class noise cancellation with 24hr battery',
  27999.00, 32999.00, 15, 75,
  3, 'Bose', 'BOSE-QC45',
  '["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"]',
  '{"Battery":"24 hours","Weight":"238g","Connectivity":"Bluetooth 5.1","Modes":"Quiet/Aware","Charging":"USB-C","Foldable":"Yes"}',
  '["TriPort acoustic architecture","Quiet and Aware modes","24-hour battery","Lightweight design","SimpleSync technology","Alexa & Google Assistant"]',
  '["headphones","bose","noise-cancelling","wireless"]',
  FALSE, FALSE, 4.6, 201, 1250
);

-- Products - Cameras
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'Sony Alpha A7 IV',
  'sony-alpha-a7-iv',
  'The next step in the evolution of the Alpha series. 33MP full-frame sensor with advanced AI-based autofocus, 10fps burst shooting, and 4K 60p video.',
  'Full-frame mirrorless camera with 33MP sensor and AI autofocus',
  219999.00, 239999.00, 8, 20,
  4, 'Sony', 'SNY-A7IV-BODY',
  '["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600","https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600"]',
  '{"Sensor":"33MP Full-Frame BSI CMOS","ISO":"100-51200","AF":"759 phase-detect points","Burst":"10fps","Video":"4K 60p","Stabilization":"5-axis IBIS","Battery":"580 shots"}',
  '["33MP full-frame sensor","AI-based autofocus","4K 60p video recording","5-axis image stabilization","Dual card slots","Real-time Eye AF"]',
  '["camera","sony","mirrorless","fullframe","professional"]',
  TRUE, FALSE, 4.8, 76, 180
),
(
  'GoPro Hero 12 Black',
  'gopro-hero-12-black',
  'The most versatile GoPro ever. Capture stunning 5.3K video, 27MP photos, and HyperSmooth 6.0 stabilization in any condition.',
  'Waterproof action camera with 5.3K video and HyperSmooth',
  44999.00, 49999.00, 10, 60,
  4, 'GoPro', 'GPR-HERO12-BLK',
  '["https://images.unsplash.com/photo-1565130838609-c3a86655db61?w=600"]',
  '{"Video":"5.3K60 / 4K120","Photo":"27MP","Stabilization":"HyperSmooth 6.0","Waterproof":"10m without case","Battery":"Enduro battery","Display":"Front + Rear LCD"}',
  '["5.3K60 video","HyperSmooth 6.0 stabilization","27MP photos","10m waterproof","Live streaming","Voice control"]',
  '["camera","gopro","action","waterproof","4k"]',
  FALSE, TRUE, 4.7, 134, 520
);

-- Products - Tablets
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'iPad Pro 12.9" M2',
  'ipad-pro-12-9-m2',
  'The ultimate iPad experience. M2 chip, stunning Liquid Retina XDR display with ProMotion, and Apple Pencil hover. Designed for those who do it all.',
  'Apple''s most powerful iPad with M2 chip and Liquid Retina XDR',
  109999.00, 119999.00, 8, 35,
  5, 'Apple', 'APL-IPADPRO12-M2',
  '["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600"]',
  '{"Display":"12.9-inch Liquid Retina XDR","Chip":"Apple M2","Storage":"256GB","Camera":"12MP Wide + 10MP Ultra Wide","Connectivity":"Wi-Fi 6E, 5G opt","Battery":"Up to 10hr","Face ID":"Yes"}',
  '["M2 chip performance","Liquid Retina XDR display","ProMotion 120Hz","Thunderbolt / USB 4","Apple Pencil hover","Center Stage"]',
  '["tablet","apple","ipad","m2","professional"]',
  TRUE, FALSE, 4.8, 143, 450
),
(
  'Samsung Galaxy Tab S9 Ultra',
  'samsung-galaxy-tab-s9-ultra',
  'The biggest, most powerful Galaxy Tab. 14.6-inch Dynamic AMOLED 2X display with built-in S Pen. Snapdragon 8 Gen 2 for maximum performance.',
  '14.6-inch Android tablet with built-in S Pen and AMOLED display',
  99999.00, 109999.00, 9, 28,
  5, 'Samsung', 'SAM-TABS9U-256',
  '["https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600"]',
  '{"Display":"14.6-inch Dynamic AMOLED 2X","Chip":"Snapdragon 8 Gen 2","RAM":"12GB","Storage":"256GB","Camera":"13MP + 8MP rear","Battery":"11200mAh","S Pen":"Built-in"}',
  '["Built-in S Pen","14.6-inch AMOLED display","120Hz refresh rate","DeX mode support","IP68 water resistance","Wi-Fi 6E"]',
  '["tablet","samsung","android","s-pen","amoled"]',
  FALSE, TRUE, 4.7, 89, 280
);

-- Products - Smart Watches
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'Apple Watch Ultra 2',
  'apple-watch-ultra-2',
  'The most rugged and capable Apple Watch. Designed for endurance athletes and adventurers with a 49mm titanium case and precision dual-frequency GPS.',
  'Most capable Apple Watch with 49mm titanium case',
  84999.00, 89999.00, 6, 40,
  6, 'Apple', 'APL-WATCHULTRA2',
  '["https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=600","https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"]',
  '{"Case":"49mm Titanium","Display":"Always-on Retina","GPS":"Dual-frequency L1/L5","Dive":"100m water resistance","Battery":"60hr (low power)","Chip":"S9 SiP","ECG":"Yes"}',
  '["Titanium case design","Dual-frequency GPS","100m water resistance","60-hour battery","Action button","Ultra wideband chip","Siren up to 86dB"]',
  '["smartwatch","apple","ultra","gps","fitness"]',
  TRUE, TRUE, 4.8, 98, 340
),
(
  'Samsung Galaxy Watch 6 Classic',
  'samsung-galaxy-watch-6-classic',
  'The premium Galaxy Watch with rotating bezel, advanced health monitoring including body composition analysis, and seamless Samsung ecosystem integration.',
  'Premium smartwatch with rotating bezel and health tracking',
  34999.00, 38999.00, 10, 55,
  6, 'Samsung', 'SAM-GW6C-47',
  '["https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600"]',
  '{"Case":"47mm Stainless Steel","Display":"1.47-inch Super AMOLED","Battery":"425mAh (40hr)","GPS":"Yes","Health":"ECG, Blood Pressure, Body Composition","Water":"5ATM + IP68","OS":"Wear OS 4"}',
  '["Rotating bezel","Advanced health monitoring","ECG and blood pressure","Body composition","40-hour battery","Wear OS 4","Samsung Pay"]',
  '["smartwatch","samsung","galaxy","health","classic"]',
  FALSE, TRUE, 4.6, 112, 420
);

-- Products - Gaming
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'PlayStation 5 Console',
  'playstation-5-console',
  'Play has no limits. The PS5 console unleashes new gaming possibilities with the custom CPU, GPU and SSD with Integrated I/O. Ultra-high speed SSD, Haptic feedback, and 3D Audio.',
  'Next-gen gaming console with ultra-high speed SSD and haptic feedback',
  49999.00, 54999.00, 9, 15,
  7, 'Sony', 'SNY-PS5-DISC',
  '["https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600","https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600"]',
  '{"CPU":"AMD Zen 2 (3.5GHz)","GPU":"AMD RDNA 2 (10.28 TFLOPS)","RAM":"16GB GDDR6","Storage":"825GB Custom NVMe","Optical":"4K UHD Blu-ray","Resolution":"Up to 8K","Audio":"Tempest 3D AudioTech"}',
  '["Custom SSD for ultra-fast loading","DualSense haptic feedback","Tempest 3D AudioTech","4K gaming","Ray tracing support","PS4 backward compatibility","120fps gaming"]',
  '["gaming","playstation","sony","console","ps5"]',
  TRUE, FALSE, 4.9, 567, 1800
),
(
  'Xbox Series X',
  'xbox-series-x',
  'The fastest, most powerful Xbox ever. Explore rich new worlds with 12 teraflops of raw graphic processing power. Play thousands of titles from across four generations of consoles.',
  'Microsoft''s flagship gaming console with 12 teraflops performance',
  49999.00, 54999.00, 9, 12,
  7, 'Microsoft', 'MSFT-XBOXSX',
  '["https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600"]',
  '{"CPU":"Custom AMD Zen 2 (3.8GHz)","GPU":"Custom AMD RDNA 2 (12 TFLOPS)","RAM":"16GB GDDR6","Storage":"1TB NVMe","Optical":"4K UHD Blu-ray","Resolution":"Up to 8K","FPS":"Up to 120fps"}',
  '["12 teraflops GPU","Quick Resume feature","Smart Delivery","Xbox Game Pass ready","4K 120fps gaming","DirectX 12 Ultimate","4 generations backward compatible"]',
  '["gaming","xbox","microsoft","console"]',
  FALSE, FALSE, 4.8, 423, 1500
);

-- Products - Accessories
INSERT INTO products (name, slug, description, short_description, price, original_price, discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new, rating, review_count, sold_count) VALUES
(
  'Anker 100W GaN Charger',
  'anker-100w-gan-charger',
  '100W GaN charging technology with 4 ports. Charge your laptop, phone, and two more devices simultaneously. Foldable plug for portability.',
  '100W GaN fast charger with 4 ports for all your devices',
  4999.00, 5999.00, 17, 200,
  8, 'Anker', 'ANK-100W-GAN4P',
  '["https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600"]',
  '{"Wattage":"100W Total","Ports":"2x USB-C + 2x USB-A","Technology":"GaN II","Size":"62x62x29mm","Compatible":"MacBook Pro, iPhone, Samsung, iPad"}',
  '["100W total output","GaN II technology","4 simultaneous ports","Foldable plug","ActiveShield 2.0 protection","Travel-friendly size"]',
  '["charger","anker","gan","fast-charging","accessories"]',
  FALSE, FALSE, 4.7, 432, 3200
),
(
  'Samsung T7 2TB Portable SSD',
  'samsung-t7-2tb-ssd',
  'Transfer files at blazing speeds up to 1,050MB/s with the Samsung T7 Portable SSD. Compact, durable metal design with USB 3.2 Gen 2.',
  'Ultra-fast 2TB portable SSD with 1050MB/s transfer speed',
  14999.00, 17999.00, 17, 85,
  8, 'Samsung', 'SAM-T7-2TB',
  '["https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=600"]',
  '{"Capacity":"2TB","Read Speed":"1,050MB/s","Write Speed":"1,000MB/s","Interface":"USB 3.2 Gen 2","Dimensions":"85x57x8mm","Weight":"98g","Encryption":"AES 256-bit"}',
  '["1,050MB/s read speed","Compact metal design","AES 256-bit encryption","Shock resistant","USB-C and USB-A cables included","Password protection"]',
  '["ssd","storage","samsung","portable","accessories"]',
  FALSE, TRUE, 4.8, 287, 1800
);

-- Update functions for rating
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET rating = (SELECT AVG(rating) FROM reviews WHERE product_id = NEW.product_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_review_insert
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
