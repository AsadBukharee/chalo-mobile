export type City = {
  name: string;
  region: string;
  short: string;
  /** Used to centre the map preview on the location screen. */
  lat: number;
  lng: number;
};

export type Driver = {
  id: string;
  name: string;
  initials: string;
  rating: number;
  trips: number;
  years: number;
  responseRate: string;
  cancellationRate: string;
  bio: string;
  reviews: string[];
};

export type Vehicle = {
  make: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  seats: number;
  features: string[];
};

export type Ride = {
  id: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  seatsLeft: number;
  pickup: string;
  dropoff: string;
  pickupDistance: string;
  dropoffDistance: string;
  driver: Driver;
  vehicle: Vehicle;
  recommended?: boolean;
};

export type Trip = {
  id: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  ride: Ride;
  date: string;
  seats: string[];
  reference?: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  tone: 'orange' | 'green' | 'dark';
  unread?: boolean;
};

export const cities: City[] = [
  { name: 'Faisalabad', region: 'Punjab', short: 'FSD', lat: 31.4504, lng: 73.135 },
  { name: 'Lahore', region: 'Punjab', short: 'LHE', lat: 31.5204, lng: 74.3587 },
  { name: 'Islamabad', region: 'Capital Territory', short: 'ISB', lat: 33.6844, lng: 73.0479 },
  { name: 'Rawalpindi', region: 'Punjab', short: 'RWP', lat: 33.5651, lng: 73.0169 },
  { name: 'Multan', region: 'Punjab', short: 'MUX', lat: 30.1575, lng: 71.5249 },
  { name: 'Sargodha', region: 'Punjab', short: 'SGI', lat: 32.0836, lng: 72.6711 },
  { name: 'Gujranwala', region: 'Punjab', short: 'GUJ', lat: 32.1877, lng: 74.1945 },
  { name: 'Peshawar', region: 'Khyber Pakhtunkhwa', short: 'PEW', lat: 34.0151, lng: 71.5249 },
  { name: 'Karachi', region: 'Sindh', short: 'KHI', lat: 24.8607, lng: 67.0011 },
  { name: 'Bahawalpur', region: 'Punjab', short: 'BHV', lat: 29.3956, lng: 71.6836 },
];

const ahmed: Driver = {
  id: 'ahmed-raza',
  name: 'Ahmed Raza',
  initials: 'AR',
  rating: 4.9,
  trips: 248,
  years: 9,
  responseRate: '98%',
  cancellationRate: '1%',
  bio: 'Friendly and punctual. I usually travel Faisalabad → Lahore on weekdays.',
  reviews: ['Friendly, punctual and a very comfortable ride.', 'Ahmed was easy to coordinate with.'],
};

const hamza: Driver = {
  id: 'hamza-khan',
  name: 'Hamza Khan',
  initials: 'HK',
  rating: 4.8,
  trips: 186,
  years: 7,
  responseRate: '96%',
  cancellationRate: '2%',
  bio: 'I enjoy meeting new people while making the drive between cities.',
  reviews: ['Smooth journey and great conversation.', 'The pickup was exactly on time.'],
};

const usman: Driver = {
  id: 'usman-ali',
  name: 'Usman Ali',
  initials: 'UA',
  rating: 4.7,
  trips: 122,
  years: 5,
  responseRate: '94%',
  cancellationRate: '3%',
  bio: 'Regularly driving the Lahore to Islamabad route.',
  reviews: ['Clean car and a safe driver.', 'Would book this route again.'],
};

export const rides: Ride[] = [
  {
    id: 'ride-ahmed',
    from: 'Faisalabad',
    to: 'Lahore',
    departure: '08:30 AM',
    arrival: '11:45 AM',
    duration: '3h 15m',
    price: 1850,
    seatsLeft: 2,
    pickup: 'D Ground, Faisalabad',
    dropoff: 'Liberty Market, Lahore',
    pickupDistance: '1.4 km away',
    dropoffDistance: '0.8 km away',
    driver: ahmed,
    vehicle: { make: 'Toyota', model: 'Corolla', year: 2021, color: 'Pearl White', plate: 'LEA •• 482', seats: 4, features: ['Air conditioning', 'Phone charging', 'Luggage space', 'Comfortable seats'] },
    recommended: true,
  },
  {
    id: 'ride-hamza',
    from: 'Faisalabad',
    to: 'Lahore',
    departure: '10:15 AM',
    arrival: '01:50 PM',
    duration: '3h 35m',
    price: 1600,
    seatsLeft: 3,
    pickup: 'Satyana Road, Faisalabad',
    dropoff: 'Thokar Niaz Baig, Lahore',
    pickupDistance: '3.2 km away',
    dropoffDistance: '4.7 km away',
    driver: hamza,
    vehicle: { make: 'Honda', model: 'Civic', year: 2020, color: 'Modern Steel', plate: 'FDS •• 119', seats: 4, features: ['Air conditioning', 'Comfortable seats', 'Luggage space'] },
  },
  {
    id: 'ride-usman',
    from: 'Faisalabad',
    to: 'Lahore',
    departure: '06:45 PM',
    arrival: '10:00 PM',
    duration: '3h 15m',
    price: 1700,
    seatsLeft: 1,
    pickup: 'Clock Tower, Faisalabad',
    dropoff: 'Gulberg Main Boulevard, Lahore',
    pickupDistance: '2.1 km away',
    dropoffDistance: '1.1 km away',
    driver: usman,
    vehicle: { make: 'Suzuki', model: 'Ciaz', year: 2022, color: 'Super White', plate: 'RWP •• 731', seats: 4, features: ['Air conditioning', 'Phone charging'] },
  },
  {
    id: 'ride-isb',
    from: 'Lahore',
    to: 'Islamabad',
    departure: '07:00 AM',
    arrival: '11:00 AM',
    duration: '4h',
    price: 2450,
    seatsLeft: 2,
    pickup: 'DHA Phase 5, Lahore',
    dropoff: 'F-8 Markaz, Islamabad',
    pickupDistance: '1.8 km away',
    dropoffDistance: '1.2 km away',
    driver: ahmed,
    vehicle: { make: 'Toyota', model: 'Corolla', year: 2021, color: 'Pearl White', plate: 'LEA •• 482', seats: 4, features: ['Air conditioning', 'Phone charging', 'Luggage space'] },
  },
];

export const trips: Trip[] = [
  { id: 'trip-upcoming', status: 'upcoming', ride: rides[0], date: 'Tomorrow', seats: ['2', '3'], reference: 'CHL-48291' },
  { id: 'trip-active', status: 'active', ride: rides[3], date: 'Today', seats: ['2'], reference: 'CHL-39018' },
  { id: 'trip-completed', status: 'completed', ride: { ...rides[1], from: 'Multan', to: 'Lahore' }, date: '18 Aug 2026', seats: ['3'], reference: 'CHL-44102' },
  { id: 'trip-cancelled', status: 'cancelled', ride: rides[2], date: '04 Aug 2026', seats: ['1'], reference: 'CHL-39870' },
];

export const notifications: Notice[] = [
  { id: 'n1', title: 'Booking confirmed', body: 'Your ride to Lahore is confirmed for tomorrow at 08:30 AM.', time: '12 min ago', icon: 'check-circle', tone: 'green', unread: true },
  { id: 'n2', title: 'Driver accepted', body: 'Ahmed Raza is looking forward to having you on board.', time: '2h ago', icon: 'user-check', tone: 'orange', unread: true },
  { id: 'n3', title: 'Trip reminder', body: 'Your Faisalabad → Lahore trip leaves tomorrow morning.', time: 'Yesterday', icon: 'clock', tone: 'dark' },
  { id: 'n4', title: 'Journey completed', body: 'How was your ride with Hamza? Leave a quick review.', time: '18 Aug', icon: 'star', tone: 'orange' },
];

export const popularRoutes = [
  { from: 'Faisalabad', to: 'Lahore', price: 'from Rs. 1,600', color: '#FFF0E5' },
  { from: 'Lahore', to: 'Islamabad', price: 'from Rs. 2,200', color: '#EEF8F0' },
  { from: 'Multan', to: 'Lahore', price: 'from Rs. 1,450', color: '#F2F0FF' },
];