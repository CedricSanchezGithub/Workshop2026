import { BusFront, Plane, TrainFront } from 'lucide-react';

export const trips = [
  { id: 1, type: 'Train', provider: 'SNCF Connect', from: 'Paris Gare de Lyon', to: 'Lyon Part-Dieu', departure: '08:42', arrival: '10:34', duration: '1h 52', price: 39, stops: 'Direct', icon: TrainFront },
  { id: 2, type: 'Bus', provider: 'BlaBlaCar Bus', from: 'Paris Bercy Seine', to: 'Bruxelles Midi', departure: '09:15', arrival: '13:40', duration: '4h 25', price: 24, stops: 'Direct', icon: BusFront },
  { id: 3, type: 'Plane', provider: 'Air France', from: 'Paris — CDG', to: 'Nice — NCE', departure: '11:20', arrival: '12:50', duration: '1h 30', price: 89, stops: 'Direct', icon: Plane },
  { id: 4, type: 'Train', provider: 'OUIGO', from: 'Paris Montparnasse', to: 'Bordeaux St-Jean', departure: '14:10', arrival: '16:26', duration: '2h 16', price: 29, stops: 'Direct', icon: TrainFront },
  { id: 5, type: 'Bus', provider: 'FlixBus', from: 'Lyon Perrache', to: 'Marseille St-Charles', departure: '17:30', arrival: '21:15', duration: '3h 45', price: 18, stops: '1 arrêt', icon: BusFront },
  { id: 6, type: 'Train', provider: 'SNCF Connect', from: 'Paris Gare du Nord', to: 'Lille Flandres', departure: '07:18', arrival: '08:21', duration: '1h 03', price: 35, stops: 'Direct', icon: TrainFront },
  { id: 7, type: 'Bus', provider: 'BlaBlaCar Bus', from: 'Paris Bercy Seine', to: 'Amsterdam Sloterdijk', departure: '06:45', arrival: '13:30', duration: '6h 45', price: 42, stops: 'Direct', icon: BusFront },
  { id: 8, type: 'Plane', provider: 'Transavia', from: 'Paris — ORY', to: 'Toulouse — TLS', departure: '09:05', arrival: '10:25', duration: '1h 20', price: 74, stops: 'Direct', icon: Plane },
  { id: 9, type: 'Train', provider: 'SNCF Connect', from: 'Lyon Part-Dieu', to: 'Avignon TGV', departure: '12:10', arrival: '12:55', duration: '45 min', price: 25, stops: 'Direct', icon: TrainFront },
  { id: 10, type: 'Bus', provider: 'FlixBus', from: 'Marseille St-Charles', to: 'Nice Vauban', departure: '15:20', arrival: '18:05', duration: '2h 45', price: 22, stops: 'Direct', icon: BusFront },
  { id: 11, type: 'Train', provider: 'OUIGO', from: 'Bordeaux St-Jean', to: 'Paris Montparnasse', departure: '18:12', arrival: '20:26', duration: '2h 14', price: 44, stops: 'Direct', icon: TrainFront },
  { id: 12, type: 'Plane', provider: 'Air France', from: 'Nice — NCE', to: 'Paris — CDG', departure: '16:40', arrival: '18:10', duration: '1h 30', price: 92, stops: 'Direct', icon: Plane },
  { id: 13, type: 'Train', provider: 'SNCF Connect', from: 'Strasbourg', to: 'Paris Gare de l’Est', departure: '07:46', arrival: '09:35', duration: '1h 49', price: 49, stops: 'Direct', icon: TrainFront },
  { id: 14, type: 'Bus', provider: 'BlaBlaCar Bus', from: 'Lille Europe', to: 'Paris Bercy Seine', departure: '19:10', arrival: '21:50', duration: '2h 40', price: 19, stops: '1 arrêt', icon: BusFront },
  { id: 15, type: 'Train', provider: 'TER', from: 'Nantes', to: 'Rennes', departure: '10:05', arrival: '10:55', duration: '50 min', price: 21, stops: 'Direct', icon: TrainFront },
  { id: 16, type: 'Plane', provider: 'Air France', from: 'Paris — CDG', to: 'Milan — MXP', departure: '13:15', arrival: '14:45', duration: '1h 30', price: 99, stops: 'Direct', icon: Plane },
];

export const navItems = [
  { label: 'Réserver', icon: 'plus' },
  { label: 'Mes réservations', icon: 'calendar' },
  { label: 'Aide', icon: 'help' },
];
