export interface IUser {
  address: string;
  name?: string;
  avatar?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  github?: string;
}

export interface SessionRequest extends Request {
  userAddress: { address: string };
}
