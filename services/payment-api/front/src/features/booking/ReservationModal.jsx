import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { PaymentForm } from '../../components/payment/PaymentForm';

const steps = ['Trajet', 'Paiement', 'Validation'];

export function ReservationModal({ trip, onClose, onStartPayment, onVerifyPayment, booked, paymentState }) {
  const [step, setStep] = useState('trip');
  const Icon = trip.icon;
  const validationStep = paymentState.status === 'awaiting_verification' || paymentState.status === 'succeeded';
  const currentStep = paymentState.status === 'succeeded' ? 3 : validationStep ? 3 : step === 'payment' ? 2 : 1;

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="trip-modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-banner">
        <div className="mode-icon"><Icon size={20} /></div>
        <div><span>Réserver</span><strong>{trip.provider}</strong></div>
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <div className="reservation-steps" aria-label="Étapes de réservation">
        {steps.map((label, index) => <div key={label} className={`reservation-step ${currentStep >= index + 1 ? 'active' : ''}`}><span>{index + 1}</span><small>{label}</small></div>)}
      </div>
      <div className="modal-body">
        {paymentState.status === 'succeeded' ? <Confirmation trip={trip} onClose={onClose} /> : step === 'trip' ? <TripSummary trip={trip} booked={booked} /> : <PaymentForm price={trip.price} paymentState={paymentState} onBack={() => setStep('trip')} onStart={(paymentMethod) => onStartPayment(trip, paymentMethod)} onVerify={(paymentId, code) => onVerifyPayment(trip, paymentId, code)} />}
      </div>
      {paymentState.status === 'succeeded' ? <div className="modal-footer modal-footer-confirmed"><span>Réservation confirmée</span><button className="primary-button" onClick={onClose}>Fermer</button></div> : <div className="modal-footer"><div><small>À régler</small><strong>{trip.price} €</strong></div>{step === 'trip' && !booked ? <button className="primary-button" onClick={() => setStep('payment')}>Poursuivre <ArrowRight size={15} /></button> : <span className="payment-footer-note">{booked ? 'Déjà réservé' : ''}</span>}</div>}
    </div>
  </div>;
}

function TripSummary({ trip, booked }) {
  return <div className="reservation-summary">
    <div className="modal-route"><div><span>{trip.from}</span><strong>{trip.departure}</strong></div><div className="modal-route-line"><div /><small>{trip.duration}</small><div /></div><div className="align-right"><span>{trip.to}</span><strong>{trip.arrival}</strong></div></div>
    <div className="detail-list"><div><span>Durée</span><b>{trip.duration}</b></div></div>
    {booked ? <p className="payment-success"><Check size={15} /> Ce trajet est déjà dans vos réservations.</p> : <div className="reservation-next"><strong>Avant de continuer</strong><span>Ajoutez vos informations de paiement à l’étape suivante. Le montant sera contrôlé par le serveur.</span></div>}
  </div>;
}

function Confirmation({ trip, onClose }) {
  return <div className="reservation-confirmation"><div className="confirmation-icon"><Check size={25} /></div><span className="section-kicker">CONFIRMÉ</span><h2>Trajet réservé.</h2><p>{trip.from} → {trip.to} · {trip.departure}</p><button className="primary-button" onClick={onClose}><ArrowLeft size={15} /> Retour aux trajets</button></div>;
}
