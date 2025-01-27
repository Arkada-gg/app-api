import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const BLOCKSCOUT_RPC_URL = 'https://rpc.soneium.org/';

export const provider = new ethers.JsonRpcProvider(BLOCKSCOUT_RPC_URL);
