// Demo data for `npm run seed`. Hotels and people are fictional; emails use the reserved example.com domain.
// Booking dates are relative to the day the seed runs, so every stay is valid (not in the past, 1–3 nights).

const hotels = [
  {
    name: 'Riverside Orchid Bangkok',
    address: '88 Charoen Krung Rd, Bang Rak, Bangkok 10500',
    tel: '022345678',
    pricePerNightSatang: 320000,
  },
  {
    name: 'Sukhumvit Garden Suites',
    address: '21 Sukhumvit Soi 24, Khlong Toei, Bangkok 10110',
    tel: '022618800',
    pricePerNightSatang: 245000,
  },
  {
    name: 'Old Town Lanna House',
    address: '15 Ratchadamnoen Rd, Si Phum, Mueang Chiang Mai, Chiang Mai 50200',
    tel: '053210456',
    pricePerNightSatang: 180000,
  },
  {
    name: 'Nimman Loft Hotel',
    address: '7 Nimmanhaemin Soi 9, Su Thep, Mueang Chiang Mai, Chiang Mai 50200',
    tel: '053894120',
    pricePerNightSatang: 150000,
  },
  {
    name: 'Kata Bay Resort',
    address: '120 Kata Rd, Karon, Mueang Phuket, Phuket 83100',
    tel: '076330912',
    pricePerNightSatang: 410000,
  },
  {
    name: 'Ao Nang Cliffside Villas',
    address: '33 Moo 2, Ao Nang, Mueang Krabi, Krabi 81180',
    tel: '075637210',
    pricePerNightSatang: 290000,
  },
  {
    name: 'Hua Hin Seabreeze Inn',
    address: '56 Naresdamri Rd, Hua Hin, Prachuap Khiri Khan 77110',
    tel: '032511234',
    pricePerNightSatang: 210000,
  },
  {
    // No price on purpose, to show how clients handle a hotel without one.
    name: 'Ayutthaya Heritage Lodge',
    address: '9 U-Thong Rd, Pratu Chai, Phra Nakhon Si Ayutthaya 13000',
    tel: '035242567',
    pricePerNightSatang: null,
  },
];

// `startsInDays: 0` checks in today. Pim has no bookings or favorites, to show the empty state.
const users = [
  {
    name: 'Somchai Jaidee',
    tel: '0812345678',
    email: 'somchai@example.com',
    bookings: [
      { hotel: 'Riverside Orchid Bangkok', startsInDays: 0, nights: 1 },
      { hotel: 'Kata Bay Resort', startsInDays: 14, nights: 3 },
    ],
    favorites: ['Riverside Orchid Bangkok', 'Kata Bay Resort', 'Old Town Lanna House'],
  },
  {
    name: 'Malee Srisuk',
    tel: '0898765432',
    email: 'malee@example.com',
    bookings: [
      { hotel: 'Old Town Lanna House', startsInDays: 7, nights: 2 },
      { hotel: 'Nimman Loft Hotel', startsInDays: 30, nights: 1 },
    ],
    favorites: ['Old Town Lanna House', 'Riverside Orchid Bangkok', 'Ao Nang Cliffside Villas'],
  },
  {
    name: 'Anan Wongsa',
    tel: '0861122334',
    email: 'anan@example.com',
    bookings: [{ hotel: 'Ao Nang Cliffside Villas', startsInDays: 21, nights: 3 }],
    favorites: ['Riverside Orchid Bangkok', 'Hua Hin Seabreeze Inn'],
  },
  {
    name: 'Pim Rattana',
    tel: '0923344556',
    email: 'pim@example.com',
    bookings: [],
    favorites: [],
  },
];

module.exports = { hotels, users };
