export type BookingQuote = {
  bookingId: string;
  amountCents: number;
  currency: 'EUR';
};

export interface BookingQuoteRepository {
  findByBookingId(bookingId: string): Promise<BookingQuote | undefined>;
}
