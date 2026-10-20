import type { BookingQuote, BookingQuoteRepository } from '../../application/ports/BookingQuoteRepository.js';
import { PostgresDatabase } from '../database/PostgresDatabase.js';

export class PostgresBookingQuoteRepository implements BookingQuoteRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findByBookingId(bookingId: string): Promise<BookingQuote | undefined> {
    const result = await this.database.query('SELECT booking_id, amount_cents, currency FROM booking_quotes WHERE booking_id = $1', [bookingId]);
    const row = result.rows[0];
    return row ? { bookingId: String(row.booking_id), amountCents: Number(row.amount_cents), currency: 'EUR' } : undefined;
  }
}
