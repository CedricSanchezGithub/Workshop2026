import { ArrowRight } from 'lucide-react';

export function TripCard({ trip, onSelect }) {
  const Icon = trip.icon;
  return <article className="trip-card" role="button" tabIndex="0" onClick={() => onSelect(trip)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(trip); } }}><div className="mode-icon" title={trip.type === 'Plane' ? 'Avion' : trip.type}><Icon size={19} /></div><div className="trip-main"><div className="trip-meta"><span>{trip.provider}</span></div><div className="trip-route"><div><strong>{trip.departure}</strong><small>{trip.from}</small></div><div className="route-line"><span /><i>{trip.duration}</i><span /></div><div className="route-end"><strong>{trip.arrival}</strong><small>{trip.to}</small></div></div></div><div className="trip-price"><small>Tarif</small><strong>{trip.price} €</strong><button type="button" onClick={(event) => { event.stopPropagation(); onSelect(trip); }}>Réserver <ArrowRight size={14} /></button></div></article>;
}
