import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const SONEIUM_PROVIDER = 'https://rpc.soneium.org/';
const ETH_PROVIDER = 'https://ethereum-rpc.publicnode.com';

export const soneiumProvider = new ethers.JsonRpcProvider(SONEIUM_PROVIDER);
export const ethProvider = new ethers.JsonRpcProvider(ETH_PROVIDER);
