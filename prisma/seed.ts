import 'dotenv/config';
import { PrismaClient, Branch, Merchant } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { randomBytes } from 'crypto';

const databaseUrl = process.env.DATABASE_URL!;
const parsedUrl = new URL(databaseUrl);
const database = parsedUrl.pathname.replace(/^\//, '');

const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed Branches
  const branches: Branch[] = [];
  const branchData = [
    { name: 'Lagos Main', address: '12 Marina Road', city: 'Lagos', state: 'Lagos', country: 'Nigeria', phone: '+2348011111001', email: 'lagos.main@sonichoice.com' },
    { name: 'Abuja Central', address: '45 Garki Avenue', city: 'Abuja', state: 'FCT', country: 'Nigeria', phone: '+2348011111002', email: 'abuja.central@sonichoice.com' },
    { name: 'Port Harcourt', address: '8 Aba Road', city: 'Port Harcourt', state: 'Rivers', country: 'Nigeria', phone: '+2348011111003', email: 'ph@sonichoice.com' },
    { name: 'Ibadan West', address: '22 Ring Road', city: 'Ibadan', state: 'Oyo', country: 'Nigeria', phone: '+2348011111004', email: 'ibadan.west@sonichoice.com' },
    { name: 'Kano North', address: '5 Bello Way', city: 'Kano', state: 'Kano', country: 'Nigeria', phone: '+2348011111005', email: 'kano.north@sonichoice.com' },
    { name: 'Enugu Branch', address: '17 Ogui Road', city: 'Enugu', state: 'Enugu', country: 'Nigeria', phone: '+2348011111006', email: 'enugu@sonichoice.com' },
    { name: 'Benin City', address: '3 Sapele Road', city: 'Benin', state: 'Edo', country: 'Nigeria', phone: '+2348011111007', email: 'benin@sonichoice.com' },
    { name: 'Warri Delta', address: '10 Effurun Road', city: 'Warri', state: 'Delta', country: 'Nigeria', phone: '+2348011111008', email: 'warri@sonichoice.com' },
    { name: 'Kaduna South', address: '14 Kachia Road', city: 'Kaduna', state: 'Kaduna', country: 'Nigeria', phone: '+2348011111009', email: 'kaduna@sonichoice.com' },
    { name: 'Jos Plateau', address: '6 Ahmadu Bello Way', city: 'Jos', state: 'Plateau', country: 'Nigeria', phone: '+2348011111010', email: 'jos@sonichoice.com' },
    { name: 'Owerri Hub', address: '9 Wetheral Road', city: 'Owerri', state: 'Imo', country: 'Nigeria', phone: '+2348011111011', email: 'owerri@sonichoice.com' },
    { name: 'Calabar Branch', address: '20 Marian Road', city: 'Calabar', state: 'Cross River', country: 'Nigeria', phone: '+2348011111012', email: 'calabar@sonichoice.com' },
    { name: 'Abeokuta', address: '7 Onikolobo Road', city: 'Abeokuta', state: 'Ogun', country: 'Nigeria', phone: '+2348011111013', email: 'abeokuta@sonichoice.com' },
    { name: 'Uyo Branch', address: '15 Ikot Ekpene Road', city: 'Uyo', state: 'Akwa Ibom', country: 'Nigeria', phone: '+2348011111014', email: 'uyo@sonichoice.com' },
    { name: 'Asaba Office', address: '11 Nnebisi Road', city: 'Asaba', state: 'Delta', country: 'Nigeria', phone: '+2348011111015', email: 'asaba@sonichoice.com' },
    { name: 'Ilorin Branch', address: '4 Unity Road', city: 'Ilorin', state: 'Kwara', country: 'Nigeria', phone: '+2348011111016', email: 'ilorin@sonichoice.com' },
    { name: 'Akure Branch', address: '18 Oyemekun Road', city: 'Akure', state: 'Ondo', country: 'Nigeria', phone: '+2348011111017', email: 'akure@sonichoice.com' },
    { name: 'Maiduguri', address: '2 Bama Road', city: 'Maiduguri', state: 'Borno', country: 'Nigeria', phone: '+2348011111018', email: 'maiduguri@sonichoice.com' },
    { name: 'Sokoto Branch', address: '13 Sultan Way', city: 'Sokoto', state: 'Sokoto', country: 'Nigeria', phone: '+2348011111019', email: 'sokoto@sonichoice.com' },
    { name: 'Lekki Island', address: '25 Admiralty Way', city: 'Lagos', state: 'Lagos', country: 'Nigeria', phone: '+2348011111020', email: 'lekki@sonichoice.com' },
  ];

  for (const data of branchData) {
    const branch = await prisma.branch.create({ data });
    branches.push(branch);
  }
  console.log(`Seeded ${branches.length} branches`);

  // Seed Merchants
  const merchants: Merchant[] = [];
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
  const merchantData = [
    { name: 'TechNova', email: 'info@technova.ng', phone: '+2348022221001', color: '#FF5733' },
    { name: 'GreenLeaf Supplies', email: 'sales@greenleaf.ng', phone: '+2348022221002', color: '#33FF57' },
    { name: 'BlueStar Electronics', email: 'contact@bluestar.ng', phone: '+2348022221003', color: '#3357FF' },
    { name: 'OrangeBox Trading', email: 'hello@orangebox.ng', phone: '+2348022221004', color: '#FF9F33' },
    { name: 'Zenith Goods', email: 'info@zenithgoods.ng', phone: '+2348022221005', color: '#9F33FF' },
    { name: 'PrimeStock Ltd', email: 'orders@primestock.ng', phone: '+2348022221006', color: '#33FFF5' },
    { name: 'SwiftMart', email: 'support@swiftmart.ng', phone: '+2348022221007', color: '#FF33A1' },
    { name: 'Apex Distributors', email: 'info@apexdist.ng', phone: '+2348022221008', color: '#A1FF33' },
    { name: 'Nova Retail', email: 'sales@novaretail.ng', phone: '+2348022221009', color: '#33A1FF' },
    { name: 'Pinnacle Imports', email: 'contact@pinnacle.ng', phone: '+2348022221010', color: '#FF6633' },
    { name: 'Crystal Clear Co', email: 'info@crystalclear.ng', phone: '+2348022221011', color: '#66FF33' },
    { name: 'Emerald Trading', email: 'trade@emerald.ng', phone: '+2348022221012', color: '#3366FF' },
    { name: 'Diamond Supplies', email: 'info@diamondsup.ng', phone: '+2348022221013', color: '#FF3366' },
    { name: 'Royal Merchants', email: 'orders@royalmerch.ng', phone: '+2348022221014', color: '#33FF66' },
    { name: 'Atlas Commerce', email: 'info@atlascom.ng', phone: '+2348022221015', color: '#6633FF' },
    { name: 'Horizon Goods', email: 'sales@horizongoods.ng', phone: '+2348022221016', color: '#FFCC33' },
    { name: 'Summit Traders', email: 'hello@summittrade.ng', phone: '+2348022221017', color: '#33CCFF' },
    { name: 'Vanguard Stock', email: 'info@vanguardstk.ng', phone: '+2348022221018', color: '#CC33FF' },
    { name: 'Pacific Supply', email: 'orders@pacificsup.ng', phone: '+2348022221019', color: '#FF33CC' },
    { name: 'Global Reach Ltd', email: 'info@globalreach.ng', phone: '+2348022221020', color: '#33FFCC' },
  ];

  for (let i = 0; i < merchantData.length; i++) {
    const merchant = await prisma.merchant.create({
      data: { ...merchantData[i], status: statuses[i % statuses.length] },
    });
    merchants.push(merchant);
  }
  console.log(`Seeded ${merchants.length} merchants`);

  // Seed Products
  const productNames = [
    'Samsung Galaxy S24', 'iPhone 15 Pro Max', 'MacBook Air M3', 'Dell XPS 15',
    'Sony WH-1000XM5', 'iPad Pro 12.9', 'HP LaserJet Pro', 'Logitech MX Master',
    'Canon EOS R6', 'Nintendo Switch OLED', 'Google Pixel 8 Pro', 'AirPods Pro 2',
    'LG OLED TV 55"', 'Bose SoundLink Max', 'Xiaomi Redmi Note 13', 'ThinkPad X1 Carbon',
    'PlayStation 5 Slim', 'Epson EcoTank L3250', 'JBL Charge 5', 'Apple Watch Ultra 2',
  ];

  const descriptions = [
    'Latest flagship smartphone with advanced camera system',
    'Premium smartphone with titanium design',
    'Ultra-thin laptop with M3 chip',
    'High-performance laptop for professionals',
    'Industry-leading noise cancelling headphones',
    'Professional tablet with M2 chip',
    'Compact laser printer for office use',
    'Ergonomic wireless mouse for productivity',
    'Full-frame mirrorless camera',
    'Portable gaming console with OLED display',
    'AI-powered smartphone with best-in-class camera',
    'Active noise cancelling earbuds',
    'Premium OLED TV with Dolby Vision',
    'Portable Bluetooth speaker with deep bass',
    'Budget-friendly smartphone with great features',
    'Business ultrabook with legendary keyboard',
    'Next-gen gaming console',
    'Ink tank printer for high-volume printing',
    'Waterproof portable speaker',
    'Rugged smartwatch for outdoor adventures',
    
  ];


  for (let i = 0; i < 20; i++) {
    const merchant = merchants[i % merchants.length];
    const branch = branches[i % branches.length];
    const prefix = merchant.name.substring(0, 4).toUpperCase();
    const year = new Date().getFullYear();
    const unique = randomBytes(4).toString('hex').toUpperCase();
    const trackingId = `${prefix}-${year}-${unique}`;

    await prisma.product.create({
      data: {
        trackingId,
        name: productNames[i],
        description: descriptions[i],
        quantity: Math.floor(Math.random() * 200) + 10,
        merchantId: merchant.id,
        branchId: branch.id,
        additionalInfo: i % 3 === 0 ? 'Handle with care. Store in cool dry place.' : null,
      },
    });
  }
  console.log('Seeded 20 products');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
