import Stripe from "stripe";
import { env } from "./env";

/** Stripe client, or null when no secret key is configured. */
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

export const isStripeConfigured = (): boolean => stripe !== null;
