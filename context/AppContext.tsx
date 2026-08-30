import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Ride, Trip, rides } from '@/data/mock';

type Booking = { reference: string; ride: Ride; seats: string[]; date: string };
type Appearance = 'system' | 'light' | 'dark';

export type DriverRegistration = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  vehiclePlate: string;
  passengerSeats: string;
  registrationCard: boolean;
  drivingLicense: boolean;
  insurance: boolean;
  driverName: string;
  driverPhone: string;
  yearsExperience: string;
  completedTrips: string;
  driverBio: string;
  status: 'under_review';
  submittedAt: string;
};

type AppContextValue = {
  from: string;
  to: string;
  date: string;
  passengers: number;
  selectedRide: Ride;
  selectedSeats: string[];
  booking: Booking | null;
  appearance: Appearance;
  registration: DriverRegistration | null;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  setDate: (value: string) => void;
  setPassengers: (value: number) => void;
  selectRide: (ride: Ride) => void;
  toggleSeat: (seat: string) => void;
  confirmBooking: () => Booking;
  setAppearance: (value: Appearance) => void;
  saveRegistration: (value: DriverRegistration) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Matches the format the travel-options picker produces, e.g. "Thu, 27 Aug". */
function todayLabel() {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

function bookingReference() {
  return `CHL-${Math.floor(10000 + Math.random() * 89999)}`;
}

function bookingDate() {
  const now = new Date();
  return `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [from, setFrom] = useState('Faisalabad');
  const [to, setTo] = useState('Lahore');
  const [date, setDate] = useState(todayLabel);
  const [passengers, setPassengers] = useState(1);
  const [selectedRide, setSelectedRide] = useState<Ride>(rides[0]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['2']);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [appearance, setAppearance] = useState<Appearance>('system');
  const [registration, setRegistration] = useState<DriverRegistration | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('chalo-latest-booking').then((value) => {
      if (value) setBooking(JSON.parse(value) as Booking);
    });
    AsyncStorage.getItem('chalo-appearance').then((value) => {
      if (value === 'system' || value === 'light' || value === 'dark') setAppearance(value);
    });
    AsyncStorage.getItem('chalo-driver-registration').then((value) => {
      if (value) setRegistration(JSON.parse(value) as DriverRegistration);
    });
  }, []);

  const confirmBooking = () => {
    const next = {
      reference: bookingReference(),
      ride: selectedRide,
      seats: selectedSeats,
      date: bookingDate(),
    };
    setBooking(next);
    AsyncStorage.setItem('chalo-latest-booking', JSON.stringify(next));
    return next;
  };

  const updateAppearance = (value: Appearance) => {
    setAppearance(value);
    AsyncStorage.setItem('chalo-appearance', value);
  };

  const saveRegistration = (value: DriverRegistration) => {
    setRegistration(value);
    AsyncStorage.setItem('chalo-driver-registration', JSON.stringify(value));
  };

  const value = useMemo(() => ({
    from, to, date, passengers, selectedRide, selectedSeats, booking, appearance, registration,
    setFrom, setTo, setDate, setPassengers,
    selectRide: (ride: Ride) => { setSelectedRide(ride); setSelectedSeats(['2']); },
    toggleSeat: (seat: string) => setSelectedSeats((current) => current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat]),
    confirmBooking,
    setAppearance: updateAppearance,
    saveRegistration,
  }), [from, to, date, passengers, selectedRide, selectedSeats, booking, appearance, registration]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}

export type { Booking };
export type { Appearance };