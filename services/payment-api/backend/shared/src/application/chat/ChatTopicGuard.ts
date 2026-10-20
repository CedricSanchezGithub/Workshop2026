export const CHAT_SCOPE_MESSAGE = 'Je peux répondre uniquement aux questions liées à Pay&Go : trajets, réservations, paiements, remboursements, compte et assistance.';

const allowedTerms = [
  'paygo', 'pay&go', 'trajet', 'voyage', 'bus', 'train', 'avion', 'transport',
  'depart', 'destination', 'horaire', 'heure', 'prix', 'tarif', 'billet',
  'reserver', 'reservation', 'annuler', 'remboursement', 'paiement', 'payer',
  'carte bancaire', 'smtp', 'code de verification', 'compte', 'connexion',
  'inscription', 'profil', 'parametre', 'dashboard', 'administration', 'admin',
  'filtre', 'bonjour', 'salut', 'merci',
];

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function isPayGoTopic(message: string): boolean {
  const normalized = normalize(message.trim());
  return allowedTerms.some((term) => normalized.includes(term));
}

export function getLatestUserMessage(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string | undefined {
  return [...messages].reverse().find((message) => message.role === 'user')?.content;
}
