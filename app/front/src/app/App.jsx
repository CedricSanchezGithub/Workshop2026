import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PublicShell } from '../components/layout/PublicShell';
import { Chatbot } from '../components/chat/Chatbot';
import { trips } from '../data/trips';
import { filterTrips } from '../features/booking/bookingService';
import { BookingPage } from '../features/booking/BookingPage';
import { ReservationsPage } from '../features/reservations/ReservationsPage';
import { HelpPage } from '../features/help/HelpPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AdminPage } from '../features/admin/AdminPage';
import { createPaymentIntent, getPaymentIntent, refundPayment, verifyPayment as verifyPaymentIntent } from '../features/payment/paymentClient';
import { ContactPage } from '../features/site/ContactPage';
import { HomePage } from '../features/site/HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { clearAuthSession, getAuthToken, getCurrentUser, logoutUser } from '../features/auth/authClient';
import { ReservationModal } from '../features/booking/ReservationModal';

export default function App() {
  const [route, setRoute] = useState(() => window.location.pathname.replace(/^\//, '') || 'home');
  const [activeNav, setActiveNav] = useState('Réserver');
  const [transport, setTransport] = useState('Tous');
  const [search, setSearch] = useState('');
  const [destination, setDestination] = useState('');
  const [tripMode, setTripMode] = useState('oneWay');
  const [departureDate, setDepartureDate] = useState('2026-10-26');
  const [returnDate, setReturnDate] = useState('2026-10-30');
  const [showFilters, setShowFilters] = useState(false);
  const [directOnly, setDirectOnly] = useState(true);
  const [maxPrice, setMaxPrice] = useState(120);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [paymentState, setPaymentState] = useState({ status: 'idle', error: '' });
  const [bookedTrips, setBookedTrips] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancellationError, setCancellationError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => { getCurrentUser().then(setAuthUser).finally(() => setAuthReady(true)); }, []);
  const visibleTrips = useMemo(() => filterTrips(trips, { transport, search, destination, directOnly, maxPrice }), [transport, search, destination, directOnly, maxPrice]);
  const startPayment = async (trip, paymentMethod) => {
    if (!getAuthToken()) {
      const error = new Error('AUTH_REQUIRED');
      setPaymentState({ status: 'error', error: 'Connectez-vous pour confirmer une réservation.' });
      throw error;
    }
    setPaymentState({ status: 'processing', error: '' });
    try {
      const result = await createPaymentIntent(trip, paymentMethod);
      setPaymentState({ status: 'awaiting_verification', error: '' });
      return result;
    } catch (error) {
      const message = error.message === 'Failed to fetch' ? 'API de paiement indisponible. Lancez npm run api:dev.' : error.message;
      setPaymentState({ status: 'error', error: message });
      throw new Error(message);
    }
  };
  const verifyPayment = async (trip, paymentId, code) => {
    setPaymentState({ status: 'processing', error: '' });
    try {
      await verifyPaymentIntent(paymentId, code);
      let currentPayment = await getPaymentIntent(paymentId);
      for (let attempt = 0; attempt < 12 && (currentPayment.status === 'pending' || currentPayment.status === 'processing'); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        currentPayment = await getPaymentIntent(paymentId);
      }
      if (currentPayment.status !== 'succeeded') throw new Error(currentPayment.failureCode || 'PAYMENT_FAILED');
      setBookedTrips((current) => current.some((item) => item.id === trip.id) ? current : [...current, { ...trip, paymentId, paymentStatus: 'succeeded' }]);
      setPaymentState({ status: 'succeeded', error: '' });
      return currentPayment;
    } catch (error) {
      const message = error.message === 'Failed to fetch' ? 'API de paiement indisponible. Lancez npm run api:dev.' : error.message;
      setPaymentState({ status: 'error', error: message });
      throw new Error(message);
    }
  };
  const cancelTrip = async (trip) => {
    if (!trip.paymentId || trip.paymentStatus === 'refunded') return;
    setCancellingId(trip.id);
    setCancellationError('');
    try {
      await refundPayment(trip.paymentId);
      let refund = await getPaymentIntent(trip.paymentId);
      for (let attempt = 0; attempt < 12 && refund.status === 'refund_pending'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        refund = await getPaymentIntent(trip.paymentId);
      }
      if (refund.status !== 'refunded') throw new Error('REFUND_FAILED');
      setBookedTrips((current) => current.map((item) => item.id === trip.id ? { ...item, paymentStatus: 'refunded', refundReference: refund.refundReference } : item));
    } catch (error) {
      setCancellationError(error.message === 'Failed to fetch' ? 'API de paiement indisponible.' : error.message);
    } finally {
      setCancellingId(null);
    }
  };
  const selectTrip = (trip) => { setSelectedTrip(trip); setPaymentState({ status: 'idle', error: '' }); };
  const state = { transport, search, destination, tripMode, departureDate, returnDate, showFilters, directOnly, maxPrice, visibleTrips };
  const actions = { setTransport, setSearch, setDestination, setTripMode, setDepartureDate, setReturnDate, setShowFilters, setDirectOnly, setMaxPrice, selectTrip };
  const openBooking = () => { setActiveNav('Réserver'); setRoute('app'); };
  const handleAuthenticated = (session) => { setAuthUser(session.user); setActiveNav('Réserver'); setRoute('app'); };
  const handleLogout = async () => { await logoutUser(); clearAuthSession(); setAuthUser(null); setRoute('home'); };
  if (!authReady) return <div className="loading-screen">PAY&GO</div>;
  const publicContent = route === 'home' ? <HomePage onBook={openBooking} onContact={() => setRoute('contact')} /> : route === 'contact' ? <ContactPage /> : route === 'login' ? <LoginPage onRegister={() => setRoute('register')} onBook={openBooking} onAuthenticated={handleAuthenticated} /> : <RegisterPage onLogin={() => setRoute('login')} onBook={openBooking} onAuthenticated={handleAuthenticated} />;
  if (route !== 'app') return <PublicShell route={route} user={authUser} onLogout={handleLogout} onNavigate={setRoute}>{publicContent}</PublicShell>;
  return <AppShell user={authUser} onLogout={handleLogout} activeNav={activeNav} onNavigate={setActiveNav} onHome={() => setRoute('home')} bookedCount={bookedTrips.length} menuOpen={menuOpen} setMenuOpen={setMenuOpen} chat={<Chatbot />}>
    {activeNav === 'Réserver' && <BookingPage state={state} actions={actions} />}
    {activeNav === 'Mes réservations' && <ReservationsPage trips={bookedTrips} onExplore={() => setActiveNav('Réserver')} onSelect={selectTrip} onCancel={cancelTrip} cancellingId={cancellingId} error={cancellationError} />}
    {activeNav === 'Aide' && <HelpPage />}
    {activeNav === 'Paramètres' && <SettingsPage user={authUser} onLogout={handleLogout} />}
    {activeNav === 'Administration' && authUser?.role === 'admin' && <AdminPage />}
    {selectedTrip && <ReservationModal trip={selectedTrip} onClose={() => { setSelectedTrip(null); setPaymentState({ status: 'idle', error: '' }); }} onStartPayment={startPayment} onVerifyPayment={verifyPayment} booked={bookedTrips.some((trip) => trip.id === selectedTrip.id)} paymentState={paymentState} />}
  </AppShell>;
}
