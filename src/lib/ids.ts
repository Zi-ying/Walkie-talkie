import { customAlphabet } from "nanoid";

const ALPHABET: string = "0123456789abcdefghijklmnopqrstuvwxyz";

export const generateId: () => string = customAlphabet(ALPHABET, 10);
