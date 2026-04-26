
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'electronics_store',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

async function seed() {
  const client = await pool.connect();
  try {
    console.log(' Starting database seed...\n');

    //  DROP & RECREATE
    await client.query(`
      DROP TABLE IF EXISTS order_items   CASCADE;
      DROP TABLE IF EXISTS orders        CASCADE;
      DROP TABLE IF EXISTS cart_items    CASCADE;
      DROP TABLE IF EXISTS reviews       CASCADE;
      DROP TABLE IF EXISTS wishlist      CASCADE;
      DROP TABLE IF EXISTS products      CASCADE;
      DROP TABLE IF EXISTS categories    CASCADE;
      DROP TABLE IF EXISTS users         CASCADE;
    `);
    console.log('✓ Old tables dropped');

    // SCHEMA 
    await client.query(`
      CREATE TABLE users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100)  NOT NULL,
        email         VARCHAR(150)  UNIQUE NOT NULL,
        password      VARCHAR(255)  NOT NULL,
        role          VARCHAR(20)   DEFAULT 'customer' CHECK (role IN ('customer','admin')),
        avatar        VARCHAR(500),
        phone         VARCHAR(20),
        address       JSONB,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE categories (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        slug        VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        image       VARCHAR(500),
        icon        VARCHAR(100),
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE products (
        id                 SERIAL PRIMARY KEY,
        name               VARCHAR(200)   NOT NULL,
        slug               VARCHAR(200)   UNIQUE NOT NULL,
        description        TEXT,
        short_description  VARCHAR(500),
        price              DECIMAL(10,2)  NOT NULL,
        original_price     DECIMAL(10,2),
        discount_percent   INTEGER        DEFAULT 0,
        stock              INTEGER        DEFAULT 0,
        category_id        INTEGER        REFERENCES categories(id) ON DELETE SET NULL,
        brand              VARCHAR(100),
        sku                VARCHAR(100)   UNIQUE,
        images             JSONB          DEFAULT '[]',
        specifications     JSONB          DEFAULT '{}',
        features           JSONB          DEFAULT '[]',
        tags               JSONB          DEFAULT '[]',
        is_featured        BOOLEAN        DEFAULT FALSE,
        is_new             BOOLEAN        DEFAULT FALSE,
        rating             DECIMAL(3,2)   DEFAULT 0,
        review_count       INTEGER        DEFAULT 0,
        sold_count         INTEGER        DEFAULT 0,
        created_at         TIMESTAMP      DEFAULT NOW(),
        updated_at         TIMESTAMP      DEFAULT NOW()
      );

      CREATE TABLE wishlist (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id)    ON DELETE CASCADE,
        product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );

      CREATE TABLE cart_items (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id)    ON DELETE CASCADE,
        product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity    INTEGER   DEFAULT 1,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );

      CREATE TABLE orders (
        id                   SERIAL PRIMARY KEY,
        user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
        order_number         VARCHAR(50) UNIQUE NOT NULL,
        status               VARCHAR(50) DEFAULT 'pending'
                               CHECK (status IN ('pending','processing','shipped','delivered','cancelled','refunded')),
        payment_status       VARCHAR(50) DEFAULT 'pending'
                               CHECK (payment_status IN ('pending','paid','failed','refunded')),
        payment_method       VARCHAR(50),
        subtotal             DECIMAL(10,2) NOT NULL,
        tax                  DECIMAL(10,2) DEFAULT 0,
        shipping             DECIMAL(10,2) DEFAULT 0,
        total                DECIMAL(10,2) NOT NULL,
        shipping_address     JSONB,
        billing_address      JSONB,
        notes                TEXT,
        tracking_number      VARCHAR(100),
        stripe_payment_intent VARCHAR(200),
        created_at           TIMESTAMP DEFAULT NOW(),
        updated_at           TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE order_items (
        id               SERIAL PRIMARY KEY,
        order_id         INTEGER REFERENCES orders(id)   ON DELETE CASCADE,
        product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
        quantity         INTEGER       NOT NULL,
        price            DECIMAL(10,2) NOT NULL,
        product_snapshot JSONB,
        created_at       TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE reviews (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER REFERENCES users(id)    ON DELETE CASCADE,
        product_id    INTEGER REFERENCES products(id) ON DELETE CASCADE,
        rating        INTEGER CHECK (rating >= 1 AND rating <= 5),
        title         VARCHAR(200),
        body          TEXT,
        is_verified   BOOLEAN DEFAULT FALSE,
        helpful_count INTEGER DEFAULT 0,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );

      CREATE INDEX idx_products_category ON products(category_id);
      CREATE INDEX idx_products_brand    ON products(brand);
      CREATE INDEX idx_products_price    ON products(price);
      CREATE INDEX idx_products_rating   ON products(rating DESC);
      CREATE INDEX idx_cart_user         ON cart_items(user_id);
      CREATE INDEX idx_orders_user       ON orders(user_id);
      CREATE INDEX idx_reviews_product   ON reviews(product_id);
    `);
    console.log('✓ Schema created');

    //  USERS 
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const userHash  = await bcrypt.hash('User@123',  10);

    await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Admin User',  'admin@electrohub.com', $1, 'admin'),
        ('John Doe',    'john@example.com',      $2, 'customer'),
        ('Jane Smith',  'jane@example.com',      $2, 'customer')
    `, [adminHash, userHash]);
    console.log('✓ Users seeded  (admin: Admin@123 | users: User@123)');

    //  CATEGORIES
    await client.query(`
      INSERT INTO categories (name, slug, description, icon, image) VALUES
        ('Smartphones',  'smartphones',  'Latest smartphones & mobile devices',         'bi-phone',       'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'),
        ('Laptops',      'laptops',      'Powerful laptops for work and gaming',        'bi-laptop',      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400'),
        ('Headphones',   'headphones',   'Premium audio headphones and earbuds',        'bi-headphones',  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'),
        ('Cameras',      'cameras',      'DSLR, mirrorless and action cameras',         'bi-camera',      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400'),
        ('Tablets',      'tablets',      'iPads and Android tablets',                   'bi-tablet',      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400'),
        ('Smart Watches','smart-watches','Smartwatches and fitness trackers',            'bi-smartwatch',  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'),
        ('Gaming',       'gaming',       'Gaming consoles, controllers & accessories',  'bi-controller',  'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400'),
        ('Accessories',  'accessories',  'Cables, chargers and tech accessories',       'bi-plug',        'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400')
    `);
    console.log('✓ Categories seeded');

    //  PRODUCTS 
    const products = [
      /* ── Smartphones ── */
      {
        name:'iPhone 15 Pro Max', slug:'iphone-15-pro-max',
        desc:'The most powerful iPhone ever. A17 Pro chip, 48MP main camera, titanium design, and Action button.',
        short:'Apple flagship with A17 Pro chip, 48MP camera, titanium frame',
        price:134999, orig:149999, disc:10, stock:50, cat:1, brand:'Apple', sku:'APL-IP15PM-256',
        images:['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600','https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600'],
        specs:{Display:'6.7-inch Super Retina XDR',Chip:'A17 Pro',Camera:'48MP Main',Battery:'Up to 29hr',Storage:'256GB',RAM:'8GB',OS:'iOS 17','5G':'Yes'},
        features:['A17 Pro chip with 6-core GPU','48MP Main camera with 5x telephoto','Titanium design','Action Button','USB 3 speeds with USB-C','Emergency SOS via satellite'],
        tags:['smartphone','apple','iphone','5g','premium'],
        featured:true, isNew:true, rating:4.8, reviews:234, sold:1200
      },
      {
        name:'Samsung Galaxy S24 Ultra', slug:'samsung-galaxy-s24-ultra',
        desc:'The ultimate Galaxy with built-in S Pen, 200MP camera, and Galaxy AI. Powered by Snapdragon 8 Gen 3.',
        short:'Samsung flagship with 200MP camera and built-in S Pen',
        price:124999, orig:139999, disc:11, stock:45, cat:1, brand:'Samsung', sku:'SAM-S24U-256',
        images:['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600','https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600'],
        specs:{Display:'6.8-inch Dynamic AMOLED 2X',Chip:'Snapdragon 8 Gen 3',Camera:'200MP Main',Battery:'5000mAh',Storage:'256GB',RAM:'12GB',OS:'Android 14','5G':'Yes'},
        features:['Built-in S Pen','Galaxy AI features','200MP quad camera','100x Space Zoom','Titanium frame','IP68 water resistance'],
        tags:['smartphone','samsung','galaxy','5g','s-pen'],
        featured:true, isNew:true, rating:4.7, reviews:198, sold:980
      },
      {
        name:'OnePlus 12', slug:'oneplus-12',
        desc:'Hasselblad camera, Snapdragon 8 Gen 3, and 100W SUPERVOOC charging. Speed without compromise.',
        short:'Flagship killer with Hasselblad camera and 100W fast charging',
        price:64999, orig:69999, disc:7, stock:80, cat:1, brand:'OnePlus', sku:'OP-12-256',
        images:['https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600'],
        specs:{Display:'6.82-inch LTPO AMOLED',Chip:'Snapdragon 8 Gen 3',Camera:'50MP Hasselblad',Battery:'5400mAh',Storage:'256GB',RAM:'12GB',OS:'OxygenOS 14','5G':'Yes'},
        features:['Hasselblad tuned cameras','100W SUPERVOOC charging','50W wireless charging','120Hz display'],
        tags:['smartphone','oneplus','5g','fast-charging'],
        featured:false, isNew:true, rating:4.6, reviews:142, sold:650
      },
      /* ── Laptops ── */
      {
        name:'MacBook Pro 16" M3 Max', slug:'macbook-pro-16-m3-max',
        desc:'Supercharged by M3 Max chip with up to 128GB unified memory. Liquid Retina XDR display and all-day battery.',
        short:'Apple M3 Max laptop with Liquid Retina XDR display',
        price:299999, orig:329999, disc:9, stock:30, cat:2, brand:'Apple', sku:'APL-MBP16-M3MAX',
        images:['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600','https://images.unsplash.com/photo-1611186871525-12a3e2c3dfe6?w=600'],
        specs:{Display:'16.2-inch Liquid Retina XDR',Chip:'Apple M3 Max',RAM:'36GB Unified',Storage:'1TB SSD',Battery:'Up to 22hr',GPU:'40-core GPU',Ports:'3x Thunderbolt 4, HDMI, SD'},
        features:['M3 Max chip performance','Liquid Retina XDR display','ProMotion 120Hz','MagSafe charging','Up to 22 hours battery','8K HDMI output'],
        tags:['laptop','apple','macbook','m3','professional'],
        featured:true, isNew:true, rating:4.9, reviews:87, sold:320
      },
      {
        name:'Dell XPS 15 OLED', slug:'dell-xps-15-oled',
        desc:'Perfect balance of performance and portability. Stunning OLED display, Intel Core i9, NVIDIA RTX 4070.',
        short:'Premium laptop with OLED display and RTX 4070',
        price:189999, orig:209999, disc:10, stock:25, cat:2, brand:'Dell', sku:'DEL-XPS15-OLED',
        images:['https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=600'],
        specs:{Display:'15.6-inch OLED Touch',Processor:'Intel Core i9-13900H',RAM:'32GB DDR5',Storage:'1TB NVMe',GPU:'NVIDIA RTX 4070',Battery:'86WHr',Weight:'1.86kg'},
        features:['3.5K OLED display','NVIDIA RTX 4070','Intel Core i9','Thunderbolt 4','Fingerprint reader'],
        tags:['laptop','dell','xps','oled','rtx'],
        featured:true, isNew:false, rating:4.7, reviews:65, sold:215
      },
      {
        name:'ASUS ROG Zephyrus G14', slug:'asus-rog-zephyrus-g14',
        desc:'Compact gaming powerhouse with AMD Ryzen 9 and NVIDIA RTX 4060. Under 1.65kg.',
        short:'Ultra-compact gaming laptop with Ryzen 9 and RTX 4060',
        price:129999, orig:144999, disc:10, stock:40, cat:2, brand:'ASUS', sku:'ASUS-ROG-G14-2024',
        images:['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600'],
        specs:{Display:'14-inch QHD+ 165Hz',Processor:'AMD Ryzen 9 7940HS',RAM:'16GB DDR5',Storage:'1TB NVMe',GPU:'NVIDIA RTX 4060',Battery:'76WHr',Weight:'1.65kg'},
        features:['AniMe Matrix LED display','MUX switch','165Hz QHD+','USB4 support','Wi-Fi 6E'],
        tags:['laptop','asus','rog','gaming','amd','rtx'],
        featured:false, isNew:true, rating:4.6, reviews:98, sold:380
      },
      /* ── Headphones ── */
      {
        name:'Sony WH-1000XM5', slug:'sony-wh-1000xm5',
        desc:'Industry-leading noise cancellation with 30-hour battery. The benchmark in premium wireless headphones.',
        short:'Industry-leading noise cancellation with 30hr battery',
        price:29999, orig:34999, disc:14, stock:100, cat:3, brand:'Sony', sku:'SNY-WH1000XM5',
        images:['https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'],
        specs:{Driver:'30mm',Frequency:'4Hz-40,000Hz',Battery:'30 hours','Charge Time':'3.5 hours',Weight:'250g',Connectivity:'Bluetooth 5.2',ANC:'Industry-leading'},
        features:['8 microphones for ANC','30-hour battery','Quick charge 3min=3hrs','Multipoint connection','360 Reality Audio'],
        tags:['headphones','sony','noise-cancelling','wireless','premium'],
        featured:true, isNew:false, rating:4.8, reviews:312, sold:2100
      },
      {
        name:'Apple AirPods Pro 2nd Gen', slug:'airpods-pro-2nd-gen',
        desc:'Rebuilt from the ground up. 2x more Active Noise Cancellation, Adaptive Transparency, Personalized Spatial Audio.',
        short:'Apple AirPods Pro with H2 chip and adaptive noise cancellation',
        price:24999, orig:26999, disc:7, stock:120, cat:3, brand:'Apple', sku:'APL-APPRO2',
        images:['https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=600'],
        specs:{Chip:'H2',ANC:'Up to 2x improved',Battery:'6hr (30hr with case)',Charging:'USB-C/MagSafe',Resistance:'IPX4'},
        features:['H2 chip','Adaptive Transparency','Personalized Spatial Audio','Touch control','Find My','USB-C charging case'],
        tags:['earbuds','apple','airpods','wireless','anc'],
        featured:true, isNew:false, rating:4.7, reviews:289, sold:1800
      },
      {
        name:'Bose QuietComfort 45', slug:'bose-quietcomfort-45',
        desc:'World-class noise cancellation and premium audio. Up to 24 hours of battery life.',
        short:'World-class noise cancellation with 24hr battery',
        price:27999, orig:32999, disc:15, stock:75, cat:3, brand:'Bose', sku:'BOSE-QC45',
        images:['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'],
        specs:{Battery:'24 hours',Weight:'238g',Connectivity:'Bluetooth 5.1',Modes:'Quiet/Aware',Charging:'USB-C',Foldable:'Yes'},
        features:['TriPort acoustic architecture','Quiet and Aware modes','24-hour battery','SimpleSync technology'],
        tags:['headphones','bose','noise-cancelling','wireless'],
        featured:false, isNew:false, rating:4.6, reviews:201, sold:1250
      },
      /* ── Cameras ── */
      {
        name:'Sony Alpha A7 IV', slug:'sony-alpha-a7-iv',
        desc:'33MP full-frame sensor with AI-based autofocus, 10fps burst, and 4K 60p video.',
        short:'Full-frame mirrorless with 33MP sensor and AI autofocus',
        price:219999, orig:239999, disc:8, stock:20, cat:4, brand:'Sony', sku:'SNY-A7IV-BODY',
        images:['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600','https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600'],
        specs:{Sensor:'33MP Full-Frame BSI CMOS',ISO:'100-51200',AF:'759 phase-detect points',Burst:'10fps',Video:'4K 60p',Stabilization:'5-axis IBIS',Battery:'580 shots'},
        features:['33MP full-frame sensor','AI-based autofocus','4K 60p video','5-axis stabilization','Dual card slots'],
        tags:['camera','sony','mirrorless','fullframe','professional'],
        featured:true, isNew:false, rating:4.8, reviews:76, sold:180
      },
      {
        name:'GoPro Hero 12 Black', slug:'gopro-hero-12-black',
        desc:'5.3K video, 27MP photos, and HyperSmooth 6.0 stabilization. Waterproof to 10m.',
        short:'Waterproof action camera with 5.3K video and HyperSmooth',
        price:44999, orig:49999, disc:10, stock:60, cat:4, brand:'GoPro', sku:'GPR-HERO12-BLK',
        images:['https://images.unsplash.com/photo-1565130838609-c3a86655db61?w=600'],
        specs:{Video:'5.3K60 / 4K120',Photo:'27MP',Stabilization:'HyperSmooth 6.0',Waterproof:'10m',Battery:'Enduro',Display:'Front + Rear LCD'},
        features:['5.3K60 video','HyperSmooth 6.0','27MP photos','10m waterproof','Voice control'],
        tags:['camera','gopro','action','waterproof','4k'],
        featured:false, isNew:true, rating:4.7, reviews:134, sold:520
      },
      /* ── Tablets ── */
      {
        name:'iPad Pro 12.9" M2', slug:'ipad-pro-12-9-m2',
        desc:'M2 chip, Liquid Retina XDR display with ProMotion, Apple Pencil hover.',
        short:"Apple's most powerful iPad with M2 chip",
        price:109999, orig:119999, disc:8, stock:35, cat:5, brand:'Apple', sku:'APL-IPADPRO12-M2',
        images:['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600'],
        specs:{Display:'12.9-inch Liquid Retina XDR',Chip:'Apple M2',Storage:'256GB',Camera:'12MP Wide + 10MP Ultra Wide',Connectivity:'Wi-Fi 6E, 5G opt',Battery:'Up to 10hr','Face ID':'Yes'},
        features:['M2 chip','Liquid Retina XDR','ProMotion 120Hz','Thunderbolt / USB 4','Apple Pencil hover','Center Stage'],
        tags:['tablet','apple','ipad','m2','professional'],
        featured:true, isNew:false, rating:4.8, reviews:143, sold:450
      },
      {
        name:'Samsung Galaxy Tab S9 Ultra', slug:'samsung-galaxy-tab-s9-ultra',
        desc:'14.6-inch Dynamic AMOLED 2X with built-in S Pen. Snapdragon 8 Gen 2.',
        short:'14.6-inch Android tablet with built-in S Pen',
        price:99999, orig:109999, disc:9, stock:28, cat:5, brand:'Samsung', sku:'SAM-TABS9U-256',
        images:['https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600'],
        specs:{Display:'14.6-inch Dynamic AMOLED 2X',Chip:'Snapdragon 8 Gen 2',RAM:'12GB',Storage:'256GB',Camera:'13MP + 8MP',Battery:'11200mAh','S Pen':'Built-in'},
        features:['Built-in S Pen','14.6-inch AMOLED','120Hz','DeX mode','IP68','Wi-Fi 6E'],
        tags:['tablet','samsung','android','s-pen','amoled'],
        featured:false, isNew:true, rating:4.7, reviews:89, sold:280
      },
      /* ── Smart Watches ── */
      {
        name:'Apple Watch Ultra 2', slug:'apple-watch-ultra-2',
        desc:'49mm titanium case, precision dual-frequency GPS, 100m water resistance, 60hr battery.',
        short:'Most capable Apple Watch with 49mm titanium case',
        price:84999, orig:89999, disc:6, stock:40, cat:6, brand:'Apple', sku:'APL-WATCHULTRA2',
        images:['https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=600','https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'],
        specs:{Case:'49mm Titanium',Display:'Always-on Retina',GPS:'Dual-frequency L1/L5',Dive:'100m',Battery:'60hr low power',Chip:'S9 SiP',ECG:'Yes'},
        features:['Titanium case','Dual-frequency GPS','100m water resistance','60-hour battery','Action button','Siren 86dB'],
        tags:['smartwatch','apple','ultra','gps','fitness'],
        featured:true, isNew:true, rating:4.8, reviews:98, sold:340
      },
      {
        name:'Samsung Galaxy Watch 6 Classic', slug:'samsung-galaxy-watch-6-classic',
        desc:'Rotating bezel, advanced health monitoring including body composition, Samsung ecosystem integration.',
        short:'Premium smartwatch with rotating bezel and health tracking',
        price:34999, orig:38999, disc:10, stock:55, cat:6, brand:'Samsung', sku:'SAM-GW6C-47',
        images:['https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600'],
        specs:{Case:'47mm Stainless Steel',Display:'1.47-inch Super AMOLED',Battery:'425mAh (40hr)',GPS:'Yes',Health:'ECG, BP, Body Comp',Water:'5ATM + IP68',OS:'Wear OS 4'},
        features:['Rotating bezel','ECG and blood pressure','Body composition','40-hour battery','Samsung Pay'],
        tags:['smartwatch','samsung','galaxy','health','classic'],
        featured:false, isNew:true, rating:4.6, reviews:112, sold:420
      },
      /* ── Gaming ── */
      {
        name:'PlayStation 5 Console', slug:'playstation-5-console',
        desc:'Custom CPU, GPU and SSD with Integrated I/O. Haptic feedback, 3D Audio, up to 8K.',
        short:'Next-gen gaming console with ultra-high speed SSD',
        price:49999, orig:54999, disc:9, stock:15, cat:7, brand:'Sony', sku:'SNY-PS5-DISC',
        images:['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600','https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600'],
        specs:{CPU:'AMD Zen 2 3.5GHz',GPU:'AMD RDNA 2 10.28 TFLOPS',RAM:'16GB GDDR6',Storage:'825GB Custom NVMe',Optical:'4K UHD Blu-ray',Resolution:'Up to 8K',Audio:'Tempest 3D'},
        features:['Custom SSD ultra-fast loading','DualSense haptic feedback','Tempest 3D Audio','4K gaming','Ray tracing','PS4 backward compatible','120fps'],
        tags:['gaming','playstation','sony','console','ps5'],
        featured:true, isNew:false, rating:4.9, reviews:567, sold:1800
      },
      {
        name:'Xbox Series X', slug:'xbox-series-x',
        desc:'12 teraflops of raw graphic processing. Play thousands of titles from four generations.',
        short:"Microsoft's flagship console with 12 TFLOPS",
        price:49999, orig:54999, disc:9, stock:12, cat:7, brand:'Microsoft', sku:'MSFT-XBOXSX',
        images:['https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600'],
        specs:{CPU:'Custom AMD Zen 2 3.8GHz',GPU:'Custom AMD RDNA 2 12 TFLOPS',RAM:'16GB GDDR6',Storage:'1TB NVMe',Optical:'4K UHD Blu-ray',Resolution:'Up to 8K',FPS:'Up to 120fps'},
        features:['12 TFLOPS GPU','Quick Resume','Smart Delivery','Game Pass ready','4K 120fps','4 gen backward compat'],
        tags:['gaming','xbox','microsoft','console'],
        featured:false, isNew:false, rating:4.8, reviews:423, sold:1500
      },
      /* ── Accessories ── */
      {
        name:'Anker 100W GaN Charger', slug:'anker-100w-gan-charger',
        desc:'100W GaN II with 4 ports. Charge laptop, phone, and two more devices simultaneously.',
        short:'100W GaN fast charger with 4 ports',
        price:4999, orig:5999, disc:17, stock:200, cat:8, brand:'Anker', sku:'ANK-100W-GAN4P',
        images:['https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600'],
        specs:{Wattage:'100W Total',Ports:'2x USB-C + 2x USB-A',Technology:'GaN II',Size:'62x62x29mm',Compatible:'MacBook, iPhone, Samsung, iPad'},
        features:['100W total output','GaN II technology','4 simultaneous ports','Foldable plug','ActiveShield 2.0 protection'],
        tags:['charger','anker','gan','fast-charging','accessories'],
        featured:false, isNew:false, rating:4.7, reviews:432, sold:3200
      },
      {
        name:'Samsung T7 2TB Portable SSD', slug:'samsung-t7-2tb-ssd',
        desc:'Up to 1,050MB/s transfer. Compact metal design, USB 3.2 Gen 2, AES 256-bit encryption.',
        short:'Ultra-fast 2TB portable SSD at 1050MB/s',
        price:14999, orig:17999, disc:17, stock:85, cat:8, brand:'Samsung', sku:'SAM-T7-2TB',
        images:['https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=600'],
        specs:{Capacity:'2TB','Read Speed':'1,050MB/s','Write Speed':'1,000MB/s',Interface:'USB 3.2 Gen 2',Dimensions:'85x57x8mm',Weight:'98g',Encryption:'AES 256-bit'},
        features:['1,050MB/s read','Compact metal design','AES 256-bit encryption','Shock resistant','USB-C + USB-A cables'],
        tags:['ssd','storage','samsung','portable','accessories'],
        featured:false, isNew:true, rating:4.8, reviews:287, sold:1800
      },
    ];

    for (const p of products) {
      await client.query(`
        INSERT INTO products
          (name,slug,description,short_description,price,original_price,discount_percent,
           stock,category_id,brand,sku,images,specifications,features,tags,
           is_featured,is_new,rating,review_count,sold_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      `, [
        p.name, p.slug, p.desc, p.short, p.price, p.orig, p.disc,
        p.stock, p.cat, p.brand, p.sku,
        JSON.stringify(p.images),
        JSON.stringify(p.specs),
        JSON.stringify(p.features),
        JSON.stringify(p.tags),
        p.featured, p.isNew, p.rating, p.reviews, p.sold
      ]);
    }
    console.log(`✓ ${products.length} products seeded`);

    //  TRIGGER: auto-update rating 
    await client.query(`
      CREATE OR REPLACE FUNCTION update_product_rating()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE products
        SET rating       = (SELECT AVG(rating) FROM reviews WHERE product_id = NEW.product_id),
            review_count = (SELECT COUNT(*)    FROM reviews WHERE product_id = NEW.product_id)
        WHERE id = NEW.product_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS after_review_change ON reviews;
      CREATE TRIGGER after_review_change
      AFTER INSERT OR UPDATE ON reviews
      FOR EACH ROW EXECUTE FUNCTION update_product_rating();
    `);
    console.log('✓ Rating trigger created');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('Login credentials:');
    console.log('  Admin  : admin@electrohub.com / Admin@123');
    console.log('  User   : john@example.com     / User@123');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
