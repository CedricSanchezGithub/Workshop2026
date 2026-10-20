import { useEffect, useMemo, useState } from 'react';
import { Globe2, Plane, SlidersHorizontal, TrainFront, BusFront } from 'lucide-react';
import { BookingSearch } from '../../components/booking/BookingSearch';
import { TripCard } from '../../components/booking/TripCard';

export function BookingPage({ state, actions }) {
  const pageSize = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const modes = ['Tous', 'Train', 'Bus', 'Plane'];
  const pageCount = Math.max(1, Math.ceil(state.visibleTrips.length / pageSize));
  const pageTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return state.visibleTrips.slice(start, start + pageSize);
  }, [currentPage, state.visibleTrips]);

  useEffect(() => {
    setCurrentPage(1);
  }, [state.transport, state.search, state.destination, state.directOnly, state.maxPrice]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  return <div className="page-wrap"><div className="page-title-row"><h1>Réserver un trajet</h1></div><BookingSearch search={state.search} setSearch={actions.setSearch} destination={state.destination} setDestination={actions.setDestination} tripMode={state.tripMode} setTripMode={actions.setTripMode} departureDate={state.departureDate} setDepartureDate={actions.setDepartureDate} returnDate={state.returnDate} setReturnDate={actions.setReturnDate} /><div className="content-toolbar content-toolbar-simple"><div /><button className={`filter-toggle ${state.showFilters ? 'selected' : ''}`} onClick={() => actions.setShowFilters(!state.showFilters)}><SlidersHorizontal size={15} /> Filtres</button></div>{state.showFilters && <div className="filter-bar"><label>Prix maximum <strong>{state.maxPrice} €</strong></label><input type="range" min="20" max="150" value={state.maxPrice} onChange={(event) => actions.setMaxPrice(event.target.value)} /><label><input type="checkbox" checked={state.directOnly} onChange={(event) => actions.setDirectOnly(event.target.checked)} /> Direct uniquement</label></div>}<div className="transport-filters">{modes.map((mode) => <button key={mode} title={mode === 'Plane' ? 'Avion' : mode} aria-label={mode === 'Plane' ? 'Avion' : mode} className={`transport-pill ${state.transport === mode ? 'active' : ''}`} onClick={() => actions.setTransport(mode)}>{mode === 'Train' && <TrainFront size={15} />}{mode === 'Bus' && <BusFront size={15} />}{mode === 'Plane' && <Plane size={15} />}{mode === 'Tous' && <Globe2 size={15} />}</button>)}</div><div className="trip-list">{pageTrips.map((trip) => <TripCard key={trip.id} trip={trip} onSelect={actions.selectTrip} />)}{state.visibleTrips.length === 0 && <div className="empty-state"><h3>Aucun trajet</h3><p>Modifiez vos filtres pour voir plus de départs.</p></div>}</div>{state.visibleTrips.length > 0 && pageCount > 1 && <nav className="pagination" aria-label="Pagination des trajets"><button type="button" onClick={() => setCurrentPage((page) => page - 1)} disabled={currentPage === 1}>← <span>Précédent</span></button><div className="pagination-pages">{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button type="button" key={page} className={currentPage === page ? 'active' : ''} aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page)}>{page}</button>)}</div><button type="button" onClick={() => setCurrentPage((page) => page + 1)} disabled={currentPage === pageCount}><span>Suivant</span> →</button></nav>}</div>;
}
