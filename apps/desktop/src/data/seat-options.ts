export interface SeatOption {
  id: string;
  label: string;
  description: string;
  defaultDuration: number;
}

export const SEAT_OPTIONS: SeatOption[] = [
  {
    id: "jump-seat",
    label: "Jump Seat",
    description: "Quick system checks and five minute touch downs for resets.",
    defaultDuration: 5
  },
  {
    id: "short-haul",
    label: "Short Haul",
    description: "Classic 25 minute sprint with a brisk climb and descent.",
    defaultDuration: 25
  },
  {
    id: "long-haul",
    label: "Long Haul",
    description: "Deep focus cruise designed for extended work above the clouds.",
    defaultDuration: 55
  }
];
