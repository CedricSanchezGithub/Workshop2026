import type { BookingQuote, BookingQuoteRepository } from '../../application/ports/BookingQuoteRepository.js';

const pricesInCents = [3900, 2400, 8900, 2900, 1800, 3500, 4200, 7400, 2500, 2200, 4400, 9200, 4900, 1900, 2100, 9900];

export class InMemoryBookingQuoteRepository implements BookingQuoteRepository {
  private readonly quotes = new Map(pricesInCents.map((amountCents, index) => [`booking_${index + 1}`, { bookingId: `booking_${index + 1}`, amountCents, currency: 'EUR' as const }]));

  async findByBookingId(bookingId: string): Promise<BookingQuote | undefined> {
    return this.quotes.get(bookingId);
  }
}
