import { customAlphabet } from "nanoid";

// PeerJS ids must match /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/, so we avoid nanoid's default
// alphabet: it contains "-" and "_", which could end an id or appear twice in a row.
const ALPHABET: string = "0123456789abcdefghijklmnopqrstuvwxyz";

export const generateId: () => string = customAlphabet(ALPHABET, 10);
