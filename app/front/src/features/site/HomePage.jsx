import { ArrowRight, BusFront, Plane, ShieldCheck, TrainFront } from 'lucide-react';

export function HomePage({ onBook, onContact }) {
  return <div className="public-page home-page">
    <section className="home-hero">
      <div className="hero-copy">
        <h1>Réservez votre trajet.</h1>
        <p>Comparez les départs en bus, train et avion, puis finalisez votre réservation en quelques étapes.</p>
        <div className="hero-actions"><button className="hero-primary" onClick={onBook}>Réserver un trajet <ArrowRight size={17} /></button><button className="hero-secondary" onClick={onContact}>Une question ?</button></div>
      </div>
      <div className="hero-ticket" aria-label="Exemple de trajet">
        <div className="ticket-top"><span>TRAJET</span><span>26 OCT 2026</span></div>
        <div className="ticket-route"><div><small>DE</small><strong>Paris</strong><span>08:42 · Gare de Lyon</span></div><div className="ticket-arrow"><ArrowRight size={22} /><small>1H 52</small></div><div className="ticket-destination"><small>À</small><strong>Lyon</strong><span>10:34 · Part-Dieu</span></div></div>
        <div className="ticket-footer"><span>SNCF Connect</span><b>39 €</b></div>
      </div>
    </section>
    <section className="public-section intro-section"><div className="section-intro"><h2>Tout le parcours, au même endroit.</h2></div><div className="value-grid"><article><div className="value-icon"><TrainFront size={20} /></div><h3>Un seul comparateur</h3><p>Les horaires et les tarifs sont réunis dans une interface lisible.</p></article><article><div className="value-icon"><ShieldCheck size={20} /></div><h3>Paiement vérifié</h3><p>Chaque paiement est contrôlé avant la confirmation du billet.</p></article><article><div className="value-icon"><ArrowRight size={20} /></div><h3>Billets regroupés</h3><p>Retrouvez vos réservations dans un espace unique.</p></article></div></section>
    <section className="public-section modes-section"><div className="modes-copy"><h2>Choisissez votre mode de transport.</h2><p>Filtrez les départs selon votre ville, votre date et votre préférence.</p><button className="text-link" onClick={onBook}>Voir les trajets <ArrowRight size={15} /></button></div><div className="mode-stack"><div><TrainFront size={19} /><strong>Train</strong><span>Départs directs</span></div><div><BusFront size={19} /><strong>Bus</strong><span>Tarifs accessibles</span></div><div><Plane size={19} /><strong>Avion</strong><span>Longues distances</span></div></div></section>
    <section className="public-cta"><div><h2>Prêt à réserver ?</h2></div><button className="hero-primary" onClick={onBook}>Voir les trajets <ArrowRight size={17} /></button></section>
  </div>;
}
