import { ObjectId } from "mongoose";

/** The shipping fields shared by saved addresses and order snapshots. */
export interface AddressFields {
  fullName: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** A saved address in a user's address book. */
export interface Address extends AddressFields {
  _id: ObjectId;
  label?: string;
  isDefault: boolean;
}

/** Payload for creating/updating a saved address. */
export interface AddressInput extends AddressFields {
  label?: string;
  isDefault?: boolean;
}
