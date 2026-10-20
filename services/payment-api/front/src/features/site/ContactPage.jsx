import { Clock3, Mail, MapPin, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';

export function ContactPage() {
  const [sent, setSent] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Question Pay&Go — ${data.get('name')}`);
    const body = encodeURIComponent(`Nom : ${data.get('name')}\nEmail : ${data.get('email')}\n\n${data.get('message')}`);
    window.location.href = `mailto:bonjour@payandgo.fr?subject=${subject}&body=${body}`;
    setSent(true);
  };
  return <div className="public-page inner-public-page contact-page"><div className="public-page-heading"><h1>Contact</h1><p>Une question sur une réservation ou un paiement ? Écrivez-nous.</p></div><div className="contact-layout"><div className="contact-details"><div className="contact-detail"><Mail size={18} /><div><strong>Email</strong><span>bonjour@payandgo.fr</span></div></div><div className="contact-detail"><Clock3 size={18} /><div><strong>Horaires</strong><span>Lundi — vendredi, 9h — 18h</span></div></div><div className="contact-detail"><MapPin size={18} /><div><strong>Pay&Go</strong><span>Paris, France</span></div></div><div className="contact-note"><MessageCircle size={19} /><p>Pour une question sur un trajet ou un tarif, utilisez aussi l’aide trajet.</p></div></div><form className="contact-form" onSubmit={submit}><div className="form-heading"><h2>Votre message</h2></div><label>Nom<input name="name" required placeholder="Votre nom" /></label><label>Email<input name="email" required type="email" placeholder="vous@exemple.fr" /></label><label>Message<textarea name="message" required rows="5" placeholder="Votre question" /></label>{sent && <p className="form-success">Votre messagerie s’ouvre pour finaliser l’envoi.</p>}<button className="hero-primary" type="submit">Envoyer <Send size={15} /></button></form></div></div>;
}
