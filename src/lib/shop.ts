import {
  fetchBusinessHours,
  fetchPublicBarbers,
  fetchShop,
} from "./data";

export type { Shop } from "./types";

export const getShop = fetchShop;
export const getBusinessHours = fetchBusinessHours;
export const getActiveBarbers = fetchPublicBarbers;
