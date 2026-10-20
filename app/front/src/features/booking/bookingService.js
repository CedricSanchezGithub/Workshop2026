export function filterTrips(trips, { transport, search, destination, directOnly, maxPrice }) {
  const term = search.trim().toLowerCase();
  const destinationTerm = destination.trim().toLowerCase();
  return trips.filter((trip) => {
    const haystack = `${trip.from} ${trip.to} ${trip.provider}`.toLowerCase();
    const matchesTransport = transport === 'Tous' || trip.type === transport;
    const matchesSearch = !term || haystack.includes(term);
    const matchesDestination = !destinationTerm || trip.to.toLowerCase().includes(destinationTerm);
    const matchesPrice = trip.price <= Number(maxPrice);
    const matchesDirect = !directOnly || trip.stops === 'Direct';
    return matchesTransport && matchesSearch && matchesDestination && matchesPrice && matchesDirect;
  });
}

export function answerAssistant(message) {
  const text = message.toLowerCase();
  const isPayGoTopic = ['trajet', 'voyage', 'bus', 'train', 'avion', 'prix', 'tarif', 'réserv', 'billet', 'paiement', 'rembours', 'compte', 'connexion', 'inscription', 'carte bancaire', 'smtp', 'dashboard', 'paramètre', 'filtre', 'bonjour', 'salut', 'merci', 'pay&go'].some((term) => text.includes(term));
  if (!isPayGoTopic) return 'Je peux répondre uniquement aux questions liées à Pay&Go : trajets, réservations, paiements, remboursements, compte et assistance.';
  if (text.includes('prix') || text.includes('tarif')) return 'Les trajets commencent à 18 €. Utilisez le filtre prix pour ajuster votre recherche.';
  if (text.includes('paris') || text.includes('lyon') || text.includes('bruxelles')) return 'Saisissez cette ville dans le champ de départ ou de destination pour filtrer les trajets.';
  if (text.includes('réserver') || text.includes('billet')) return 'Sélectionnez un trajet, renseignez le paiement, puis confirmez avec le code reçu.';
  return 'Je peux vous aider à trouver un trajet, comparer les prix ou comprendre les filtres.';
}
