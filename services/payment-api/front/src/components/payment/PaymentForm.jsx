import { ArrowLeft, Check, CreditCard, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

function digitsOnly(value) {
  return value.replace(/\D/g, '');
}

function validLuhn(value) {
  const digits = digitsOnly(value);
  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return digits.length >= 13 && digits.length <= 19 && sum % 10 === 0;
}

function cardBrand(number) {
  if (/^4/.test(number)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(number)) return 'mastercard';
  if (/^3[47]/.test(number)) return 'amex';
  return 'other';
}

function validExpiry(value) {
  const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return false;
  const expiry = new Date(2000 + Number(match[2]), Number(match[1]), 0);
  return expiry >= new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
}

export function PaymentForm({ price, paymentState, onStart, onVerify, onBack }) {
  const [step, setStep] = useState('details');
  const [intent, setIntent] = useState(null);
  const [verification, setVerification] = useState(null);
  const [cardholder, setCardholder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const submitPayment = async (event) => {
    event.preventDefault();
    const digits = digitsOnly(cardNumber);
    if (cardholder.trim().length < 2) return setError('Indiquez le nom du titulaire.');
    if (!validLuhn(digits)) return setError('Le numéro de carte fictive est invalide.');
    if (!validExpiry(expiry)) return setError('La date d’expiration doit être au format MM/AA et dans le futur.');
    if (!/^\d{3,4}$/.test(cvc)) return setError('Le cryptogramme doit contenir 3 ou 4 chiffres.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Indiquez une adresse email valide.');
    setError('');
    try {
      const result = await onStart({ token: `pm_mock_${crypto.randomUUID()}`, last4: digits.slice(-4), brand: cardBrand(digits), email });
      setIntent(result.payment);
      setVerification(result.verification);
      setStep('verify');
    } catch (submitError) {
      setError(submitError.message === 'AUTH_REQUIRED' || submitError.message === 'UNAUTHORIZED' ? 'Connectez-vous pour confirmer une réservation.' : submitError.message);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(event.currentTarget.code.value)) return setError('Le code SMTP doit contenir 6 chiffres.');
    setError('');
    try { await onVerify(intent.id, event.currentTarget.code.value); } catch (verifyError) { setError(verifyError.message); }
  };

  if (step === 'verify') return <form className="payment-form" autoComplete="off" onSubmit={submitVerification}><div className="payment-step-heading"><div className="payment-step-icon"><Mail size={17} /></div><div><strong>Code de confirmation</strong><span>Saisissez le code envoyé à {email}.</span></div></div><label>Code à 6 chiffres<input name="code" inputMode="numeric" maxLength="6" placeholder="123456" autoComplete="off" /></label>{verification?.demoCode && <p className="demo-code"><Check size={13} /> Code de démonstration : {verification.demoCode}</p>}{error && <p className="payment-error">{error}</p>}<button className="primary-button payment-submit" type="submit" disabled={paymentState.status === 'processing'}>{paymentState.status === 'processing' ? 'Vérification…' : 'Confirmer'} </button><p className="payment-footnote">Code simulé localement · aucun email réel envoyé.</p></form>;

  return <form className="payment-form" autoComplete="off" onSubmit={submitPayment}><div className="payment-step-heading"><div className="payment-step-icon"><CreditCard size={17} /></div><div><strong>Paiement</strong><span>Montant vérifié : {price} €</span></div></div><label>Titulaire<input name="cardholder" value={cardholder} onChange={(event) => setCardholder(event.target.value)} placeholder="Marie Dupont" autoComplete="off" /></label><label>Numéro de carte fictive<input name="card-number" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="off" /></label><div className="payment-fields-row"><label>Expiration<input name="card-expiry" value={expiry} onChange={(event) => setExpiry(event.target.value.replace(/[^\d/]/g, '').slice(0, 5))} placeholder="MM/AA" inputMode="numeric" autoComplete="off" /></label><label>CVC<input name="card-cvc" value={cvc} onChange={(event) => setCvc(digitsOnly(event.target.value).slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="off" /></label></div><label>Email de confirmation<input name="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.fr" type="email" autoComplete="off" /></label>{error && <p className="payment-error">{error}</p>}<div className="payment-actions"><button className="payment-back" type="button" onClick={onBack}><ArrowLeft size={13} /> Retour</button><button className="primary-button payment-submit" type="submit" disabled={paymentState.status === 'processing'}>{paymentState.status === 'processing' ? 'Vérification…' : 'Vérifier'} </button></div><p className="payment-footnote"><LockKeyhole size={12} /> Données carte non conservées.</p></form>;
}
